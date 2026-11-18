// Pure rules for ordering from the phone, shared by the UI, demo and tests.
export const ORDER_MODES = ['pickup', 'table', 'car'];
export const MAX_QTY = 20;
export const MAX_LINES = 30;

// cart: { [itemId]: qty } → lines for place_order.
export function cartLines(cart) {
  return Object.entries(cart || {})
    .filter(([, qty]) => qty > 0)
    .slice(0, MAX_LINES)
    .map(([id, qty]) => ({ id, qty: Math.min(MAX_QTY, qty) }));
}

export function changeQty(cart, id, delta) {
  const next = { ...cart };
  const qty = Math.max(0, Math.min(MAX_QTY, (next[id] || 0) + delta));
  if (qty) next[id] = qty;
  else delete next[id];
  return next;
}

// Count and estimated total of the cart against the menu (server recomputes).
export function cartSummary(cart, menu) {
  const items = new Map(
    (menu?.sections || []).flatMap((s) => (s.items || []).map((i) => [i.id, i])),
  );
  let count = 0;
  let total = 0;
  for (const { id, qty } of cartLines(cart)) {
    const item = items.get(id);
    if (!item?.available) continue;
    count += qty;
    total += Number(item.price || 0) * qty;
  }
  return { count, total };
}

// Which details each mode needs before sending.
export function checkoutProblem(mode, { lines = [], note = '', table = '', plate = '' } = {}) {
  if (!ORDER_MODES.includes(mode)) return 'mode';
  if (!lines.length && !note.trim()) return 'empty';
  if (mode === 'table' && !table.trim()) return 'table';
  if (mode === 'car' && !plate.trim()) return 'plate';
  return null;
}

export const MAX_TABLE_CODES = 60;

// Table numbers for a printed QR sheet: whole numbers from..to, at most 60.
export function tableRange(from, to) {
  const start = Math.max(1, Math.floor(Number(from)) || 1);
  const end = Math.min(9999, Math.floor(Number(to)) || start);
  if (end < start) return [];
  return Array.from({ length: Math.min(end - start + 1, MAX_TABLE_CODES) }, (_, i) => start + i);
}

// Menu link that opens with this table already chosen.
export function tableMenuLink(base, table) {
  const url = new URL(base);
  url.searchParams.set('mode', 'table');
  url.searchParams.set('table', String(table));
  return url.href;
}
