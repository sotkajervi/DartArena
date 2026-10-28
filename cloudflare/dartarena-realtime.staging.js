// STAGING ONLY: Requires room-level authorization before production deployment.
// Cloudflare Worker environment:
//   REALTIME_SFU_APP_ID (variable), REALTIME_SFU_BEARER_TOKEN (secret)
//   SUPABASE_URL (variable), SUPABASE_PUBLISHABLE_KEY (variable).
const SFU_BASE = 'https://rtc.live.cloudflare.com/v1';
const ALLOWED_ORIGINS = new Set([
  'https://sotkajervi.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);
const MAX_BODY_BYTES = 256 * 1024;

function reply(value, status, cors) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function authenticate(request, env) {
  const value = request.headers.get('Authorization') || '';
  if (!/^Bearer [^ ]+$/i.test(value)) return null;
  const token = value.slice(7);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  const url = new URL('/auth/v1/user', env.SUPABASE_URL);
  const response = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token, 'apikey': env.SUPABASE_PUBLISHABLE_KEY },
    redirect: 'error'
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return typeof user?.id === 'string' && user.id ? user.id : null;
}

async function readBody(request) {
  const length = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function sfu(env, path, method, payload, cors) {
  if (!env.REALTIME_SFU_APP_ID || !env.REALTIME_SFU_BEARER_TOKEN) {
    return reply({ ok: false, error: 'SFU not configured' }, 503, cors);
  }
  try {
    const response = await fetch(
      SFU_BASE + '/apps/' + encodeURIComponent(env.REALTIME_SFU_APP_ID) + path,
      {
        method,
        headers: {
          Authorization: 'Bearer ' + env.REALTIME_SFU_BEARER_TOKEN,
          'Content-Type': 'application/json'
        },
        body: payload === undefined ? undefined : JSON.stringify(payload)
      }
    );
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; }
    catch { data = { message: 'SFU returned non-JSON response' }; }
    return reply({ ok: response.ok, status: response.status, sfu: data }, response.status, cors);
  } catch {
    return reply({ ok: false, error: 'SFU request failed' }, 502, cors);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      ...(ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Vary': 'Origin'
    };
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ ok: false, error: 'Origin not allowed' }, 403, cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') {
      return reply({ ok: true, service: 'DartArena Realtime' }, 200, cors);
    }
    let userId;
    try { userId = await authenticate(request, env); }
    catch { return reply({ ok: false, error: 'Authentication unavailable' }, 503, cors); }
    if (!userId) return reply({ ok: false, error: 'Unauthorized' }, 401, cors);

    // IMPORTANT: Valid login does NOT grant permission to publish/subscribe to any session.
    // This prototype must not replace the production Worker until server-side room
    // membership and SFU-session ownership checks are implemented and tested.
    if (env.SFU_ROOM_AUTH_READY !== 'true') {
      return reply({ ok: false, error: 'Room authorization not configured' }, 503, cors);
    }
    // Fail closed rather than exposing SFU controls before the room authorization exists.
    return reply({ ok: false, error: 'Room authorization implementation pending' }, 501, cors);
  }
};
