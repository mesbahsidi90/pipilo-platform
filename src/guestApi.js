import { cloud, db, listOrders, sandbox, track } from './store';
import { queueCompare } from './clinicRules';
import { getSettings } from './shopSettings';
import { demoOnlineDetails } from './ordering';
const key = 'bippo-guest-signals';
const feedbackKey = 'bipilo-demo-order-feedback';
const ratingsKey = 'bipilo-demo-order-ratings';
const readRatings = () => JSON.parse(localStorage.getItem(ratingsKey) || '{}');
const readFeedback = () => JSON.parse(localStorage.getItem(feedbackKey) || '{}');
const read = () => JSON.parse(localStorage.getItem(key) || '{}');
export function demoSignals() {
  return read();
}
export async function signalGuest(ticket, event) {
  if (!cloud) {
    const order = await track(ticket);
    if (!order) return false;
    if (['coming', 'ready_seen'].includes(event) && order.status !== 'ready') return false;
    if (order.status === 'collected') return false;
    const map = {
      opened: 'opened_at',
      heartbeat: 'last_seen_at',
      sound_enabled: 'sound_enabled_at',
      push_enabled: 'push_enabled_at',
      ready_seen: 'ready_seen_at',
      coming: 'coming_at',
      game: 'game_played_at',
    };
    if (!map[event]) return false;
    const all = read(),
      s = all[order.id] || {},
      now = new Date().toISOString();
    s.opened_at ||= now;
    s[map[event]] ||= now;
    s.last_seen_at = now;
    all[order.id] = s;
    localStorage.setItem(key, JSON.stringify(all));
    window.dispatchEvent(new Event('nawba-change'));
    return true;
  }
  const { data, error } = await db.rpc('guest_order_signal', { ticket, event_name: event });
  if (error) throw error;
  return data;
}
export async function guestExtras(ticket) {
  if (!cloud) {
    const o = await track(ticket);
    if (!o) return null;
    const settings = await getSettings();
    return {
      coming_at: read()[o.id]?.coming_at || null,
      google_review_url: o.status === 'collected' ? settings.google_review_url : '',
      private_feedback_enabled:
        o.status === 'collected' && Boolean(settings.private_feedback_enabled),
      feedback_sent: Boolean(readFeedback()[o.id]),
      rating: readRatings()[o.id]?.stars || null,
      room: o.status === 'ready' ? o.room || null : null,
      queue: await (async () => {
        if (settings.kind !== 'clinic' || o.status !== 'preparing') return null;
        const since = (row) => row.restored_at || row.created_at;
        const day = Date.now() - 86400000;
        const rows = (await listOrders()).filter(
          (row) => row.status === 'preparing' && Date.parse(since(row)) > day,
        );
        return {
          ahead: rows.filter((row) => row.id !== o.id && queueCompare(row, o) < 0).length,
          priority: Boolean(o.priority),
          minutes_each: null,
        };
      })(),
      online: (() => {
        const online = demoOnlineDetails(o.id);
        return online && { ...online, currency: settings.menu_currency || 'DZD' };
      })(),
    };
  }
  const { data, error } = await db.rpc('guest_order_extras', { ticket });
  if (error) throw error;
  return data;
}
export async function submitOrderFeedback(ticket, message) {
  const comment = message.trim();
  if (!comment || Array.from(comment).length > 500) return false;
  if (!cloud) {
    const [order, settings] = await Promise.all([track(ticket), getSettings()]);
    if (order?.status !== 'collected' || !settings.private_feedback_enabled) return false;
    const feedback = readFeedback();
    feedback[order.id] ||= {
      order_id: order.id,
      number: order.number,
      comment,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(feedbackKey, JSON.stringify(feedback));
    return true;
  }
  const { data, error } = await db.rpc('submit_order_feedback', { ticket, message: comment });
  if (error) throw error;
  return data;
}

export async function branchOrderFeedback() {
  if (!cloud)
    return Object.values(readFeedback())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 100);
  const { data, error } = await db.rpc('branch_order_feedback');
  if (error) throw error;
  return data || [];
}
// One bounded guest payload; no subscription addresses, staff identity or other orders.
export async function staffSignals(ids = []) {
  if (!cloud) {
    const local = read();
    if (!sandbox) return local;
    try {
      const remote = await (await import('./trialSync')).trialSignals();
      for (const order of await listOrders()) {
        const signal = remote[order.token];
        if (signal) local[order.id] = { ...local[order.id], ...signal };
      }
    } catch {
      // The board keeps the local signals.
    }
    return local;
  }
  const { data: shop, error: e } = await db.rpc('current_shop_id');
  if (e) throw e;
  if (!shop || !ids.length) return {};
  const { data, error } = await db
    .from('order_guest_signals')
    .select(
      'order_id,opened_at,sound_enabled_at,push_enabled_at,ready_seen_at,coming_at,last_seen_at,push_sent_at,push_delivered_at',
    )
    .eq('shop_id', shop)
    .in('order_id', ids)
    .limit(200);
  if (error) throw error;
  return Object.fromEntries(data.map((s) => [s.order_id, s]));
}

export async function rateOrder(ticket, stars) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return false;
  if (!cloud) {
    const order = await track(ticket);
    if (order?.status !== 'collected') return false;
    const ratings = readRatings();
    ratings[order.id] ||= { stars, created_at: new Date().toISOString() };
    localStorage.setItem(ratingsKey, JSON.stringify(ratings));
    return true;
  }
  const { data, error } = await db.rpc('rate_order', { ticket, stars });
  if (error) throw error;
  return data;
}

// Ratings and alert reach for the current branch over a report period.
export async function branchGuestInsights({ from, to }) {
  if (!cloud) {
    const values = Object.values(readRatings()).filter(
      (r) => r.created_at >= from && r.created_at < to,
    );
    const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    values.forEach((r) => (stars[r.stars] += 1));
    const total = values.reduce((sum, r) => sum + r.stars, 0);
    return {
      ratings: {
        count: values.length,
        average: values.length ? Math.round((total / values.length) * 100) / 100 : null,
        stars,
      },
      alerts: null,
    };
  }
  const { data, error } = await db.rpc('branch_guest_insights', { since: from, until: to });
  if (error) throw error;
  return data;
}
