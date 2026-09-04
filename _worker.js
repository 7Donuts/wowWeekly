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
  const url     = new URL(request.url);
  const region  = url.searchParams.get('region') || 'us';
  const isPopup = url.searchParams.get('popup') === '1';
  const state   = crypto.randomUUID() + '|' + region + (isPopup ? '|popup' : '');

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

  const [, region = 'us', popupFlag] = cookieState.split('|');
  const isPopup   = popupFlag === 'popup';
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

  if (isPopup) {
    // Return a minimal page that signals the opener and closes itself.
    const safeOrigin = JSON.stringify(origin);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Battle.net: Connected</title>
<style>body{background:#0d0010;color:#c9a84c;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:1.1rem;}</style>
</head><body><span>Connected ✓</span>
<script>
try{window.opener.postMessage({type:'bnet_auth_complete'},${safeOrigin});}catch(e){}
setTimeout(function(){window.close();},500);
<\/script></body></html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html', 'Set-Cookie': setSessionCookie(token) },
    });
  }

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
    { user: payload ? { sub: payload.sub, battletag: payload.battletag, region: payload.region || 'us' } : null },
    { headers: { 'Access-Control-Allow-Origin': 'same-origin' } }
  );
}

// ── WoW week key ─────────────────────────────────────────────────────────────
//
// Mirrors js/storage.js. The reset is not the same moment in every region, so
// the anchor is a parameter rather than a constant, and the browser learns the
// real one from Blizzard's mythic keystone period and syncs it in the member's
// own blob under `wow_mn_reset_anchor`. Absent that, every region keeps the
// Tuesday 15:00 UTC rule this site has always used: the default is
// "unchanged", never a different guess.
//
// Both halves of the rule live in getWowWeekStartMs; the key is only its
// label, so the two cannot drift apart.

const DEFAULT_RESET_ANCHOR = { day: 2, hour: 15 };

function readResetAnchor(blob) {
  const stored = blob && blob['wow_mn_reset_anchor'];
  if (stored && Number.isInteger(stored.day) && Number.isInteger(stored.hour)
      && stored.day >= 0 && stored.day <= 6 && stored.hour >= 0 && stored.hour <= 23) {
    return stored;
  }
  return DEFAULT_RESET_ANCHOR;
}

function getWowWeekStartMs(anchor, nowMs) {
  anchor = anchor || DEFAULT_RESET_ANCHOR;
  const now = new Date(nowMs == null ? Date.now() : nowMs);
  const d   = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), anchor.hour, 0, 0));
  while (d.getUTCDay() !== anchor.day) d.setUTCDate(d.getUTCDate() - 1);
  if (now < d) d.setUTCDate(d.getUTCDate() - 7);
  return d.getTime();
}

function getWowWeekKey(anchor, nowMs) {
  return new Date(getWowWeekStartMs(anchor, nowMs)).toISOString().slice(0, 10);
}

// The moment this reset week began, for filtering this-week kills.
function getWowWeekResetMs(anchor) {
  return getWowWeekStartMs(anchor);
}

// Maps Battle.net raid instance names → our task ID prefix.
//
// The Venomous Abyss is Season 2's raid and was missing here, which meant
// every kill in it was invisible to the auto-check: the armory sync read the
// encounters, found no prefix, and dropped them. Season 1's three raids stay
// because their tasks are still on the site under `raid-s1`.
const RAID_INSTANCE_MAP = {
  'The Venomous Abyss':    'vab',
  'The Dreamrift':         'rd',
  'The Voidspire':         'vs',
  "March on Quel'Danas":   'mq',
};

// Maps Battle.net encounter names → our boss ID.
//
// Blizzard's journal and the site's own boss lists do not always agree on
// whether a name carries its article, so both forms are mapped where they
// differ. The addon's Core/TaskMap.lua carries the same aliases.
const RAID_BOSS_ID_MAP = {
  // The Venomous Abyss, Season 2
  "Nek'zali":                   'nekzali',
  'Entombed Sentinels':         'sentinels',
  'Lost Explorers':             'explorers',
  'The Lost Explorers':         'explorers',
  'Vashnik':                    'vashnik',
  'Vashnik the Malignant':      'vashnik',
  'Sszorak':                    'sszorak',
  'Twin Fangs':                 'twinfangs',
  'The Twin Fangs':             'twinfangs',
  'Coiled Altar':               'coiledaltar',
  'The Coiled Altar':           'coiledaltar',
  "Ula'tek":                    'ulatek',
  // Season 1
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

  // This member's own reset anchor, so weeklyRuns and raidKills are filtered
  // against the same week boundary their browser is using.
  const storedBlob = await env.USER_DATA.get('user:' + payload.sub, { type: 'json' });
  const anchor = readResetAnchor(storedBlob);

  const region  = payload.region || 'us';
  const apiBase = `https://${region}.api.blizzard.com`;
  const headers = {
    'Authorization':       `Bearer ${accessToken}`,
    'Battlenet-Namespace': `profile-${region}`,
  };
  const charPath = `${apiBase}/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(char)}`;

  const [profileRes, keystoneRes, equipmentRes, raidsRes, mediaRes, pvp2v2Res, pvp3v3Res, pvpRbgRes] = await Promise.all([
    fetch(`${charPath}?locale=en_US`,                              { headers }),
    fetch(`${charPath}/mythic-keystone-profile?locale=en_US`,      { headers }),
    fetch(`${charPath}/equipment?locale=en_US`,                    { headers }),
    fetch(`${charPath}/encounters/raids?locale=en_US`,             { headers }),
    fetch(`${charPath}/character-media?locale=en_US`,              { headers }),
    fetch(`${charPath}/pvp-bracket/2v2?locale=en_US`,               { headers }),
    fetch(`${charPath}/pvp-bracket/3v3?locale=en_US`,               { headers }),
    fetch(`${charPath}/pvp-bracket/rbg?locale=en_US`,               { headers }),
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
        week: getWowWeekKey(anchor),
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
    const weekReset  = getWowWeekResetMs(anchor);
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

  let portrait   = null;
  let renderUrl  = null;
  if (mediaRes.ok) {
    const media = await mediaRes.json();
    portrait  = media.assets?.find(a => a.key === 'avatar')?.value    || null;
    renderUrl = media.assets?.find(a => a.key === 'main-raw')?.value  || null;
  }

  let pvpRating = null;
  let pvpBracket = null;
  for (const [label, response] of [['2v2', pvp2v2Res], ['3v3', pvp3v3Res], ['RBG', pvpRbgRes]]) {
    if (!response.ok) continue;
    try {
      const bracket = await response.json();
      const rating = Number(bracket.rating) || 0;
      if (rating > (pvpRating || 0)) {
        pvpRating = rating;
        pvpBracket = label;
      }
    } catch (_) {}
  }

  return Response.json({
    ilvl:         profile.equipped_item_level || profile.average_item_level || 0,
    spec:         bnetStr(profile.active_spec?.name),
    className:    bnetStr(profile.character_class?.name),
    guild:        bnetStr(profile.guild?.name),
    faction:      profile.faction?.type || '',
    level:        profile.level || 0,
    mythicRating,
    mythicColor,
    pvpRating,
    pvpBracket,
    weeklyRuns,
    gearItems,
    raidKills,
    portrait,
    renderUrl,
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

  let res;
  try {
    res = await fetch(`${apiBase}/profile/user/wow?locale=en_US`, {
      headers: {
        'Authorization':       `Bearer ${accessToken}`,
        'Battlenet-Namespace': `profile-${region}`,
      },
    });
  } catch (_) {
    return new Response('Battle.net unreachable', { status: 502 });
  }

  if (res.status === 401) {
    // Access token rejected by Battle.net: evict it so re-login prompts correctly
    await env.USER_DATA.delete('token:' + payload.sub);
    return new Response('Token expired', { status: 401 });
  }
  if (!res.ok) return new Response('Battle.net API error: ' + res.status, { status: 502 });

  // locale=en_US makes name fields strings, but guard against object form just in case
  const bnetStr = v => (typeof v === 'string' ? v : v?.en_US ?? v?.name ?? '');

  let data;
  try { data = await res.json(); }
  catch (_) { return new Response('Battle.net returned invalid JSON', { status: 502 }); }

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

// ── Collections via Battle.net ───────────────────────────────────────────────
//
// Mounts, toys and achievements, so the collectibles section can tick itself.
// Account-wide rather than per character, which is why it is one endpoint and
// not part of /api/armory.
//
// Matched on name downstream, not id: the addon reads C_MountJournal, this
// reads the profile API, and the two share no id space. Both agree on names,
// and the site's task entries already carry the name.

async function handleGetCollections(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return privateText('Unauthorized', 401);
  if (!env.USER_DATA) return privateJson({ unavailable: true });

  const accessToken = await env.USER_DATA.get('token:' + payload.sub);
  if (!accessToken) return privateText('Token expired', 401);

  const region  = payload.region || 'us';
  const apiBase = `https://${region}.api.blizzard.com`;
  const headers = {
    'Authorization':       `Bearer ${accessToken}`,
    'Battlenet-Namespace': `profile-${region}`,
  };

  // Collections change slowly and this is three requests, so it is cached for
  // an hour against the member's own key rather than re-fetched on every page
  // load. The addon covers the gap: it reports a drop the moment it lands.
  const cacheKey = 'collections:' + payload.sub;
  const cached = await env.USER_DATA.get(cacheKey, { type: 'json' });
  if (cached && cached.lastSync && Date.now() - cached.lastSync < 3600 * 1000) {
    return privateJson(cached);
  }

  const [mountsRes, toysRes] = await Promise.all([
    fetch(`${apiBase}/profile/user/wow/collections/mounts?locale=en_US`, { headers }),
    fetch(`${apiBase}/profile/user/wow/collections/toys?locale=en_US`,   { headers }),
  ]);

  if (mountsRes.status === 401) {
    await env.USER_DATA.delete('token:' + payload.sub);
    return privateText('Token expired', 401);
  }

  const bnetStr = v => (typeof v === 'string' ? v : v?.en_US ?? '');

  let mounts = [];
  if (mountsRes.ok) {
    const data = await mountsRes.json().catch(() => null);
    mounts = (data?.mounts || [])
      .map(m => bnetStr(m.mount?.name))
      .filter(Boolean);
  }

  let toys = [];
  if (toysRes.ok) {
    const data = await toysRes.json().catch(() => null);
    toys = (data?.toys || []).map(t => bnetStr(t.toy?.name)).filter(Boolean);
  }

  // Achievements are per character, not per account, so this needs one to ask
  // about. The member's highest-level character is the best proxy for "the one
  // that has the account-wide achievements", and account-wide is what the
  // collectibles section is asking about anyway.
  let achievements = [];
  const charRes = await fetch(`${apiBase}/profile/user/wow?locale=en_US`, { headers });
  if (charRes.ok) {
    const account = await charRes.json().catch(() => null);
    const best = (account?.wow_accounts || [])
      .flatMap(a => a.characters || [])
      .sort((a, b) => (b.level || 0) - (a.level || 0))[0];
    if (best?.realm?.slug && best?.name) {
      const achRes = await fetch(
        `${apiBase}/profile/wow/character/${encodeURIComponent(best.realm.slug)}/`
        + `${encodeURIComponent(best.name.toLowerCase())}/achievements?locale=en_US`,
        { headers });
      if (achRes.ok) {
        const data = await achRes.json().catch(() => null);
        achievements = (data?.achievements || [])
          .filter(a => a.completed_timestamp)
          .map(a => a.id)
          .filter(id => typeof id === 'number');
      }
    }
  }

  const result = { mounts, toys, achievements, lastSync: Date.now() };
  await env.USER_DATA.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });
  return privateJson(result);
}

// ── Consent ──────────────────────────────────────────────────────────────────
//
// What Tabard is allowed to read, decided by the member and by nobody else.
// Absent means every scope is off, so a member who has never seen this screen
// is not sharing anything.

const CONSENT_SCOPES = ['agenda.weekly', 'rating.self', 'rating.profile'];

// Nothing behind /api/consent, /api/ledger or /api/share may be cached.
//
// The refusals are the reason. A 403 from a share endpoint says "this member
// has not granted that scope", and a cached one keeps saying it after they
// have, which surfaces in Discord as a bug in Tabard rather than as a stale
// answer. Successful reads are per-member data and equally have no business
// in a shared cache. Tabard does its own caching, deliberately and with a
// TTL it controls.
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

function privateJson(body, init) {
  return Response.json(body, { ...init, headers: { ...NO_STORE, ...(init?.headers || {}) } });
}

function privateText(body, status) {
  return new Response(body, { status, headers: NO_STORE });
}

function emptyConsent() {
  return {
    v: 1,
    updated: 0,
    scopes: Object.fromEntries(CONSENT_SCOPES.map(k => [k, false])),
    discord: null,
  };
}

async function readConsent(env, sub) {
  if (!env.USER_DATA) return emptyConsent();
  const raw = await env.USER_DATA.get('consent:' + sub, { type: 'json' });
  if (!raw) return emptyConsent();
  // Normalise rather than trust: a scope added after a record was written
  // must read as false, not undefined.
  const consent = emptyConsent();
  consent.updated = raw.updated || 0;
  consent.discord = raw.discord || null;
  for (const scope of CONSENT_SCOPES) consent.scopes[scope] = raw.scopes?.[scope] === true;
  return consent;
}

async function handleGetConsent(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return privateText('Unauthorized', 401);
  return privateJson(await readConsent(env, payload.sub));
}

async function handlePutConsent(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return privateText('Unauthorized', 401);
  if (!env.USER_DATA) return privateText('KV not configured', 503);

  let body;
  try { body = await request.json(); } catch (_) { return privateText('Bad JSON', 400); }

  const consent = await readConsent(env, payload.sub);
  for (const scope of CONSENT_SCOPES) {
    if (typeof body?.scopes?.[scope] === 'boolean') consent.scopes[scope] = body.scopes[scope];
  }
  consent.updated = Date.now();

  await env.USER_DATA.put('consent:' + payload.sub, JSON.stringify(consent));
  return privateJson(consent);
}

// ── Ledger upload ────────────────────────────────────────────────────────────
//
// Envelope shapes this worker accepts, and the version that goes with each.
// Mirrors LEDGER_FORMATS in js/ledger.js: the browser decodes and checks the
// envelope before it gets here, but the worker is a public endpoint and does
// not get to assume that.
const LEDGER_FORMATS = { PLW1: 1, PLW2: 2 };

//
// The decoded envelope, so Tabard can read it without the member's browser
// being open. Stored under its own key rather than inside the localStorage
// blob: it has a different shape, a different lifetime, and revoking it
// should be one delete.

async function handlePutLedger(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return privateText('Unauthorized', 401);
  if (!env.USER_DATA) return privateText('KV not configured', 503);

  let body;
  try { body = await request.json(); } catch (_) { return privateText('Bad JSON', 400); }
  // Checked as a pair, and against the same table the browser uses. The
  // envelope arrives already decoded, so the transport prefix and the
  // compression are the browser's business and never reach here; what has to
  // agree is the document shape.
  if (!body || LEDGER_FORMATS[body.fmt] !== body.v) {
    return privateText('Not a Party Ledger envelope this site reads', 400);
  }

  // Bounded on the way in. A member with a very large ledger should get a
  // clear rejection rather than a KV write that fails opaquely later.
  const serialized = JSON.stringify({ ...body, storedAt: Date.now() });
  if (serialized.length > 900 * 1024) {
    return privateText('Envelope too large; turn off grade sharing in the addon', 413);
  }

  await env.USER_DATA.put('ledger:' + payload.sub, serialized);
  return privateJson({ ok: true, storedAt: Date.now() });
}

async function handleGetLedger(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return privateText('Unauthorized', 401);
  if (!env.USER_DATA) return privateJson({ unavailable: true });
  const raw = await env.USER_DATA.get('ledger:' + payload.sub);
  return privateJson(raw ? JSON.parse(raw) : null);
}

async function handleDeleteLedger(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return privateText('Unauthorized', 401);
  if (!env.USER_DATA) return privateText('KV not configured', 503);
  await env.USER_DATA.delete('ledger:' + payload.sub);
  return privateJson({ ok: true });
}

// ── Share API ────────────────────────────────────────────────────────────────
//
// Read by Tabard, on the member's behalf. Two independent gates, and both have
// to pass:
//
//   1. The service token proves the caller is Tabard. It does not authorize
//      anything on its own.
//   2. The member's consent record says whether this particular scope is
//      readable. Absent record means no.
//
// A refusal names the scope, so Tabard can tell the member which switch to
// flip rather than reporting a generic failure.

function serviceAuthorized(request, env) {
  const expected = env.AGENDA_SERVICE_TOKEN;
  // No token configured means the share API is off, not open.
  if (!expected) return false;
  const header = request.headers.get('Authorization') || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  return presented.length > 0 && timingSafeEqual(presented, expected);
}

// Comparison in time independent of where the strings first differ. A plain
// === leaks the shared secret one byte at a time to anyone who can measure
// the response.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function scopeDenied(scope) {
  return privateJson(
    { error: 'scope_denied', scope,
      message: `The member has not shared ${scope}. They can turn it on under `
             + `Account, "Share with Discord", on The Azeroth Agenda.` },
    { status: 403 });
}

async function shareContext(request, env) {
  if (!serviceAuthorized(request, env)) {
    return { error: privateText('Unauthorized', 401) };
  }
  if (!env.USER_DATA) {
    return { error: privateText('KV not configured', 503) };
  }
  const sub = new URL(request.url).searchParams.get('sub');
  if (!sub) return { error: privateText('Missing sub', 400) };

  return { sub, consent: await readConsent(env, sub) };
}

// Weekly objective completion for one member, per character.
async function handleShareAgenda(request, env) {
  const ctx = await shareContext(request, env);
  if (ctx.error) return ctx.error;
  if (!ctx.consent.scopes['agenda.weekly']) return scopeDenied('agenda.weekly');

  const raw = await env.USER_DATA.get('user:' + ctx.sub);
  const blob = raw ? JSON.parse(raw) : {};
  const weekKey = getWowWeekKey(readResetAnchor(blob));

  const characters = (blob['wow_midnight_chars'] || []).map((charName) => {
    const done   = blob['wow_mn_' + charName + '_' + weekKey] || {};
    const goals  = blob['wow_mn_goals_' + charName + '_' + weekKey] || {};
    const hidden = blob['wow_mn_hidden_' + charName] || {};
    const list   = blob['wow_mn_yourlist_' + charName] || [];
    const src    = blob['wow_mn_autosrc_' + charName + '_' + weekKey] || {};

    // "Your List" is the member's own curated set, which is a far better
    // denominator than the whole checklist: nobody does all of it, so a
    // percentage against everything is always low and never means anything.
    const tracked = list.filter((id) => !hidden[id]);
    const doneIds = tracked.filter((id) => done[id]);

    return {
      name: charName,
      realm: blob['wow_mn_realmslug_' + charName] || null,
      className: (blob['wow_mn_armory_' + charName] || {}).className || null,
      ilvl: (blob['wow_mn_armory_' + charName] || {}).ilvl || null,
      mythicRating: (blob['wow_mn_armory_' + charName] || {}).mythicRating || null,
      tracked: tracked.length,
      done: doneIds.length,
      // Enough to render a card without Tabard needing the task list.
      items: tracked.map((id) => ({
        id, done: !!done[id], value: goals[id] ?? null, source: src[id] || null,
      })),
    };
  }).filter((c) => c.tracked > 0);

  const ledgerRaw = await env.USER_DATA.get('ledger:' + ctx.sub);
  const ledger = ledgerRaw ? JSON.parse(ledgerRaw) : null;

  return privateJson({
    week: weekKey,
    characters,
    ledger: ledger ? { generated: ledger.generated, addon: ledger.addon } : null,
  });
}

// What the member thought of one player, read back to the member. Never to
// anyone else: this endpoint answers only for the ledger belonging to `sub`,
// and Tabard only ever calls it with the sub of the person who ran the command.
async function handleShareRating(request, env) {
  const ctx = await shareContext(request, env);
  if (ctx.error) return ctx.error;
  if (!ctx.consent.scopes['rating.self']) return scopeDenied('rating.self');

  const player = (new URL(request.url).searchParams.get('player') || '').trim().toLowerCase();
  if (!player) return privateText('Missing player', 400);

  const raw = await env.USER_DATA.get('ledger:' + ctx.sub);
  if (!raw) return privateJson({ found: false, reason: 'no_ledger' });

  const ledger = JSON.parse(raw);
  const recent = ledger?.ratings?.recent || [];

  // Name, or name-realm. Realms are matched loosely because the addon
  // normalises them and the member will type them however they like.
  const norm = (s) => String(s || '').toLowerCase().replace(/[\s'’-]/g, '');
  const wanted = norm(player.split('-')[0]);
  const wantedRealm = player.includes('-') ? norm(player.split('-').slice(1).join('-')) : null;

  const matches = recent.filter((r) => {
    if (norm(r.name) !== wanted) return false;
    return !wantedRealm || norm(r.realm) === wantedRealm;
  });

  return privateJson({
    found: matches.length > 0,
    generated: ledger.generated,
    matches: matches.slice(0, 5),
  });
}

// The member's own grading profile. Says something about how they grade, and
// nothing about anyone they graded. There is deliberately no endpoint that
// answers "what does the guild think of player X"; see INTEGRATION.md.
async function handleShareProfile(request, env) {
  const ctx = await shareContext(request, env);
  if (ctx.error) return ctx.error;
  if (!ctx.consent.scopes['rating.profile']) return scopeDenied('rating.profile');

  const raw = await env.USER_DATA.get('ledger:' + ctx.sub);
  if (!raw) return privateJson({ found: false, reason: 'no_ledger' });

  const ledger = JSON.parse(raw);
  const ratings = ledger?.ratings;
  if (!ratings) return privateJson({ found: false, reason: 'ratings_not_shared' });

  return privateJson({
    found: true,
    generated: ledger.generated,
    authored: ratings.authored || 0,
    runs: ratings.runs || 0,
    byGrade: ratings.byGrade || {},
  });
}

// Records which Discord account is bound to this Battle.net sub, for the
// member's own audit trail. Does not grant anything: consent is still the
// only thing the share endpoints read.
async function handleShareBind(request, env) {
  if (!serviceAuthorized(request, env)) return privateText('Unauthorized', 401);
  if (!env.USER_DATA) return privateText('KV not configured', 503);

  let body;
  try { body = await request.json(); } catch (_) { return privateText('Bad JSON', 400); }
  if (!body?.sub || !body?.discord) return privateText('Missing sub or discord', 400);

  const consent = await readConsent(env, body.sub);
  consent.discord = String(body.discord);
  await env.USER_DATA.put('consent:' + body.sub, JSON.stringify(consent));
  return privateJson({ ok: true, scopes: consent.scopes });
}

// ── Cloud data sync (KV) ─────────────────────────────────────────────────────

async function handleGetData(request, env) {
  const payload = await verifyJWT(getSessionCookie(request), env.SESSION_SECRET);
  if (!payload) return new Response('Unauthorized', { status: 401 });
  if (!env.USER_DATA) return Response.json({ _sync_unavailable: true });
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

async function handleResetTime(request, env) {
  const region   = new URL(request.url).searchParams.get('region') || 'us';
  const cacheKey = `__reset_time_${region}__`;

  const cached = await env.USER_DATA.get(cacheKey, { type: 'json' });
  if (cached?.end_timestamp && cached.end_timestamp > Date.now()) {
    return Response.json(cached);
  }

  const token = await getClientToken(env);
  if (!token) return new Response('API unavailable', { status: 502 });

  const apiBase = `https://${region}.api.blizzard.com`;
  const headers = {
    'Authorization':       `Bearer ${token}`,
    'Battlenet-Namespace': `dynamic-${region}`,
  };

  const indexRes = await fetch(`${apiBase}/data/wow/mythic-keystone/period/index?locale=en_US`, { headers });
  if (!indexRes.ok) return new Response('API unavailable', { status: 502 });
  const index = await indexRes.json();
  const periodId = index.current_period?.id;
  if (!periodId) return new Response('No current period', { status: 502 });

  const periodRes = await fetch(`${apiBase}/data/wow/mythic-keystone/period/${periodId}?locale=en_US`, { headers });
  if (!periodRes.ok) return new Response('API unavailable', { status: 502 });
  const period = await periodRes.json();

  const result = {
    end_timestamp:   period.end_timestamp,
    start_timestamp: period.start_timestamp,
    period_id:       periodId,
    region,
  };
  await env.USER_DATA.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 });
  return Response.json(result);
}

async function handleItemIconsCache(request, env) {
  const raw = await env.USER_DATA.get('__item_icons__');
  return Response.json(raw ? JSON.parse(raw) : {});
}

async function handleItemIconsById(request, env) {
  let items;
  try { ({ items } = await request.json()); } catch (_) { return Response.json({}); }
  if (!Array.isArray(items) || !items.length) return Response.json({});

  const token = await getClientToken(env);
  if (!token) return Response.json({});

  const apiBase = 'https://us.api.blizzard.com';
  const headers = {
    'Authorization':       `Bearer ${token}`,
    'Battlenet-Namespace': 'static-us',
  };

  const results = {};
  await Promise.all(items.slice(0, 40).map(async ({ name, id }) => {
    try {
      const res = await fetch(
        `${apiBase}/data/wow/media/item/${id}?locale=en_US`,
        { headers }
      );
      if (!res.ok) return;
      const data = await res.json();
      const icon = data.assets?.find(a => a.key === 'icon')?.value;
      if (icon) results[name.toLowerCase()] = icon;
    } catch (_) {}
  }));

  if (Object.keys(results).length) {
    const existing = await env.USER_DATA.get('__item_icons__');
    const merged = Object.assign(existing ? JSON.parse(existing) : {}, results);
    await env.USER_DATA.put('__item_icons__', JSON.stringify(merged));
  }

  return Response.json(results);
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
    if (pathname === '/api/collections') return handleGetCollections(request, env);
    if (pathname === '/api/consent') {
      if (request.method === 'GET') return handleGetConsent(request, env);
      if (request.method === 'PUT') return handlePutConsent(request, env);
    }
    if (pathname === '/api/ledger') {
      if (request.method === 'GET')    return handleGetLedger(request, env);
      if (request.method === 'PUT')    return handlePutLedger(request, env);
      if (request.method === 'DELETE') return handleDeleteLedger(request, env);
    }
    // Service to service, for Tabard. Authenticated by a shared secret and
    // authorized by the member's consent record, separately.
    if (pathname === '/api/share/agenda'  && request.method === 'GET')  return handleShareAgenda(request, env);
    if (pathname === '/api/share/rating'  && request.method === 'GET')  return handleShareRating(request, env);
    if (pathname === '/api/share/profile' && request.method === 'GET')  return handleShareProfile(request, env);
    if (pathname === '/api/share/bind'    && request.method === 'POST') return handleShareBind(request, env);
    if (pathname === '/api/data') {
      if (request.method === 'GET') return handleGetData(request, env);
      if (request.method === 'PUT') return handlePutData(request, env);
    }
    if (pathname === '/api/reset-time'        && request.method === 'GET')  return handleResetTime(request, env);
    if (pathname === '/api/item-icons-cache'  && request.method === 'GET')  return handleItemIconsCache(request, env);
    if (pathname === '/api/item-icons'        && request.method === 'POST') return handleItemIcons(request, env);
    if (pathname === '/api/item-icons-by-id'  && request.method === 'POST') return handleItemIconsById(request, env);

    // Fall through to static assets
    return env.ASSETS.fetch(request);
  },
};
