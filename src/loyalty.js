import { cloud, db, track } from './store';
import { getSettings } from './shopSettings';

import { DAILY_STAMP_LIMIT, GIFT_STAMPS, deviceKey, loyaltyProgress } from './loyaltyRules';

export { LOYALTY_GOALS, loyaltyProgress } from './loyaltyRules';

// ---- Browser-only demo (no database): one card per browser. ----
const demoStore = 'bipilo-demo-loyalty';
const readDemo = () => {
  try {
    return {
      links: {},
      stamps: {},
      redemptions: [],
      ...JSON.parse(localStorage.getItem(demoStore) || '{}'),
    };
  } catch {
    return { links: {}, stamps: {}, redemptions: [] };
  }
};
const writeDemo = (value) => localStorage.setItem(demoStore, JSON.stringify(value));
const usedStamps = (state) => state.redemptions.reduce((sum, r) => sum + r.used, 0);
function demoStamp(state, order) {
  if (!['ready', 'collected'].includes(order.status) || state.stamps[order.id]) return;
  const today = new Date().toDateString();
  const todays = Object.values(state.stamps).filter((at) => new Date(at).toDateString() === today);
  if (todays.length < DAILY_STAMP_LIMIT) state.stamps[order.id] = new Date().toISOString();
}

export async function loyaltyCard(ticket) {
  if (!cloud) {
    const [order, settings] = await Promise.all([track(ticket), getSettings()]);
    if (!order || order.status === 'cancelled' || !settings.loyalty_enabled) return null;
    const state = readDemo();
    state.links[order.id] = true;
    demoStamp(state, order);
    writeDemo(state);
    return {
      ...loyaltyProgress({
        stamps: Object.keys(state.stamps).length,
        used: usedStamps(state),
        goal: settings.loyalty_goal || 9,
      }),
      reward: settings.loyalty_reward || '',
      reward_fr: settings.loyalty_reward_fr || '',
      stamped: Boolean(state.stamps[order.id]),
      redeemed: state.redemptions.some((r) => r.order_id === order.id),
    };
  }
  const device = deviceKey();
  if (!device) return null;
  const { data, error } = await db.rpc('loyalty_card', { ticket, device });
  if (error) throw error;
  return data;
}

// Card progress for the dashboard's orders, keyed by order id.
export async function branchLoyalty(orderIds) {
  if (!orderIds.length) return {};
  if (!cloud) {
    const settings = await getSettings();
    if (!settings.loyalty_enabled) return {};
    const state = readDemo();
    const progress = loyaltyProgress({
      stamps: Object.keys(state.stamps).length,
      used: usedStamps(state),
      goal: settings.loyalty_goal || 9,
    });
    return Object.fromEntries(
      orderIds
        .filter((id) => state.links[id])
        .map((id) => [
          id,
          { ...progress, redeemed: state.redemptions.some((r) => r.order_id === id) },
        ]),
    );
  }
  const { data, error } = await db.rpc('branch_loyalty', { order_ids: orderIds.slice(0, 300) });
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.order_id, row]));
}

// «صرفتها»: redeem a full card on this order.
export async function redeemLoyalty(orderId) {
  if (!cloud) {
    const settings = await getSettings();
    const state = readDemo();
    const goal = settings.loyalty_goal || 9;
    const before = loyaltyProgress({
      stamps: Object.keys(state.stamps).length,
      used: usedStamps(state),
      goal,
    });
    if (!before.complete || !state.links[orderId]) return { ...before, redeemed: false };
    state.redemptions.push({ order_id: orderId, used: goal - GIFT_STAMPS });
    writeDemo(state);
    return {
      ...loyaltyProgress({
        stamps: Object.keys(state.stamps).length,
        used: usedStamps(state),
        goal,
      }),
      redeemed: true,
    };
  }
  const { data, error } = await db.rpc('redeem_loyalty', { target: orderId });
  if (error) throw error;
  return data;
}
