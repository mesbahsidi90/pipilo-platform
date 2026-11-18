import { cloud, db, listOrders, claimLocalCounterTicket } from './store';
import { getSettings } from './shopSettings';

export const counterRoute = shopId => 'counter/' + (shopId || 'local');
export const invoiceRoute = shopId => 'invoice/' + (shopId || 'local');

export function trackingCode(order) {
  const code = order.tracking_code ??
    (!cloud ? order.token.replaceAll('-', '').slice(0, 12).toUpperCase() : '');
  return code.match(/.{4}/g)?.join('-') || '';
}

export function normalizeTrackingCode(value) {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export async function counterTicket(branch, code = null) {
  if (!cloud) {
    if (branch !== 'local') return null;
    const shop = await getSettings();
    if (shop.tracking_mode !== 'counter') return null;
    if (code === null) return { name: shop.name };
    const order = (await listOrders()).find(item =>
      normalizeTrackingCode(trackingCode(item)) === code &&
      Date.parse(item.created_at) > Date.now() - 86400000
    );
    return order ? { token: order.token } : null;
  }
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(branch)) return null;
  const { data, error } = await db.rpc('counter_ticket', { branch, code });
  if (error) throw error;
  return data;
}

export async function claimCounterTicket(branch, requestKey) {
  if (!cloud) {
    const venue = await counterTicket(branch);
    return venue && { ...venue, token: claimLocalCounterTicket(requestKey) };
  }
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(branch)) return null;
  const { data, error } = await db.rpc('claim_counter_ticket', { branch, request_key: requestKey });
  if (error?.code === 'PGRST202') return counterTicket(branch);
  if (error) throw error;
  return data;
}
