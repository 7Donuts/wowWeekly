export async function onRequestGet({ env, request }) {
  const state       = crypto.randomUUID();
  const redirectUri = new URL('/auth/callback', new URL(request.url).origin).href;

  const params = new URLSearchParams({
    client_id:     env.BNET_CLIENT_ID,
    scope:         'openid',
    redirect_uri:  redirectUri,
    response_type: 'code',
    state,
  });

  const headers = new Headers({
    Location:   `https://oauth.battle.net/authorize?${params}`,
    'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
  });

  return new Response(null, { status: 302, headers });
}
