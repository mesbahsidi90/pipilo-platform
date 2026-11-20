// Pure rules for platform announcements (testable without the browser).
export const tones = ['info', 'new', 'warning'];
export const audiences = ['all', 'free', 'paid'];

// The admin form, cleaned. Returns { error } with an Arabic key when something is wrong.
export function cleanAnnouncement(form, now = Date.now()) {
  const body_ar = String(form.body_ar || '').trim();
  const body_fr = String(form.body_fr || '').trim() || null;
  const link = String(form.link || '').trim() || null;
  if (!body_ar || body_ar.length > 400) return { error: 'اكتب الإعلان بالعربية، حتى 400 حرف.' };
  if (body_fr && body_fr.length > 400) return { error: 'النص بالفرنسية حتى 400 حرف.' };
  if (link && (link.length > 300 || !/^https:\/\/\S+$/.test(link)))
    return { error: 'الرابط لازم يبدا بـ https://' };
  let ends_at = null;
  if (form.ends_on) {
    const end = Date.parse(form.ends_on + 'T23:59:59');
    if (!Number.isFinite(end) || end <= now)
      return { error: 'تاريخ النهاية لازم يكون في المستقبل.' };
    ends_at = new Date(end).toISOString();
  }
  return {
    value: {
      body_ar,
      body_fr,
      link,
      ends_at,
      tone: tones.includes(form.tone) ? form.tone : 'info',
      audience: audiences.includes(form.audience) ? form.audience : 'all',
    },
  };
}

// The text a shop sees, in its language when the admin wrote one.
export const announcementBody = (item, lang) => (lang === 'fr' && item.body_fr) || item.body_ar;

export const isLive = (item, now = Date.now()) =>
  !item.ended_at && (!item.ends_at || Date.parse(item.ends_at) > now);
