import { cloud, db } from './store';
import { locale } from './i18n';
import { defaultPlanCatalog } from './planConfig';

const demoKey = 'bipilo-demo-referral';
export const demoReward = 2000;
export const demoInviteDiscount = 1000;

function demoCode() {
  let code = localStorage.getItem(demoKey);
  if (!code) {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => alphabet[n % 31]).join('');
    localStorage.setItem(demoKey, code);
  }
  return code;
}

export const dzd = (value) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

// { code, signups, active, paid, reward, invite_discount, earned, credit } for
// the owner's main shop, or null.
export async function myReferral() {
  if (!cloud) {
    return {
      code: demoCode(),
      signups: 0,
      active: 0,
      paid: 0,
      reward: demoReward,
      invite_discount: demoInviteDiscount,
      earned: 0,
      credit: 0,
    };
  }
  const { data, error } = await db.rpc('my_referral');
  if (error) throw error;
  return data;
}

// What this branch pays for Pro now: { price, invite_discount, credit_used, total, purchased }.
export async function myProQuote() {
  if (!cloud) {
    const price = defaultPlanCatalog.purchase_price;
    return { price, invite_discount: 0, credit: 0, credit_used: 0, total: price, purchased: false };
  }
  const { data, error } = await db.rpc('my_pro_quote');
  if (error) throw error;
  return data;
}

// Admin: { quote, purchase, earned } for one shop.
export async function adminProQuote(shopId) {
  if (!cloud) {
    const quote = await myProQuote();
    return { quote, purchase: null, earned: 0 };
  }
  const { data, error } = await db.rpc('admin_pro_quote', { shop: shopId });
  if (error) throw error;
  return data;
}
