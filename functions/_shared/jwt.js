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

export async function signJWT(payload, secret, expiresInSeconds = 60 * 60 * 24 * 7) {
  payload = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = b64url(enc.encode(JSON.stringify(payload)));
  const data   = `${header}.${body}`;
  const key    = await hmacKey(secret, 'sign');
  const sig    = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return `${data}.${sig}`;
}

export async function verifyJWT(token, secret) {
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

export function getSessionCookie(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

export function setSessionCookie(token, clear = false) {
  const value   = clear ? '' : token;
  const maxAge  = clear ? 0 : 60 * 60 * 24 * 7;
  return `session=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
}
