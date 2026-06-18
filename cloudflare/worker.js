/**
 * WoW Armory Proxy: Cloudflare Worker (optional)
 *
 * Proxies requests to the Raider.IO public API.
 * No API keys or secrets required: deploy and go.
 *
 * Usage:
 *   GET /armory?name=Charname&realm=area-52&region=us
 *
 * Returns JSON: { className, guild, ilvl }
 *
 * NOTE: The app calls Raider.IO directly by default.
 * This Worker is optional: useful if you want caching
 * or a single controlled endpoint for your guild.
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export default {
  async fetch(request, env, ctx) {

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url    = new URL(request.url);
    const name   = (url.searchParams.get('name')   || '').trim();
    const realm  = (url.searchParams.get('realm')  || '').trim();
    const region = (url.searchParams.get('region') || 'us').toLowerCase();

    if (!name || !realm) {
      return json({ error: 'name and realm are required' }, 400);
    }

    // Optional: cache responses for 1 hour to reduce Raider.IO load
    const cacheKey = new Request(
      `https://cache.local/${region}/${realm.toLowerCase()}/${name.toLowerCase()}`,
      request
    );
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return new Response(cached.body, { headers: { ...Object.fromEntries(cached.headers), ...CORS } });

    // Proxy to Raider.IO
    const params = new URLSearchParams({ region, realm, name, fields: 'gear,guild' });
    const rioRes = await fetch('https://raider.io/api/v1/characters/profile?' + params);
    const data   = await rioRes.json();

    if (!rioRes.ok) {
      return json({ error: data.message || 'Character not found' }, rioRes.status);
    }

    const result = {
      className: data.class              || '',
      guild:     data.guild?.name        || '',
      ilvl:      data.gear?.item_level_equipped ?? 0,
    };

    const response = json(result);

    // Cache for 1 hour
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  },
};
