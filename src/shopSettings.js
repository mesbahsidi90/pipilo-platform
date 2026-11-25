import { t as bippoT } from './i18n.js';
import { cloud, db, sandbox } from './store';
import { shopActivity } from './shopActivities';
import { cleanCustomerOptions, themeKey } from './customerThemes';
import { toneKey } from './alertTones';
import { reviewUrl } from './guestExperience';
import { parseRooms } from './clinicRules';
const key = 'bippo-shop-settings';
export const defaults = {
  name: bippoT('محلي'),
  city: '',
  address: '',
  pickup_message: bippoT('تقدر تجي تديه من الكونتوار.'),
  logo: '',
  google_review_url: '',
  kind: 'cafe',
  tracking_mode: 'order',
  customer_theme: 'classic',
  banner_text: '',
  banner_image: '',
  customer_options: {},
  customer_background_image: '',
  alert_tone: 'pager',
  alert_copy: {},
  loyalty_enabled: false,
  loyalty_goal: 9,
  loyalty_reward: '',
  loyalty_reward_fr: '',
  menu_enabled: false,
  menu_currency: 'DZD',
  ordering_enabled: false,
  ordering_modes: ['pickup'],
  clinic_rooms: [],
  display_language: 'ar',
};
export async function getSettings() {
  if (!cloud)
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem(key) || '{}'),
    };
  const { data: id, error } = await db.rpc('current_shop_id');
  if (error) throw error;
  if (!id) throw new Error(bippoT('حسابك ما راهوش مربوط بمحل.'));
  const [profile, shop] = await Promise.all([
    db.from('shop_settings').select('*').eq('shop_id', id).maybeSingle(),
    db.from('shops').select('name,city,kind').eq('id', id).single(),
  ]);
  if (profile.error) throw profile.error;
  if (shop.error) throw shop.error;
  return {
    ...defaults,
    ...shop.data,
    tracking_mode: shopActivity(shop.data.kind).trackingMode,
    ...profile.data,
    shop_id: id,
  };
}
// The waiting / call screen's language (ar | fr), chosen in «الفروع والأكواد».
export async function saveScreenLanguage(lang) {
  if (!['ar', 'fr'].includes(lang)) throw new Error(bippoT('تعذر حفظ التغيير. عاود المحاولة.'));
  if (!cloud) {
    const current = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...current, display_language: lang }));
    return lang;
  }
  const { error } = await db.rpc('set_screen_language', { lang });
  if (error) throw new Error(bippoT('تعذر حفظ التغيير. عاود المحاولة.'));
  return lang;
}
export async function saveSettings(value) {
  const data = {
    name: value.name.trim(),
    city: value.city.trim(),
    address: value.address.trim(),
    pickup_message: value.pickup_message.trim(),
    logo: value.logo,
    customer_theme: themeKey(value.customer_theme),
    banner_text: (value.banner_text || '').trim(),
    banner_image: value.banner_image || '',
    customer_options: cleanCustomerOptions(value.customer_options),
    customer_background_image: value.customer_background_image || '',
    alert_tone: toneKey(value.alert_tone),
    alert_copy: Object.fromEntries(
      ['ar_title', 'fr_title', 'ar_body', 'fr_body'].flatMap((key) => {
        const text =
          typeof value.alert_copy?.[key] === 'string' ? value.alert_copy[key].trim() : '';
        return text ? [[key, text.slice(0, key.endsWith('_title') ? 65 : 145)]] : [];
      }),
    ),
    google_review_url: reviewUrl(value.google_review_url || ''),
    ...(typeof value.private_feedback_enabled === 'boolean' && {
      private_feedback_enabled: value.private_feedback_enabled,
    }),
    ...(typeof value.loyalty_enabled === 'boolean' && { loyalty_enabled: value.loyalty_enabled }),
    ...([7, 9, 11, 13].includes(Number(value.loyalty_goal)) && {
      loyalty_goal: Number(value.loyalty_goal),
    }),
    ...(typeof value.loyalty_reward === 'string' && {
      loyalty_reward: value.loyalty_reward.trim().slice(0, 60),
    }),
    ...(typeof value.loyalty_reward_fr === 'string' && {
      loyalty_reward_fr: value.loyalty_reward_fr.trim().slice(0, 60),
    }),
    ...(typeof value.menu_enabled === 'boolean' && { menu_enabled: value.menu_enabled }),
    ...(['DZD', 'EUR', 'USD', 'MAD', 'TND'].includes(value.menu_currency) && {
      menu_currency: value.menu_currency,
    }),
    ...(typeof value.ordering_enabled === 'boolean' && {
      ordering_enabled: value.ordering_enabled,
    }),
    ...(Array.isArray(value.ordering_modes) && {
      ordering_modes: ['pickup', 'table', 'car'].filter((m) => value.ordering_modes.includes(m)),
    }),
    ...(value.kind === 'clinic' && {
      clinic_rooms: parseRooms(value.rooms_text ?? (value.clinic_rooms || []).join(',')),
    }),
    waiting_mode: value.waiting_mode,
    tracking_mode: ['counter', 'invoice'].includes(value.tracking_mode)
      ? value.tracking_mode
      : 'order',
  };
  if (!data.name || data.name.length > 100) throw new Error(bippoT('دخل اسم المحل، حتى 100 حرف.'));
  if (!cloud) {
    localStorage.setItem(key, JSON.stringify({ ...data, kind: value.kind }));
    if (sandbox) void import('./trialSync').then((m) => m.saveTrialPlace(true));
    return { ...data, kind: value.kind };
  }
  const { error } = await db.from('shop_settings').upsert(
    {
      ...data,
      shop_id: value.shop_id,
    },
    {
      onConflict: 'shop_id',
    },
  );
  if (error) throw error;
  return {
    ...data,
    shop_id: value.shop_id,
    kind: value.kind,
  };
}
export async function ticketBranding(ticket) {
  if (!cloud) return getSettings();
  const [branding, design] = await Promise.all([
    db.rpc('ticket_branding', { ticket }),
    db.rpc('ticket_design', { ticket }),
  ]);
  if (branding.error) throw branding.error;
  return { ...defaults, ...branding.data?.[0], ...(!design.error && design.data) };
}
async function readImage(file, dimension, maxLength) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)
    throw new Error(bippoT('اختار PNG أو JPG أو WebP، أقل من 2 ميغا.'));
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/webp', 0.85);
    if (result.length > maxLength) throw new Error(bippoT('الشعار كبير، جرّب صورة أبسط.'));
    return result;
  } finally {
    bitmap.close();
  }
}

export const readLogo = (file) => readImage(file, 320, 150000);
export const readBanner = (file) => readImage(file, 720, 180000);
