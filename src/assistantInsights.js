// The shop assistant without AI: it recognises what the owner asks (Algerian
// Arabic, standard Arabic or French), reads the answer from the shop's own
// data and offers the matching action. Everything here is pure and tested.

export const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '');

// Features the assistant can switch on or off.
const featureWords = [
  ['ordering', /طلب من (التيليفون|التلفون|الهاتف|الجوال)|الطلب اونلاين|commande|ordering/],
  ['menu', /منيو|قائمه|القائمه|menu|carte/],
  ['loyalty', /ولاء|اختام|ختم|fidelit|tampon/],
  ['game', /لعبه|jeu/],
  ['feedback', /ملاحظات خاصه|ملاحظات الزبائن|commentaires? prive/],
];
const onWords = /شغل|فعل|حل |افتح|ابدا|خدم|active|activer|allume|ouvr/;
const offWords = /وقف|طفي|سكر|حبس|بطل|نحي|desactiv|eteind|arret|ferm|coupe/;

// Order matters: specific actions before general topics.
const intents = [
  [
    'pause',
    /(وقف|حبس|سكر|اغلق).{0,12}(الارقام|الدور|الطابور|التيكيات)|arreter les tickets|fermer la file/,
  ],
  ['resume', /(افتح|عاود|رجع).{0,12}(الارقام|الدور|الطابور)|rouvrir/],
  ['staff', /موظف|خدام|عامل|سرفور|كاسيي|employ|equipe|serveur|staff/],
  ['menu_text', /(ركب|زيد|دير|اكتب|ajout|cree|creer).{0,12}(منيو|قائمه|اصناف|menu|carte|plats)/],
  ['loyalty_setup', /(شغل|فعل|ضبط|بدل|active|regl).{0,12}(بطاقه|ولاء|fidelit)|carte de fidelit/],
  ['google', /قوقل|google|غوغل/],
  ['today', /اليوم|ليوم|ليوما|نهار اليوم|كيف راه|واش صرا|كيف الحال|aujourd|journee|today/],
  ['week', /الاسبوع|السمانه|semaine|7 ايام|سبع ايام|week/],
  ['peak', /ذرو|زحم|ازدحام|ضغط|pointe|affluen|charge|pic\b/],
  ['prep', /تحضير|تجهيز الطلب|مده|وقت الانتظار|prepar|delai|attente/],
  ['feedback', /ملاحظ|تعليق|شكاو|اراء|commentair|retours?|avis/],
  ['qr', /qr|كود|رمز|طبع|ملصق|imprim|scan|affiche/],
];

// What the owner asked: { intent, feature?, on? }.
export function readQuestion(question) {
  const text = normalize(question);
  if (!text.trim()) return { intent: null };
  // «désactiver» contains «activer»: remove it before looking for «on».
  const switchOff = offWords.test(text),
    switchOn = onWords.test(text.replace(/desactiv\w*/g, ' '));
  if (switchOn !== switchOff) {
    const feature = featureWords.find(([, pattern]) => pattern.test(text))?.[0];
    // «ركّب المنيو» builds the menu; «شغّل المنيو» turns it on.
    const building = /ركب|زيد|اكتب|ajout/.test(text);
    const queue = /الارقام|الدور|الطابور|tickets|file/.test(text);
    if (feature && !(feature === 'menu' && building) && !queue)
      return { intent: 'toggle', feature, on: switchOn };
  }
  return { intent: intents.find(([, pattern]) => pattern.test(text))?.[0] || null };
}

// Kept for the older call sites.
export const assistantIntent = (question) => readQuestion(question).intent;

export function busiestHours(hours) {
  const count = Math.max(0, ...hours.map((hour) => hour.count));
  return { count, hours: hours.filter((hour) => hour.count === count).map((hour) => hour.hour) };
}

const feedbackTopics = [
  ['wait', /انتظار|تاخر|بطي|طول|attent|retard|lent/],
  ['service', /خدم|استقبال|معامل|طاقم|service|accueil|personnel/],
  ['quality', /جود|ذوق|بنين|نوعي|qualit|gout|saveur/],
  ['alerts', /تنبيه|اشعار|رن|notif|alerte|sonnerie/],
];

export function summarizeFeedback(notes) {
  const comments = notes.map((note) => normalize(note.comment));
  return feedbackTopics
    .map(([topic, pattern]) => ({
      topic,
      count: comments.filter((comment) => pattern.test(comment)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ---- «كيف اليوم؟» ----
const dayKey = (value, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(value));
const hourOf = (value, timeZone) =>
  Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(
      new Date(value),
    ),
  );
const seconds = (start, end) => {
  const a = Date.parse(start),
    b = Date.parse(end);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? (b - a) / 1000 : null;
};

function dayStats(rows) {
  const prep = rows.map((row) => seconds(row.created_at, row.ready_at)).filter((v) => v !== null);
  return {
    count: rows.length,
    avgPrep: prep.length ? prep.reduce((a, b) => a + b, 0) / prep.length : null,
  };
}

// Today against yesterday and the same weekday last week, in Algeria's time.
export function todaySummary(rows, now = Date.now(), timeZone = 'Africa/Algiers') {
  const today = dayKey(now, timeZone),
    yesterday = dayKey(now - 86400000, timeZone),
    lastWeek = dayKey(now - 7 * 86400000, timeZone);
  const on = (key) => rows.filter((row) => dayKey(row.created_at, timeZone) === key);
  const todayRows = on(today);
  const byHour = {};
  for (const row of todayRows) {
    const hour = hourOf(row.created_at, timeZone);
    byHour[hour] = (byHour[hour] || 0) + 1;
  }
  const peak = Object.entries(byHour).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  // Same time window for the comparison days: up to the current hour and minute.
  const clock = (value) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
    return parts;
  };
  const nowClock = clock(now);
  const soFar = (list) => list.filter((row) => clock(row.created_at) <= nowClock);
  return {
    today: dayStats(todayRows),
    yesterday: dayStats(soFar(on(yesterday))),
    lastWeek: dayStats(soFar(on(lastWeek))),
    waiting: rows.filter((row) => row.status === 'preparing').length,
    ready: rows.filter((row) => row.status === 'ready').length,
    peak: peak ? { hour: Number(peak[0]), count: peak[1] } : null,
  };
}

// Percent change, or null when there is nothing to compare with.
export const change = (now, before) =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

// ---- Menu typed or pasted as text ----
const toWestern = (text) => String(text).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const itemLine = /^(.*?\S)[\s\-–—:.…|=]*?\s*([0-9][0-9\s.,]*?)\s*(دج|د\.ج|da|dzd|dinars?)?\s*$/i;

// «قهوة 80» / «Café - 80 DA» / «مشروبات:» → sections with items and prices.
export function parseMenuText(text, fallbackSection = 'المنيو') {
  const sections = [];
  const skipped = [];
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = toWestern(raw)
      .replace(/^[\s•*·\-–—]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line) continue;
    const match = line.match(itemLine);
    const price = match ? Number(match[2].replace(/[\s ]/g, '').replace(',', '.')) : NaN;
    if (match && Number.isFinite(price) && price > 0 && price < 1e7 && /\D/.test(match[1])) {
      if (!current) {
        current = { name: fallbackSection, items: [] };
        sections.push(current);
      }
      current.items.push({ name: match[1].slice(0, 80), price });
    } else if (line.length <= 60 && !/[0-9]/.test(line)) {
      current = { name: line.replace(/[:：]+$/, '').trim(), items: [] };
      sections.push(current);
    } else skipped.push(raw.trim());
  }
  // A line without a price and without items under it was not a section after all.
  for (const section of sections) if (!section.items.length) skipped.push(section.name);
  return { sections: sections.filter((section) => section.items.length), skipped };
}
