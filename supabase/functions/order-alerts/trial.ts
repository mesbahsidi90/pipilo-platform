// Trial tickets (/jarreb): the trial dashboard lives in the owner's browser and
// mirrors each order here, so a second phone can scan it, enable alerts, ring
// and answer «راني جاي». Tickets expire after 6 hours.
import webpush from 'npm:web-push@3.6.7';
import { uuid, validEndpoint } from './validation.js';
import { orderPayload } from './payload.js';

const kinds = new Set([
  'cafe',
  'restaurant',
  'food_court',
  'laundry',
  'car_wash',
  'tailor',
  'clinic',
  'other',
]);
const statuses = new Set(['preparing', 'ready', 'collected', 'cancelled']);
const signalFields =
  'token,opened_at,last_seen_at,push_enabled_at,push_sent_at,push_delivered_at,ready_seen_at,coming_at';
const take = (r: any) => {
  if (r.error) throw r.error;
  return r.data;
};
const sha = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
const clean = (value: unknown, max: number) =>
  String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
const live = (ticket: any) => ticket && Date.parse(ticket.expires_at) > Date.now();

async function ticketFor(db: any, token: string) {
  if (!uuid.test(token || '')) return null;
  const ticket = take(await db.from('trial_tickets').select('*').eq('token', token).maybeSingle());
  return live(ticket) ? ticket : null;
}

// Ring every phone subscribed to this ticket once.
export async function sendTrial(db: any, ticket: any, cfg: any, ackUrl: string) {
  if (ticket.status !== 'ready') return { sent: 0, failed: 0 };
  const subscriptions = take(
    await db
      .from('trial_push_subscriptions')
      .select('*')
      .eq('token', ticket.token)
      .is('sent_at', null)
      .limit(3),
  );
  let sent = 0,
    failed = 0;
  for (const sub of subscriptions || []) {
    if (!validEndpoint(sub.endpoint)) {
      failed++;
      continue;
    }
    const stamp = new Date().toISOString();
    const claim = take(
      await db
        .from('trial_push_subscriptions')
        .update({ sent_at: stamp })
        .eq('id', sub.id)
        .is('sent_at', null)
        .select('id'),
    );
    if (!claim?.length) continue;
    try {
      const order = { number: ticket.number, token: ticket.token, shops: { kind: ticket.kind } };
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({
          ...orderPayload(
            order,
            'trial',
            sub.language || undefined,
            { name: ticket.shop_name },
            sub.site_origin,
          ),
          ack: ackUrl,
        }),
        {
          TTL: 900,
          urgency: 'high',
          timeout: 8000,
          vapidDetails: {
            subject: cfg.subject,
            publicKey: cfg.public_key,
            privateKey: cfg.private_key,
          },
        },
      );
      sent++;
      await db
        .from('trial_tickets')
        .update({ push_sent_at: stamp })
        .eq('token', ticket.token)
        .is('push_sent_at', null);
    } catch (err: any) {
      failed++;
      if ([404, 410].includes(err.statusCode))
        await db.from('trial_push_subscriptions').delete().eq('id', sub.id);
      else await db.from('trial_push_subscriptions').update({ sent_at: null }).eq('id', sub.id);
    }
  }
  return { sent, failed };
}

export async function handleTrial(
  route: string,
  body: any,
  req: Request,
  db: any,
  cfg: any,
  reply: (data: unknown, status?: number) => Response,
  origin: string | null,
  ackUrl: string,
) {
  const now = new Date().toISOString();

  // Owner's trial dashboard: create or update a mirrored ticket.
  if (route === 'trial-upsert') {
    const session = String(body.session || '');
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(session)) return reply({ error: 'Invalid session' }, 400);
    if (!uuid.test(body.token || '')) return reply({ error: 'Invalid ticket' }, 400);
    const number = clean(body.number, 8);
    const name = clean(body.name, 100) || 'Bipilo';
    const kind = kinds.has(body.kind) ? body.kind : 'cafe';
    const status = statuses.has(body.status) ? body.status : 'preparing';
    if (!number) return reply({ error: 'Invalid number' }, 400);
    const sessionHash = await sha(session);
    const existing = take(
      await db.from('trial_tickets').select('*').eq('token', body.token).maybeSingle(),
    );
    if (existing && existing.session_hash !== sessionHash)
      return reply({ error: 'Not authorized' }, 403);
    const stamps: Record<string, string | null> = {};
    if (status === 'ready' && existing?.status !== 'ready') stamps.ready_at = now;
    if (status === 'collected' && existing?.status !== 'collected') stamps.collected_at = now;
    if (status === 'preparing' && existing && existing.status !== 'preparing')
      Object.assign(stamps, {
        ready_at: null,
        push_sent_at: null,
        push_delivered_at: null,
        ready_seen_at: null,
        coming_at: null,
      });
    if (!existing) {
      // Expired trials go first; then a per-visitor and a global ceiling.
      await db.from('trial_tickets').delete().lt('expires_at', now);
      const source = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'shared';
      const clientHash = await sha(cfg.webhook_secret + source);
      const since = new Date(Date.now() - 6 * 3600000).toISOString();
      const mine = await db
        .from('trial_tickets')
        .select('token', { count: 'exact', head: true })
        .eq('client_hash', clientHash)
        .gte('created_at', since);
      if ((mine.count || 0) >= 300) return reply({ error: 'Too many trial tickets' }, 429);
      const all = await db.from('trial_tickets').select('token', { count: 'exact', head: true });
      if ((all.count || 0) >= 20000) return reply({ error: 'Trial is busy' }, 503);
      take(
        await db.from('trial_tickets').insert({
          token: body.token,
          session_hash: sessionHash,
          client_hash: clientHash,
          number,
          shop_name: name,
          kind,
          status,
          ...stamps,
        }),
      );
      return reply({ ok: true });
    }
    take(
      await db
        .from('trial_tickets')
        .update({ number, shop_name: name, kind, status, ...stamps })
        .eq('token', body.token),
    );
    if (status === 'preparing' && existing.status !== 'preparing')
      await db.from('trial_push_subscriptions').update({ sent_at: null }).eq('token', body.token);
    const delivery =
      status === 'ready' && existing.status !== 'ready'
        ? await sendTrial(db, { ...existing, number, shop_name: name, kind, status }, cfg, ackUrl)
        : null;
    return reply({ ok: true, delivery });
  }

  // Owner's trial dashboard: the customer signals of all its tickets.
  if (route === 'trial-signals') {
    const session = String(body.session || '');
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(session)) return reply({ error: 'Invalid session' }, 400);
    const rows = take(
      await db
        .from('trial_tickets')
        .select(signalFields)
        .eq('session_hash', await sha(session))
        .gt('expires_at', now)
        .limit(300),
    );
    return reply({ signals: rows || [] });
  }

  // Customer's phone.
  const ticket = await ticketFor(db, body.ticket);
  if (!ticket) return reply({ error: 'Ticket unavailable' }, 404);

  if (route === 'trial-track') {
    const patch: Record<string, string> = { last_seen_at: now };
    if (!ticket.opened_at) patch.opened_at = now;
    await db.from('trial_tickets').update(patch).eq('token', ticket.token);
    return reply({
      number: ticket.number,
      status: ticket.status,
      name: ticket.shop_name,
      kind: ticket.kind,
      coming_at: ticket.coming_at,
    });
  }

  if (route === 'trial-signal') {
    const fields: Record<string, string> = { ready_seen: 'ready_seen_at', coming: 'coming_at' };
    const field = fields[body.event];
    if (!field) return reply({ error: 'Invalid event' }, 400);
    if (ticket.status !== 'ready') return reply({ ok: false });
    await db
      .from('trial_tickets')
      .update({ [field]: now, last_seen_at: now })
      .eq('token', ticket.token)
      .is(field, null);
    return reply({ ok: true });
  }

  if (route === 'trial-delivered') {
    if (ticket.status !== 'ready') return reply({ ok: false });
    await db
      .from('trial_tickets')
      .update({ push_delivered_at: now })
      .eq('token', ticket.token)
      .is('push_delivered_at', null);
    await db
      .from('trial_tickets')
      .update({ push_sent_at: now })
      .eq('token', ticket.token)
      .is('push_sent_at', null);
    return reply({ ok: true });
  }

  if (route === 'trial-subscribe') {
    if (['collected', 'cancelled'].includes(ticket.status))
      return reply({ error: 'Ticket unavailable' }, 404);
    const sub = body.subscription;
    if (!sub || !validEndpoint(sub.endpoint)) return reply({ error: 'Invalid endpoint' }, 400);
    if (
      !/^[A-Za-z0-9_-]{80,100}={0,2}$/.test(sub.keys?.p256dh || '') ||
      !/^[A-Za-z0-9_-]{20,30}={0,2}$/.test(sub.keys?.auth || '')
    )
      return reply({ error: 'Invalid subscription keys' }, 400);
    const { count } = await db
      .from('trial_push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('token', ticket.token);
    const language = ['ar', 'fr'].includes(body.language) ? body.language : null;
    if ((count || 0) >= 3) return reply({ error: 'Device limit reached' }, 429);
    take(
      await db.from('trial_push_subscriptions').upsert(
        {
          token: ticket.token,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth_key: sub.keys.auth,
          language,
          site_origin: origin,
        },
        { onConflict: 'token,endpoint' },
      ),
    );
    await db
      .from('trial_tickets')
      .update({ push_enabled_at: now })
      .eq('token', ticket.token)
      .is('push_enabled_at', null);
    const delivery = ticket.status === 'ready' ? await sendTrial(db, ticket, cfg, ackUrl) : null;
    return reply({ ok: true, delivery });
  }

  return reply({ error: 'Not found' }, 404);
}
