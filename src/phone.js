// Normalises what people type into E.164. Local Algerian mobiles (05/06/07…)
// get +213; any other number must be typed with its country code.
export function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  let e164;
  if (raw.startsWith('+')) e164 = '+' + digits;
  else if (digits.startsWith('00')) e164 = '+' + digits.slice(2);
  else if (/^0[567]\d{8}$/.test(digits)) e164 = '+213' + digits.slice(1);
  else if (/^[567]\d{8}$/.test(digits)) e164 = '+213' + digits;
  else if (/^213[567]\d{8}$/.test(digits)) e164 = '+' + digits;
  else return null;
  if (e164.startsWith('+213')) return /^\+213[567]\d{8}$/.test(e164) ? e164 : null;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export const validCode = (value) => /^\d{6}$/.test(String(value || '').trim());
