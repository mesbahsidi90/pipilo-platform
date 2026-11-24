// Spoken calls from recorded clips («الطلب رقم» + number + «جاهز»), so the
// waiting screen speaks on TVs that have no Arabic voice. Pure, for tests.

const UNITS = [
  '',
  'واحد',
  'اثنين',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];
const TENS = ['', '', 'عشرين', 'ثلاثين', 'أربعين', 'خمسين', 'ستين', 'سبعين', 'ثمانين', 'تسعين'];
const HUNDREDS = [
  '',
  'مئة',
  'مئتين',
  'ثلاثمئة',
  'أربعمئة',
  'خمسمئة',
  'ستمئة',
  'سبعمئة',
  'ثمانمئة',
  'تسعمئة',
];
const THOUSANDS = [
  '',
  'ألف',
  'ألفين',
  'ثلاثة آلاف',
  'أربعة آلاف',
  'خمسة آلاف',
  'ستة آلاف',
  'سبعة آلاف',
  'ثمانية آلاف',
  'تسعة آلاف',
];

// Every clip the screen may need, with the text the voice reads.
export function voiceClipTexts() {
  const clips = {
    order: 'الطلب رقم',
    ready: 'جاهز',
    zero: 'صفر',
  };
  for (let i = 1; i <= 19; i++) {
    clips['u' + i] = UNITS[i];
    clips['wu' + i] = 'و' + UNITS[i];
  }
  for (let i = 2; i <= 9; i++) {
    clips['t' + i] = TENS[i];
    clips['wt' + i] = 'و' + TENS[i];
  }
  for (let i = 1; i <= 9; i++) {
    clips['h' + i] = HUNDREDS[i];
    clips['wh' + i] = 'و' + HUNDREDS[i];
    clips['k' + i] = THOUSANDS[i];
  }
  return clips;
}

// 57 → ["u7", "wt5"] (سبعة وخمسين), 1305 → ["k1", "wh3", "wu5"].
// Above 9999, or anything not a plain number, is read digit by digit.
export function numberClips(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{1,8}$/.test(text)) return null;
  const n = Number(text);
  if (n === 0) return ['zero'];
  if (n > 9999) return [...text].map((d) => (d === '0' ? 'zero' : 'u' + d));
  const parts = [];
  const add = (key) => parts.push(parts.length ? 'w' + key : key);
  const thousands = Math.floor(n / 1000);
  const hundreds = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (thousands) parts.push('k' + thousands);
  if (hundreds) add('h' + hundreds);
  if (rest) {
    if (rest < 20) add('u' + rest);
    else {
      const unit = rest % 10;
      if (unit) add('u' + unit);
      add('t' + Math.floor(rest / 10));
    }
  }
  return parts;
}

// The whole call: «الطلب رقم» + number + «جاهز».
export function callClips(number) {
  const digits = numberClips(number);
  return digits ? ['order', ...digits, 'ready'] : null;
}
