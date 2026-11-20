import { t as bippoT } from './i18n.js';
export const supportPhone = '+213551621070';
export const supportWhatsApp = 'https://wa.me/213551621070';
export function contactMessage({
  name = '',
  shop = '',
  topic = bippoT('مساعدة في البداية'),
  message = '',
}) {
  return [
    bippoT('سلام فريق Bipilo،'),
    bippoT('الموضوع: {0}', [topic]),
    name.trim() && bippoT('الاسم: {0}', [name.trim()]),
    shop.trim() && bippoT('المحل: {0}', [shop.trim()]),
    message.trim(),
  ]
    .filter(Boolean)
    .join('\n');
}
export const contactLink = (values) =>
  supportWhatsApp + '?text=' + encodeURIComponent(contactMessage(values));
