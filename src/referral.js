import { cloud, db } from './store';

const demoKey = 'bipilo-demo-referral';

function demoCode() {
  let code = localStorage.getItem(demoKey);
  if (!code) {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => alphabet[n % 31]).join('');
    localStorage.setItem(demoKey, code);
  }
  return code;
}

// { code, signups, active, paid } for the owner's main shop, or null.
export async function myReferral() {
  if (!cloud) {
    return { code: demoCode(), signups: 0, active: 0, paid: 0 };
  }
  const { data, error } = await db.rpc('my_referral');
  if (error) throw error;
  return data;
}
