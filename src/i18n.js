import fr from './fr.json' with { type: 'json' };
export const normalizeText = (text) => String(text).replace(/\s+/g, ' ').trim();
// Language order: a ?lang= in the link, then the visitor's own choice (the
// language button), then the browser's language; Arabic otherwise.
export function resolveLanguage(search = '', chosen = '', browser = []) {
  const requested = new URLSearchParams(search).get('lang');
  if (requested === 'fr' || requested === 'ar') return requested;
  if (chosen === 'fr' || chosen === 'ar') return chosen;
  for (const tag of browser || []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (base === 'fr' || base === 'ar') return base;
  }
  return 'ar';
}
// Set only when the visitor picks a language with the button.
const chosenKey = 'bipilo-language-chosen';
let chosen = '';
try {
  chosen = globalThis.localStorage?.getItem(chosenKey) || '';
} catch {}
const browserLanguages =
  globalThis.navigator?.languages?.length > 0
    ? globalThis.navigator.languages
    : [globalThis.navigator?.language].filter(Boolean);
export const language = resolveLanguage(
  globalThis.location?.search || '',
  chosen,
  browserLanguages,
);
export const locale = language === 'fr' ? 'fr-DZ' : 'ar-DZ';
export const direction = language === 'fr' ? 'ltr' : 'rtl';
export function translate(text, lang = language, values = []) {
  const original = String(text),
    key = normalizeText(original);
  const translated = lang === 'fr' ? fr[key] || key : key;
  const prefix = original.match(/^\s*/)?.[0] || '',
    suffix = original.match(/\s*$/)?.[0] || '';
  return (
    prefix +
    translated.replace(/\{(\d+)\}/g, (match, index) =>
      values[index] === undefined ? match : String(values[index]),
    ) +
    suffix
  );
}
export const t = (text, values = []) => translate(text, language, values);
export function ticketLink(path) {
  return `${location.origin}/?lang=${language}#${path}`;
}
export function switchLanguage(next) {
  if (!['ar', 'fr'].includes(next) || next === language) return;
  try {
    localStorage.setItem('bippo-language', next);
    localStorage.setItem(chosenKey, next);
  } catch {}
  const url = new URL(location.href);
  url.searchParams.set('lang', next);
  location.assign(url.href);
}
if (typeof document !== 'undefined') {
  document.documentElement.lang = language;
  document.documentElement.dir = direction;
  try {
    localStorage.setItem('bippo-language', language);
  } catch {}
}

export function pickupText(value) {
  return normalizeText(value || '') === 'تقدر تجي تديه من الكونتوار.'
    ? t('تقدر تجي تديه من الكونتوار.')
    : value;
}
