// Plans and subscriptions: the feature list, billing types and dates.
// Kept pure (no React, no network) for tests. The server enforces the same
// feature keys (plans_features_known) and the same 7-day grace.

// Features a plan can include. Order = order shown in the admin and pricing.
export const PLAN_FEATURES = [
  ['reports', 'التحليلات، تصدير CSV والسجل الكامل', 'Analyses, export CSV et historique complet'],
  ['feedback', 'ملاحظات الزبائن الخاصة', 'Commentaires privés des clients'],
  ['loyalty', 'بطاقة الولاء', 'Carte de fidélité'],
  ['ordering', 'الطلب من التليفون', 'Commande depuis le téléphone'],
  ['pos', 'الربط مع الكاشير (POS)', 'Connexion à la caisse (POS)'],
];
export const FEATURE_KEYS = PLAN_FEATURES.map(([key]) => key);

export const BILLING = {
  free: ['مجانية', 'Gratuite'],
  once: ['دفعة واحدة (مدى الحياة)', 'Paiement unique (à vie)'],
  monthly: ['شهرية', 'Mensuelle'],
  yearly: ['سنوية', 'Annuelle'],
};

export const GRACE_DAYS = 7;

// Subscription days are Algiers days (UTC+1, no daylight saving).
export const dayStart = (day) => (day ? new Date(day + 'T00:00:00+01:00').toISOString() : null);
export const dayEnd = (day) => (day ? new Date(day + 'T23:59:59+01:00').toISOString() : null);
export const algiersDay = (iso) =>
  iso
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Algiers',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(iso))
    : '';
const DAY = 86400000;

// 'YYYY-MM-DD' → the same day a month/year later (clamped to month end).
function addMonths(day, months) {
  const [y, m, d] = day.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

// End date a plan's billing gives from a start day; '' = no end.
export function defaultEnd(billing, start) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) return '';
  if (billing === 'monthly') return addMonths(start, 1);
  if (billing === 'yearly') return addMonths(start, 12);
  return '';
}

// Push an end date further by a number of months (from the end, or from today
// when it has already passed).
export function extendEnd(end, months, today = new Date().toISOString().slice(0, 10)) {
  const from = end && end > today ? end : today;
  return addMonths(from, months);
}

// Where a subscription stands now: upcoming, active, ending (≤ 7 days left),
// grace (ended, still working), expired, or off (cancelled / past due).
export function subscriptionState(sub, now = Date.now()) {
  if (!sub) return { state: 'none' };
  if (!['active', 'trial'].includes(sub.status)) return { state: 'off' };
  const start = sub.started_at ? Date.parse(sub.started_at) : null;
  if (start && start > now) return { state: 'upcoming', days: Math.ceil((start - now) / DAY) };
  if (!sub.period_end) return { state: 'active', days: null };
  const end = Date.parse(sub.period_end);
  if (end > now) {
    const days = Math.ceil((end - now) / DAY);
    return { state: days <= GRACE_DAYS ? 'ending' : 'active', days };
  }
  const graceEnd = end + GRACE_DAYS * DAY;
  if (graceEnd > now) return { state: 'grace', days: Math.ceil((graceEnd - now) / DAY) };
  return { state: 'expired', days: Math.floor((now - end) / DAY) };
}

// Plan form → the row saved in `plans` (throws a readable message).
export function planRow(form) {
  const name = String(form.name || '').trim();
  if (!name) throw new Error('دخل اسم الخطة');
  if (!BILLING[form.billing]) throw new Error('اختار نوع الدفع');
  const price = form.billing === 'free' ? 0 : Number(form.price);
  if (!Number.isFinite(price) || price < 0 || price >= 1e10)
    throw new Error('السعر لازم يكون رقم موجب أو صفر');
  const limit =
    form.ticket_limit === '' || form.ticket_limit == null ? null : Number(form.ticket_limit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 1000000))
    throw new Error('حد التيكيات لازم يكون عدد صحيح، ولا خليه فارغ بلا حد');
  const position = Number(form.position) || 0;
  return {
    name,
    name_fr: String(form.name_fr || '').trim() || null,
    billing: form.billing,
    price,
    monthly_price: form.billing === 'monthly' ? price : form.billing === 'free' ? 0 : null,
    currency: form.currency || 'DZD',
    ticket_limit: limit,
    features: FEATURE_KEYS.filter((key) => (form.features || []).includes(key)),
    notes_ar:
      String(form.notes_ar || '')
        .trim()
        .slice(0, 1000) || null,
    notes_fr:
      String(form.notes_fr || '')
        .trim()
        .slice(0, 1000) || null,
    is_public: Boolean(form.is_public),
    active: Boolean(form.active),
    position: Math.max(-1000, Math.min(1000, Math.round(position))),
  };
}

// Lines shown on a pricing card: ticket limit, features, then free notes.
export function planLines(plan, fr = false) {
  const lines = [];
  lines.push(
    plan.ticket_limit
      ? fr
        ? `${plan.ticket_limit} tickets par mois`
        : `${plan.ticket_limit} تيكي في الشهر`
      : fr
        ? 'Tickets sans plafond mensuel'
        : 'تيكيات بلا سقف شهري',
  );
  for (const [key, ar, frText] of PLAN_FEATURES)
    if ((plan.features || []).includes(key)) lines.push(fr ? frText : ar);
  const notes = (fr ? plan.notes_fr : plan.notes_ar) || '';
  for (const line of notes.split('\n')) if (line.trim()) lines.push(line.trim());
  return lines;
}
