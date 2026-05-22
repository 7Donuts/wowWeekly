import { setSessionCookie } from '../_shared/jwt.js';

export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  return new Response(null, {
    status: 302,
    headers: {
      Location:     origin,
      'Set-Cookie': setSessionCookie('', true),
    },
  });
}
