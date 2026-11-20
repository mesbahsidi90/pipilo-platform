import { t as bippoT, locale as bippoLocale } from './i18n.js';
const googleHosts = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'search.google.com',
  'g.page',
  'maps.app.goo.gl',
]);
export function reviewUrl(value = '') {
  const text = value.trim();
  if (!text) return '';
  try {
    const u = new URL(text);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.port ||
      !googleHosts.has(u.hostname) ||
      text.length > 2048
    )
      throw 0;
    return u.href;
  } catch {
    throw new Error(bippoT('دخل رابط تقييم Google صحيح يبدأ بـ https://، من صفحة محلك في Google.'));
  }
}
export function guestStage(order, now = Date.now()) {
  const s = order.guest || {};
  if (order.status === 'collected')
    return {
      label: bippoT('تسلّم الطلب'),
      tone: 'done',
    };
  if (s.coming_at)
    return {
      label: bippoT('راه جاي'),
      tone: 'coming',
    };
  if (s.ready_seen_at)
    return {
      label: bippoT('شاف حالة «جاهز»'),
      tone: 'seen',
    };
  if (s.push_enabled_at)
    return {
      label: bippoT('فعّل إشعار الهاتف'),
      tone: 'enabled',
    };
  if (s.sound_enabled_at)
    return {
      label: bippoT('فعّل صوت الصفحة'),
      tone: 'sound',
    };
  if (s.opened_at)
    return {
      label: bippoT('فتح رابط الطلب'),
      tone: 'opened',
    };
  return {
    label: bippoT('ما تسجّلش فتح الرابط'),
    tone: 'waiting',
  };
}
export function guestActivity(guest, now = Date.now()) {
  if (!guest?.last_seen_at) return '';
  const age = Math.max(0, now - Date.parse(guest.last_seen_at));
  if (!Number.isFinite(age)) return '';
  return age < 60000
    ? bippoT('آخر نشاط: منذ أقل من دقيقة')
    : age < 3600000
      ? bippoT('آخر نشاط: منذ {0} د', [Math.floor(age / 60000)])
      : bippoT('آخر نشاط: ') +
        new Date(guest.last_seen_at).toLocaleTimeString(bippoLocale, {
          hour: '2-digit',
          minute: '2-digit',
        });
}

// The ready alert's journey, shown on the staff board once an order is ready:
// «انرسل» → «وصل» → «شافه» → «جاي». A later step implies the earlier ones.
// Without notifications enabled, the first two make no sense: the board says so.
export function guestSteps(order) {
  if (order?.status !== 'ready') return [];
  const s = order.guest || {};
  const coming = Boolean(s.coming_at);
  const seen = coming || Boolean(s.ready_seen_at);
  const steps = [];
  if (s.push_enabled_at) {
    const delivered = seen || Boolean(s.push_delivered_at);
    steps.push(
      { key: 'sent', label: bippoT('انرسل'), done: delivered || Boolean(s.push_sent_at) },
      { key: 'delivered', label: bippoT('وصل'), done: delivered },
    );
  } else steps.push({ key: 'nopush', label: bippoT('ما فعّلش التنبيه'), warn: true });
  steps.push(
    { key: 'seen', label: bippoT('شافه'), done: seen },
    { key: 'coming', label: bippoT('جاي'), done: coming },
  );
  return steps;
}
