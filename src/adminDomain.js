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
