const normalize = text => text.toLowerCase().normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/[أإآ]/g, 'ا');

const intents = [
  ['feedback', /ملاحظ|تعليق|شكاو|اراء|commentair|retours?|avis/],
  ['peak', /ذرو|زحم|ازدحام|ضغط|pointe|affluen|charge|pic\b/],
  ['prep', /تحضير|تجهيز الطلب|مدة|prepar|delai/],
  ['qr', /qr|كود|رمز|طبع|imprim|scan/]
];

export function assistantIntent(question) {
  const normalized = normalize(question);
  return intents.find(([, pattern]) => pattern.test(normalized))?.[0] || null;
}

export function busiestHours(hours) {
  const count = Math.max(0, ...hours.map(hour => hour.count));
  return { count, hours: hours.filter(hour => hour.count === count).map(hour => hour.hour) };
}

const feedbackTopics = [
  ['wait', /انتظار|تاخر|بطي|طول|attent|retard|lent/],
  ['service', /خدم|استقبال|معامل|طاقم|service|accueil|personnel/],
  ['quality', /جود|ذوق|بنين|نوعي|qualit|gout|saveur/],
  ['alerts', /تنبيه|اشعار|رن|notif|alerte|sonnerie/]
];

export function summarizeFeedback(notes) {
  const comments = notes.map(note => normalize(note.comment));
  return feedbackTopics.map(([topic, pattern]) => ({
    topic, count: comments.filter(comment => pattern.test(comment)).length
  })).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
}
