// Pure menu helpers shared by the editor, the public menu and the tests.
export const MENU_CURRENCIES = ['DZD', 'EUR', 'USD', 'MAD', 'TND'];

// "150 DA"-style price in the viewer's language; whole prices drop decimals.
export function formatPrice(price, currency = 'DZD', locale = 'ar-DZ') {
  if (price === null || price === undefined || price === '') return '';
  const value = Number(price);
  if (!Number.isFinite(value)) return '';
  const code = MENU_CURRENCIES.includes(currency) ? currency : 'DZD';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Price typed by staff ("150", "1 200,50", "١٥٠") → number, empty → null.
export function parsePrice(text) {
  const western = String(text ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s ]/g, '')
    .replace(',', '.');
  if (!western) return null;
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(western)) return undefined;
  return Number(western);
}

export const menuText = (value, max) =>
  Array.from(
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, max)
    .join('');

// Section or item name in the viewer's language, falling back to Arabic.
export const localName = (entry, lang) => (lang === 'fr' && entry?.name_fr) || entry?.name || '';
