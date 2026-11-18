import { cloud, db } from './store';
import { getSettings } from './shopSettings';
import { nextOrderNumber } from './orderNumbers';
import { cartLines } from './orderingRules';

const demoOrders = 'nawba-demo-v1';
const readDemoOrders = () => JSON.parse(localStorage.getItem(demoOrders) || '[]');
const saveDemoOrders = (rows) => {
  localStorage.setItem(demoOrders, JSON.stringify(rows));
  window.dispatchEvent(new Event('nawba-change'));
};

// Customer: send the cart. requestKey makes a retried "send" return the same order.
export async function placeOrder({ branch, mode, cart, menu, details, requestKey }) {
  const lines = cartLines(cart);
  if (!cloud) {
    const settings = await getSettings();
    if (!settings.ordering_enabled || !(settings.ordering_modes || []).includes(mode))
      return { error: 'closed' };
    const rows = readDemoOrders();
    const existing = rows.find((o) => o.online_request_key === requestKey);
    if (existing) return { token: existing.token, number: existing.number };
    const items = new Map((menu?.sections || []).flatMap((s) => s.items.map((i) => [i.id, i])));
    const picked = [];
    let total = 0;
    for (const { id, qty } of lines) {
      const item = items.get(id);
      if (!item) return { error: 'invalid' };
      if (!item.available) return { error: 'sold_out', item: item.name };
      picked.push({ name: item.name, qty, price: item.price });
      total += Number(item.price || 0) * qty;
    }
    const order = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      number: nextOrderNumber(rows),
      status: 'preparing',
      created_at: new Date().toISOString(),
      guest_name: details.name?.trim() || null,
      order_mode: mode,
      order_details: {
        items: picked,
        total,
        note: details.note?.trim() || '',
        table: details.table?.trim() || null,
        plate: details.plate?.trim() || null,
        color: details.color?.trim() || null,
      },
      online_request_key: requestKey,
      accepted_at: null,
    };
    saveDemoOrders([order, ...rows]);
    return { token: order.token, number: order.number };
  }
  const { data, error } = await db.rpc('place_order', {
    branch,
    mode,
    lines,
    details,
    request_key: requestKey,
  });
  if (error) throw error;
  return data;
}

// Staff: «قبول» an online order.
export async function acceptOnlineOrder(orderId) {
  if (!cloud) {
    const rows = readDemoOrders();
    saveDemoOrders(
      rows.map((o) =>
        o.id === orderId && o.order_mode && !o.accepted_at
          ? { ...o, accepted_at: new Date().toISOString() }
          : o,
      ),
    );
    return true;
  }
  const { data, error } = await db.rpc('accept_online_order', { target: orderId });
  if (error) throw error;
  return data;
}

// Demo mode only: the customer page reads the order's online details.
export function demoOnlineDetails(orderId) {
  const order = readDemoOrders().find((o) => o.id === orderId);
  return order?.order_mode
    ? { mode: order.order_mode, accepted: Boolean(order.accepted_at), details: order.order_details }
    : null;
}
