// Pure rules for the /jarreb trial board and its server copy.

// Tickets made on a customer's phone (a number taken, a counter order claimed,
// an invoice typed) join the trial board; local orders the server has never
// seen are copied once.
export function mergeTrialTickets(local, remote) {
  const byToken = new Map(local.map((order) => [order.token, order]));
  let changed = false;
  const next = local.map((order) => {
    const row = remote[order.token];
    if (order.counter_pending && row && row.counter_pending === false) {
      changed = true;
      return { ...order, counter_pending: false };
    }
    return order;
  });
  for (const row of Object.values(remote)) {
    if (byToken.has(row.token) || row.origin === 'owner') continue;
    changed = true;
    next.unshift({
      id: crypto.randomUUID(),
      token: row.token,
      number: row.number,
      status: row.status,
      counter_pending: false,
      created_at: row.created_at,
    });
  }
  const missing = local.filter(
    (order) => !remote[order.token] && ['preparing', 'ready'].includes(order.status),
  );
  return { orders: next, changed, missing };
}
