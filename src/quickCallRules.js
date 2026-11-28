// «نداء سريع» rules, kept pure for tests.

// Invoice numbers from the till: digits only (Arabic-Indic digits accepted),
// no leading zeros, at most 8 characters.
export function cleanCallNumber(value) {
  const digits = String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
  return digits.slice(0, 8);
}

// What «نادي» does with a number: call a new one, call one already waiting,
// or say it is already on the screen.
export function callAction(rows, number) {
  const open = rows.find(
    (order) => order.number === number && ['preparing', 'ready'].includes(order.status),
  );
  if (!open) return { type: 'create' };
  if (open.status === 'ready') return { type: 'already', order: open };
  return { type: 'ready', order: open };
}

// The numbers on screen, newest call first.
export function calledOrders(rows, limit = 12) {
  return rows
    .filter((order) => order.status === 'ready')
    .sort((a, b) => (Date.parse(b.ready_at || '') || 0) - (Date.parse(a.ready_at || '') || 0))
    .slice(0, limit);
}

// Numbers waiting to be called, first come first: mostly customers who scanned
// the counter QR and typed their invoice number (they are on the alert page).
export function waitingOrders(rows, limit = 24) {
  return rows
    .filter((order) => order.status === 'preparing' && !order.counter_pending)
    .sort((a, b) => (Date.parse(a.created_at || '') || 0) - (Date.parse(b.created_at || '') || 0))
    .slice(0, limit);
}

// «الشاشة متصلة»: the screen counts as connected when it was seen in the last
// 2.5 minutes (it reports about once a minute). Times from the server clock.
export function screenLink(status) {
  if (!status) return { state: 'unknown' };
  if (!status.seen_at) return { state: 'never' };
  const ago = Date.parse(status.now) - Date.parse(status.seen_at);
  if (ago < 150000) return { state: 'on' };
  return { state: 'off', minutes: Math.max(1, Math.round(ago / 60000)) };
}
