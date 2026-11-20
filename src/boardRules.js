// What the waiting screen shows: the newest call big, a few recent calls, and
// the numbers still in preparation. Old calls leave the screen on their own.

export const READY_KEEP_MS = 10 * 60000; // cafés and restaurants
export const READY_MAX = 6; // the newest call + 5 recent ones
export const CLINIC_CALLS = 4; // clinics keep their last calls, whatever their age

const calledAt = (order) => Date.parse(order.ready_at || '') || 0;

export function boardView(orders = [], { clinic = false, now = Date.now() } = {}) {
  const ready = orders
    .filter((order) => order.status === 'ready')
    .sort((a, b) => calledAt(b) - calledAt(a));
  const shown = clinic
    ? ready.slice(0, CLINIC_CALLS)
    : ready
        .filter((order) => !order.ready_at || now - calledAt(order) <= READY_KEEP_MS)
        .slice(0, READY_MAX);
  const [latest = null, ...recent] = shown;
  return {
    latest,
    recent,
    preparing: orders.filter((order) => order.status === 'preparing'),
    hidden: ready.length - shown.length,
  };
}
