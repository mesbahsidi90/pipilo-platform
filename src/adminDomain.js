export function expired(sub, now = Date.now()) {
  return Boolean(sub?.period_end && new Date(sub.period_end).getTime() <= now);
}
export function operating(shop, sub, now = Date.now()) {
  return (
    shop.status === 'active' && ['trial', 'active'].includes(sub?.status) && !expired(sub, now)
  );
}
export function activityDays(today, count = 14) {
  const end = Date.parse(today + 'T00:00:00Z');
  return Array.from({ length: count }, (_, index) =>
    new Date(end - index * 86400000).toISOString().slice(0, 10),
  );
}

export function needsOrderFollowup(shop, today) {
  if (shop.status !== 'active' || !shop.last_order_at) return false;
  const cutoff = new Date(activityDays(today, 4)[3] + 'T00:00:00+01:00');
  return Date.parse(shop.last_order_at) < cutoff.getTime();
}

const DAY = 86400000;

// Shops the admin should contact now, most urgent first.
// kinds: request (asked for Pro), expired, trial_ending (≤7 days), near_limit (free plan ≥80%).
export function adminAlerts({
  shops = [],
  subs = [],
  overview = [],
  freeLimit = 100,
  now = Date.now(),
}) {
  const usage = new Map(overview.map((row) => [row.id, row]));
  const order = { request: 0, expired: 1, trial_ending: 2, near_limit: 3 };
  const alerts = [];
  for (const shop of shops) {
    if (shop.status !== 'active') continue;
    const sub = subs.find((s) => s.shop_id === shop.id);
    const row = usage.get(shop.id) || {};
    if (row.request) alerts.push({ shop, kind: 'request', at: row.request.created_at });
    const end = sub?.period_end ? Date.parse(sub.period_end) : null;
    if (sub && ['trial', 'active'].includes(sub.status) && end !== null && end <= now)
      alerts.push({ shop, kind: 'expired', at: sub.period_end });
    else if (sub?.status === 'trial' && end !== null && end - now <= 7 * DAY)
      alerts.push({ shop, kind: 'trial_ending', days: Math.ceil((end - now) / DAY) });
    if (!row.paid && !row.request && freeLimit > 0 && row.orders_month >= freeLimit * 0.8)
      alerts.push({ shop, kind: 'near_limit', used: row.orders_month, limit: freeLimit });
  }
  return alerts.sort((a, b) => order[a.kind] - order[b.kind]);
}

// CSV with a BOM so Excel opens Arabic text correctly.
export function toCsv(rows) {
  const cell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    const safe = /^[=+\-@]/.test(text) ? "'" + text : text;
    return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };
  return '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}

// «أداء الأنشطة»: share of orders, as a whole percent (null when no orders).
export const share = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

// Platform totals for the guest funnel, summed over the shops.
export function insightTotals(shops) {
  const keys = [
    'orders',
    'today',
    'followed',
    'alerts_on',
    'rang',
    'delivered',
    'saw_ready',
    'coming',
    'played',
    'ratings',
    'comments',
    'recalled',
    'cancelled',
    'loyalty_stamps',
  ];
  const totals = Object.fromEntries(keys.map((key) => [key, 0]));
  let stars = 0;
  for (const shop of shops) {
    for (const key of keys) totals[key] += Number(shop[key]) || 0;
    stars += (Number(shop.rating_avg) || 0) * (Number(shop.ratings) || 0);
  }
  totals.rating_avg = totals.ratings ? Math.round((stars / totals.ratings) * 10) / 10 : null;
  totals.active = shops.filter((shop) => Number(shop.orders) > 0).length;
  return totals;
}

// Short hints for product work, from one shop's numbers. Needs ≥ 10 orders to
// say anything about rates, so a few test orders do not raise alarms.
export function insightHints(shop, now = Date.now()) {
  const hints = [];
  const orders = Number(shop.orders) || 0;
  const last = shop.last_order_at ? Date.parse(shop.last_order_at) : null;
  if (!orders) hints.push('no_orders');
  else if (last && now - last > 7 * 86400000) hints.push('stopped');
  if (orders >= 10) {
    const followed = share(shop.followed, orders);
    if (followed < 30) hints.push('few_follow');
    if (shop.followed >= 5 && share(shop.alerts_on, shop.followed) < 50) hints.push('few_alerts');
    if (shop.rang >= 5 && share(shop.delivered, shop.rang) < 60) hints.push('weak_delivery');
    if (share(shop.cancelled, orders) >= 15) hints.push('many_cancelled');
    if (!shop.ratings) hints.push('no_ratings');
  }
  if (Number(shop.prep_median) >= 25) hints.push('slow');
  return hints;
}

// «رسالة ترحيب»: the WhatsApp welcome for a new shop owner.
export function welcomeMessage(shopName) {
  return [
    'السلام عليكم 👋 مرحبا بيك في Bipilo!',
    `محلك «${shopName}» راهو واجد.`,
    'باش تبدا: اطبع الكود من «الفروع والأكواد» وحطّو في الكونتوار، وحل «نداء سريع» في تليفون العامل.',
    'إذا تحتاج مساعدة ولا عندك سؤال، كتبلي هنا ونعاونك.',
    '— فريق Bipilo',
  ].join('\n');
}

// wa.me link with the welcome ready to send; null without a usable number.
// Algerian local numbers (0550…) get the 213 country code.
export function welcomeLink(phone, shopName) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (/^0[5-7]\d{8}$/.test(digits)) digits = '213' + digits.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(welcomeMessage(shopName));
}
