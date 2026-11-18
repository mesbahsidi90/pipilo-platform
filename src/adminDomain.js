export function expired(sub,now=Date.now()){return Boolean(sub?.period_end&&new Date(sub.period_end).getTime()<=now);}
export function operating(shop,sub,now=Date.now()){return shop.status==='active'&&['trial','active'].includes(sub?.status)&&!expired(sub,now);}
export function activityDays(today, count = 14) {
  const end = Date.parse(today + 'T00:00:00Z');
  return Array.from({ length: count }, (_, index) =>
    new Date(end - index * 86400000).toISOString().slice(0, 10));
}

export function needsOrderFollowup(shop, today) {
  if (shop.status !== 'active' || !shop.last_order_at) return false;
  const cutoff = new Date(activityDays(today, 4)[3] + 'T00:00:00+01:00');
  return Date.parse(shop.last_order_at) < cutoff.getTime();
}
