import { signJWT, setSessionCookie } from '../_shared/jwt.js';

export async function onRequestGet({ env, request }) {
  const url    = new URL(request.url);
  const code   = url.searchParams.get('code');
  const state  = url.searchParams.get('state');
  const origin = url.origin;

  // Validate state to prevent CSRF
  const cookie      = request.headers.get('Cookie') || '';
  const cookieState = cookie.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookieState) {
    return new Response('Invalid OAuth state', { status: 400 });
  }

  // Exchange code for token
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

  if (!tokenRes.ok) {
    return new Response('Token exchange failed', { status: 502 });
  }

  const { access_token } = await tokenRes.json();

  // Fetch Battle.net user info
  const userRes = await fetch('https://oauth.battle.net/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    return new Response('Failed to fetch user info', { status: 502 });
  }

  const user = await userRes.json();

  // Sign a session JWT — store battletag + sub (account ID)
  const token = await signJWT(
    { sub: String(user.sub), battletag: user.battletag },
    env.SESSION_SECRET
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location:   origin,
      'Set-Cookie': setSessionCookie(token),
    },
  });
}
