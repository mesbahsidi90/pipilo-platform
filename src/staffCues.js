// Decides when the merchant dashboard should make a sound:
//  - "coming": the customer pressed «راني جاي» since the last refresh.
//  - "unreached": an order has been ready for a while and the customer has
//    neither opened it, seen it ready, nor said they are coming.
export const UNREACHED_AFTER_MS = 60_000;

export function staffCues(previous, orders, now = Date.now()) {
  const known = previous || { coming: new Set(), unreached: new Set() };
  const coming = [];
  const unreached = [];
  const nextComing = new Set();
  const nextUnreached = new Set();
  for (const order of orders || []) {
    if (order.status !== 'ready') continue;
    const guest = order.guest || {};
    if (guest.coming_at) {
      nextComing.add(order.id);
      if (previous && !known.coming.has(order.id)) coming.push(order.number);
      continue;
    }
    const readySince = Date.parse(order.ready_at || '');
    const silent = !guest.ready_seen_at && !guest.push_enabled_at;
    if (silent && Number.isFinite(readySince) && now - readySince >= UNREACHED_AFTER_MS) {
      nextUnreached.add(order.id);
      if (!known.unreached.has(order.id)) unreached.push(order.number);
    }
  }
  return { coming, unreached, state: { coming: nextComing, unreached: nextUnreached } };
}
