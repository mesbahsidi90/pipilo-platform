// Where a new shop came from: the answer to «من وين عرفت Bipilo؟» plus the
// ref/utm parameters of the link it arrived with (ads, visits, referrals).

export const SOURCE_ANSWERS = [
  'facebook',
  'instagram',
  'tiktok',
  'visit',
  'friend',
  'google',
  'other',
];

// Arabic labels (translated with t() where shown).
export const SOURCE_LABELS = {
  facebook: 'فيسبوك',
  instagram: 'إنستغرام',
  tiktok: 'تيك توك',
  visit: 'زيارة من فريق Bipilo',
  friend: 'صاحب محل آخر',
  google: 'Google',
  other: 'غير ذلك',
};

// Short ref codes for printed or posted links → the matching answer.
const refAliases = {
  fb: 'facebook',
  facebook: 'facebook',
  ig: 'instagram',
  insta: 'instagram',
  instagram: 'instagram',
  tt: 'tiktok',
  tiktok: 'tiktok',
  visit: 'visit',
  terrain: 'visit',
  flyer: 'visit',
  friend: 'friend',
  ref: 'friend',
  google: 'google',
};

const clip = (value, max) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
};

// Link parameters, or null when the link has none.
export function parseVisit(search, pathname = '/') {
  const params = new URLSearchParams(search || '');
  const visit = {
    ref: clip(params.get('ref'), 60)?.toLowerCase() || null,
    utm_source: clip(params.get('utm_source'), 60)?.toLowerCase() || null,
    utm_medium: clip(params.get('utm_medium'), 60)?.toLowerCase() || null,
    utm_campaign: clip(params.get('utm_campaign'), 80),
  };
  if (!visit.ref && !visit.utm_source && !visit.utm_campaign) return null;
  return { ...visit, landing: clip(pathname, 120) };
}

// Pre-selects the signup answer from the link the visitor came with.
export function guessAnswer(visit) {
  if (!visit) return '';
  for (const key of [visit.ref, visit.utm_source]) {
    if (!key) continue;
    const base = key.split(/[-_]/)[0];
    if (refAliases[key]) return refAliases[key];
    if (refAliases[base]) return refAliases[base];
  }
  return '';
}

const adSources = {
  facebook: ['fb', 'facebook', 'paid_social'],
  instagram: ['ig', 'instagram', 'paid_social'],
  tiktok: ['tt', 'tiktok', 'paid_social'],
  visit: ['visit', 'field', 'offline'],
  friend: ['friend', 'referral', 'referral'],
  google: ['google', 'google', 'cpc'],
};

// Tracking link for an ad, a post, a flyer or a referral.
export function trackingLink(origin, source, campaign = '', path = '/') {
  const [ref, utmSource, medium] = adSources[source] || ['other', 'other', 'other'];
  const url = new URL(path, origin);
  url.searchParams.set('ref', ref);
  url.searchParams.set('utm_source', utmSource);
  url.searchParams.set('utm_medium', medium);
  const name = campaign
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (name) url.searchParams.set('utm_campaign', name);
  return url.href;
}
