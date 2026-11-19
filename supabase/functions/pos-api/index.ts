// Bipilo POS API v1: a cashier system creates tickets and marks them
// ready / collected / cancelled with a branch key (Authorization: Bearer bpk_…).
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { bearer, route } from './routes.js';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  // Server-to-server only: browsers must never hold the key.
  if (req.headers.get('origin')) return reply({ error: 'browser_not_allowed' }, 403);
  const path = new URL(req.url).pathname.replace(/^.*?\/pos-api(?=\/|$)/, '');
  const match = route(req.method, path);
  if (!match) return reply({ error: 'not_found' }, 404);
  if (match.error) return reply({ error: 'method_not_allowed' }, match.error);
  const key = bearer(req.headers.get('authorization'));
  if (!key) return reply({ error: 'invalid_key' }, 401);

  let args: Record<string, unknown> = {};
  if (match.action === 'create') {
    try {
      const body = await req.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
      for (const field of ['branchCode', 'number', 'externalRef', 'customerName']) {
        const value = body[field];
        if (value === undefined || value === null) continue;
        if (!['string', 'number'].includes(typeof value))
          return reply({ error: 'invalid_' + field }, 422);
        args[field] = String(value);
      }
    } catch {
      return reply({ error: 'invalid_json' }, 400);
    }
  } else if (match.ticket) {
    args = { ticket: match.ticket };
  }

  try {
    const { data, error } = await db.rpc('pos_api', {
      api_key: key,
      action: match.action,
      args,
    });
    if (error || !data) throw new Error('pos_api failed');
    return reply(data.body, data.status);
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
});
