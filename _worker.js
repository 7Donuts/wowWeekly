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

async function handleLogin(request, env) {
  const state       = crypto.randomUUID();
  const redirectUri = new URL('/auth/callback', new URL(request.url).origin).href;

  const params = new URLSearchParams({
    client_id:     env.BNET_CLIENT_ID,
    scope:         'openid',
    redirect_uri:  redirectUri,
    response_type: 'code',
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location:     `https://oauth.battle.net/authorize?${params}`,
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

  const tokenRes = await fetch('https://oauth.battle.net/token', {
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

  const { access_token } = await tokenRes.json();

  const userRes = await fetch('https://oauth.battle.net/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) return new Response('Failed to fetch user info', { status: 502 });

  const user  = await userRes.json();
  const token = await signJWT(
    { sub: String(user.sub), battletag: user.battletag },
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

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/auth/login')    return handleLogin(request, env);
    if (pathname === '/auth/callback') return handleCallback(request, env);
    if (pathname === '/auth/logout')   return handleLogout(request);
    if (pathname === '/api/user')      return handleApiUser(request, env);
    if (pathname === '/api/data') {
      if (request.method === 'GET') return handleGetData(request, env);
      if (request.method === 'PUT') return handlePutData(request, env);
    }

    // Fall through to static assets
    return env.ASSETS.fetch(request);
  },
};
