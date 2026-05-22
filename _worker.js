// ── JWT helpers ──────────────────────────────────────────────────────────────

const enc = new TextEncoder();

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, [usage]
  );
}

async function signJWT(payload, secret, expiresInSeconds = 60 * 60 * 24 * 7) {
  payload = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = b64url(enc.encode(JSON.stringify(payload)));
  const data   = `${header}.${body}`;
  const key    = await hmacKey(secret, 'sign');
  const sig    = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return `${data}.${sig}`;
}

async function verifyJWT(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const key = await hmacKey(secret, 'verify');
  const sigBytes = Uint8Array.from(b64urlDecode(sig), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`));
  if (!valid) return null;
  const payload = JSON.parse(b64urlDecode(body));
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

function getSessionCookie(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

function setSessionCookie(token, clear = false) {
  const value  = clear ? '' : token;
  const maxAge = clear ? 0 : 60 * 60 * 24 * 7;
  return `session=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
}

// ── Route handlers ────────────────────────────────────────────────────────────

function bnetOAuthBase(region) {
  return region === 'us' ? 'https://oauth.battle.net' : `https://${region}.battle.net/oauth`;
}

async function handleLogin(request, env) {
  const url    = new URL(request.url);
  const region = url.searchParams.get('region') || 'us';
  const state  = crypto.randomUUID() + '|' + region;

  const redirectUri = new URL('/auth/callback', url.origin).href;
  const params = new URLSearchParams({
    client_id:     env.BNET_CLIENT_ID,
    scope:         'openid wow.profile',
    redirect_uri:  redirectUri,
    response_type: 'code',
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location:     `${bnetOAuthBase(region)}/authorize?${params}`,
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
    },
  });
}

async function handleCallback(request, env) {
  const url    = new URL(request.url);
  const code   = url.searchParams.get('code');
  const state  = url.searchParams.get('state');
  const origin = url.origin;

  const cookie      = request.headers.get('Cookie') || '';
  const cookieState = cookie.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookieState) {
    return new Response('Invalid OAuth state', { status: 400 });
  }

  const [, region = 'us'] = cookieState.split('|');
  const oauthBase = bnetOAuthBase(region);

  const tokenRes = await fetch(`${oauthBase}/token`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${env.BNET_CLIENT_ID}:${env.BNET_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: `${origin}/auth/callback`,
    }),
  });

  if (!tokenRes.ok) return new Response('Token exchange failed', { status: 502 });

  const { access_token, expires_in } = await tokenRes.json();

  const userRes = await fetch(`${oauthBase}/userinfo`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) return new Response('Failed to fetch user info', { status: 502 });

  const user = await userRes.json();

  if (env.USER_DATA) {
    await env.USER_DATA.put('token:' + user.sub, access_token, {
      expirationTtl: expires_in || 86400,
    });
  }

  const token = await signJWT(
    { sub: String(user.sub), battletag: user.battletag, region },
    env.SESSION_SECRET
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location:     origin,
      'Set-Cookie': setSessionCookie(token),
    },
  });
}

async function handleLogout(request) {
  return new Response(null, {
    status: 302,
    headers: {
      Location:     new URL(request.url).origin,
      'Set-Cookie': setSessionCookie('', true),
    },
  });
}

async function handleApiUser(request, env) {
  const token   = getSessionCookie(request);
  const payload = await verifyJWT(token, env.SESSION_SECRET);

  return Response.json(
    { user: payload ? { sub: payload.sub, battletag: payload.battletag } : null },
    { headers: { 'Access-Control-Allow-Origin': 'same-origin' } }
  );
}

// ── WoW week key (mirrors frontend getWeekKey) ───────────────────────────────
function getWowWeekKey() {
  const now = new Date();
  const d   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0));
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() - 1);
  if (now < d) d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

// Tuesday 15:00 UTC reset as a ms timestamp — used to filter this-week kills
function getWowWeekResetMs() {
  return new Date(getWowWeekKey() + 'T15:00:00Z').getTime();
}

// Maps Battle.net raid instance names → our task ID prefix
const RAID_INSTANCE_MAP = {
  'The Dreamrift':         'rd',
  'The Voidspire':         'vs',
  "March on Quel'Danas":   'mq',
};

// Maps Battle.net encounter names → our boss ID
const RAID_BOSS_ID_MAP = {
  'Chimaerus':                  'chimaerus',
  'Imperator Averzian':         'averzian',
  'Vorasius':                   'vorasius',
  'Fallen-King Salhadaar':      'salhadaar',
  'Vaelgor & Ezzorak':          'vaelgor',
  'Lightblinded Vanguard':      'vanguard',
  'Crown of the Cosmos':        'cosmos',
  "Belo'ren, Child of A'lar":   'beloren',
  'Midnight Falls':             'midnight',
};

const RAID_DIFF_MAP = { LFR: 'lfr', NORMAL: 'n', HEROIC: 'h', MYTHIC: 'm' };

// ── Armory sync via Battle.net ────────────────────────────────────────────────

async function handleGetArmory(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return new Response('Unauthorized', { status: 401 });
  if (!env.USER_DATA) return new Response('KV not configured', { status: 503 });

  const accessToken = await env.USER_DATA.get('token:' + payload.sub);
  if (!accessToken) return new Response('Token expired', { status: 401 });

  const url   = new URL(request.url);
  const char  = url.searchParams.get('char');
  const realm = url.searchParams.get('realm');
  if (!char || !realm) return new Response('Missing char or realm', { status: 400 });

  const region  = payload.region || 'us';
  const apiBase = `https://${region}.api.blizzard.com`;
  const headers = {
    'Authorization':       `Bearer ${accessToken}`,
    'Battlenet-Namespace': `profile-${region}`,
  };
  const charPath = `${apiBase}/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(char)}`;

  const [profileRes, keystoneRes, equipmentRes, raidsRes] = await Promise.all([
    fetch(`${charPath}?locale=en_US`,                              { headers }),
    fetch(`${charPath}/mythic-keystone-profile?locale=en_US`,      { headers }),
    fetch(`${charPath}/equipment?locale=en_US`,                    { headers }),
    fetch(`${charPath}/encounters/raids?locale=en_US`,             { headers }),
  ]);

  if (profileRes.status === 404) return new Response('Character not found', { status: 404 });
  if (profileRes.status === 401) return new Response('Token expired',       { status: 401 });
  if (!profileRes.ok)            return new Response('Battle.net API error', { status: 502 });

  const bnetStr = v => (typeof v === 'string' ? v : v?.en_US ?? '');
  const profile = await profileRes.json();

  let mythicRating = null, mythicColor = null, weeklyRuns = null;
  if (keystoneRes.ok) {
    const ks = await keystoneRes.json();
    if (ks.current_mythic_rating?.rating) {
      mythicRating = Math.round(ks.current_mythic_rating.rating);
      const col = ks.current_mythic_rating.color;
      if (col) mythicColor = '#' + [col.r, col.g, col.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    }
    if (ks.current_period?.best_runs) {
      weeklyRuns = {
        week: getWowWeekKey(),
        runs: ks.current_period.best_runs.map(r => ({
          mythic_level: r.keystone_level,
          dungeon:      bnetStr(r.dungeon?.name),
          completed_at: r.completed_timestamp ? new Date(r.completed_timestamp).toISOString() : null,
        })),
      };
    }
  }

  const GEAR_SLOT_MAP = {
    HEAD: 'head', NECK: 'neck', SHOULDER: 'shoulder', BACK: 'back',
    CHEST: 'chest', WRIST: 'wrist', HANDS: 'hands', WAIST: 'waist',
    LEGS: 'legs', FEET: 'feet',
    FINGER_1: 'finger1', FINGER_2: 'finger2',
    TRINKET_1: 'trinket1', TRINKET_2: 'trinket2',
    MAIN_HAND: 'main_hand', OFF_HAND: 'off_hand',
  };
  let gearItems = {};
  if (equipmentRes.ok) {
    const eq = await equipmentRes.json();
    for (const item of (eq.equipped_items || [])) {
      const slot = GEAR_SLOT_MAP[item.slot?.type];
      if (slot) gearItems[slot] = { name: bnetStr(item.name), id: item.item?.id || 0 };
    }
    // Fetch icons for all equipped items in parallel (static namespace)
    const staticHeaders = { 'Authorization': `Bearer ${accessToken}`, 'Battlenet-Namespace': `static-${region}` };
    const slots = Object.keys(gearItems).filter(s => gearItems[s].id);
    const iconResults = await Promise.all(
      slots.map(s =>
        fetch(`${apiBase}/data/wow/media/item/${gearItems[s].id}?locale=en_US`, { headers: staticHeaders })
          .then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );
    slots.forEach((s, i) => {
      const url = iconResults[i]?.assets?.find(a => a.key === 'icon')?.value;
      if (url) gearItems[s].icon = url;
    });
  }

  // ── Raid boss kills this reset ────────────────────────────────────────────
  // raidKills: { 'vs_h': { averzian: true, vorasius: true, ... }, 'rd_n': { chimaerus: true }, ... }
  let raidKills = {};
  if (raidsRes.ok) {
    const raidsData  = await raidsRes.json();
    const weekReset  = getWowWeekResetMs();
    for (const exp of (raidsData.expansions || [])) {
      for (const inst of (exp.instances || [])) {
        const prefix = RAID_INSTANCE_MAP[bnetStr(inst.instance?.name)];
        if (!prefix) continue;
        for (const mode of (inst.modes || [])) {
          const diff = RAID_DIFF_MAP[mode.difficulty?.type];
          if (!diff) continue;
          const taskId = `${prefix}_${diff}`;
          for (const enc of (mode.progress?.encounters || [])) {
            const bossId = RAID_BOSS_ID_MAP[bnetStr(enc.encounter?.name)];
            if (!bossId) continue;
            if (enc.last_kill_timestamp && enc.last_kill_timestamp >= weekReset) {
              if (!raidKills[taskId]) raidKills[taskId] = {};
              raidKills[taskId][bossId] = true;
            }
          }
        }
      }
    }
  }

  return Response.json({
    ilvl:         profile.equipped_item_level || profile.average_item_level || 0,
    spec:         bnetStr(profile.active_spec?.name),
    className:    bnetStr(profile.character_class?.name),
    mythicRating,
    mythicColor,
    weeklyRuns,
    gearItems,
    raidKills,
    lastSync:     Date.now(),
  });
}

// ── Battle.net character import ───────────────────────────────────────────────

async function handleGetCharacters(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return new Response('Unauthorized', { status: 401 });
  if (!env.USER_DATA) return new Response('KV not configured', { status: 503 });

  const accessToken = await env.USER_DATA.get('token:' + payload.sub);
  if (!accessToken) return new Response('Token expired', { status: 401 });

  const region  = payload.region || 'us';
  const apiBase = `https://${region}.api.blizzard.com`;

  const res = await fetch(`${apiBase}/profile/user/wow?locale=en_US`, {
    headers: {
      'Authorization':       `Bearer ${accessToken}`,
      'Battlenet-Namespace': `profile-${region}`,
    },
  });

  if (res.status === 401) return new Response('Token expired', { status: 401 });
  if (!res.ok)            return new Response('Battle.net API error', { status: 502 });

  // locale=en_US makes name fields strings, but guard against object form just in case
  const bnetStr = v => (typeof v === 'string' ? v : v?.en_US ?? v?.name ?? '');

  const data = await res.json();
  const chars = (data.wow_accounts || [])
    .flatMap(a => a.characters || [])
    .filter(c => c.level >= 80)
    .map(c => ({
      name:      c.name,
      realm:     bnetStr(c.realm?.name) || c.realm?.slug || '',
      realmSlug: c.realm?.slug || '',
      level:     c.level,
      className: bnetStr(c.playable_class?.name),
      faction:   c.faction?.type || '',
    }))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));

  return Response.json(chars);
}

// ── Cloud data sync (KV) ─────────────────────────────────────────────────────

async function handleGetData(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return new Response('Unauthorized', { status: 401 });
  if (!env.USER_DATA) return Response.json({});
  const raw = await env.USER_DATA.get('user:' + payload.sub);
  return Response.json(raw ? JSON.parse(raw) : {});
}

async function handlePutData(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return new Response('Unauthorized', { status: 401 });
  if (!env.USER_DATA) return new Response('KV not configured', { status: 503 });
  const body = await request.json();
  await env.USER_DATA.put('user:' + payload.sub, JSON.stringify(body));
  return Response.json({ ok: true });
}

// ── Item icon lookup via client credentials (no user session required) ─────────

async function getClientToken(env) {
  if (env.USER_DATA) {
    const cached = await env.USER_DATA.get('client_token');
    if (cached) return cached;
  }
  const res = await fetch('https://oauth.battle.net/token', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${env.BNET_CLIENT_ID}:${env.BNET_CLIENT_SECRET}`)}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) return null;
  const { access_token, expires_in } = await res.json();
  if (env.USER_DATA) {
    await env.USER_DATA.put('client_token', access_token, { expirationTtl: (expires_in || 86400) - 300 });
  }
  return access_token;
}

async function handleItemIcons(request, env) {
  let names;
  try { ({ names } = await request.json()); } catch (_) { return Response.json({}); }
  if (!Array.isArray(names) || !names.length) return Response.json({});

  const token = await getClientToken(env);
  if (!token) return Response.json({});

  const apiBase = 'https://us.api.blizzard.com';
  const headers = {
    'Authorization':       `Bearer ${token}`,
    'Battlenet-Namespace': 'static-us',
  };

  const results = {};
  await Promise.all(names.slice(0, 20).map(async name => {
    try {
      const searchRes = await fetch(
        `${apiBase}/data/wow/search/item?namespace=static-us&name.en_US=${encodeURIComponent(name)}&_pageSize=1&locale=en_US`,
        { headers }
      );
      if (!searchRes.ok) return;
      const searchData = await searchRes.json();
      const hit = searchData.results?.[0]?.data;
      if (!hit) return;
      const foundName = typeof hit.name === 'string' ? hit.name : hit.name?.en_US;
      if (!foundName) return;
      // Normalize apostrophe variants before comparing
      const norm = s => s.toLowerCase().replace(/[''ʼ`]/g, "'").replace(/\s+/g, ' ').trim();
      if (norm(foundName) !== norm(name)) return;

      const mediaRes = await fetch(
        `${apiBase}/data/wow/media/item/${hit.id}?namespace=static-us&locale=en_US`,
        { headers }
      );
      if (!mediaRes.ok) return;
      const mediaData = await mediaRes.json();
      const icon = mediaData.assets?.find(a => a.key === 'icon')?.value;
      if (icon) results[name.toLowerCase()] = icon;
    } catch (_) {}
  }));

  return Response.json(results);
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/auth/login')    return handleLogin(request, env);
    if (pathname === '/auth/callback') return handleCallback(request, env);
    if (pathname === '/auth/logout')   return handleLogout(request);
    if (pathname === '/api/user')      return handleApiUser(request, env);
    if (pathname === '/api/armory')      return handleGetArmory(request, env);
    if (pathname === '/api/characters')  return handleGetCharacters(request, env);
    if (pathname === '/api/data') {
      if (request.method === 'GET') return handleGetData(request, env);
      if (request.method === 'PUT') return handlePutData(request, env);
    }
    if (pathname === '/api/item-icons' && request.method === 'POST') return handleItemIcons(request, env);

    // Fall through to static assets
    return env.ASSETS.fetch(request);
  },
};
