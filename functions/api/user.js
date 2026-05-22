import { verifyJWT, getSessionCookie } from '../_shared/jwt.js';

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': 'same-origin',
};

export async function onRequestGet({ env, request }) {
  const token   = getSessionCookie(request);
  const payload = await verifyJWT(token, env.SESSION_SECRET);

  if (!payload) {
    return new Response(JSON.stringify({ user: null }), { status: 200, headers: CORS });
  }

  return new Response(JSON.stringify({
    user: { sub: payload.sub, battletag: payload.battletag },
  }), { status: 200, headers: CORS });
}
