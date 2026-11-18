// Next order number for the "auto number" button: one more than the highest
// number used today (local day), wrapping after 9999 and skipping numbers that
// are still active.
const ACTIVE = new Set(['preparing', 'ready']);

export function nextOrderNumber(orders, now = new Date()) {
  const today = now.toDateString();
  const used = new Set();
  let highest = 0;
  for (const order of orders || []) {
    const n = Number.parseInt(order.number, 10);
    if (!Number.isFinite(n)) continue;
    if (ACTIVE.has(order.status)) used.add(n);
    if (new Date(order.created_at).toDateString() === today) highest = Math.max(highest, n);
  }
  let next = highest + 1;
  for (let i = 0; i < 9999; i++) {
    if (next > 9999) next = 1;
    if (!used.has(next)) return String(next);
    next++;
  }
  return null;
}
