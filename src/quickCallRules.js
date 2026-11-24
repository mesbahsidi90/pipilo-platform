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
