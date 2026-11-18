// Pure loyalty-card rules shared by the UI, the demo mode and the tests.
export const LOYALTY_GOALS = [7, 9, 11, 13];
export const GIFT_STAMPS = 2;
export const DAILY_STAMP_LIMIT = 3;

// Same rule as private.loyalty_state in the database: each card cycle starts
// with 2 gift stamps; a redemption uses (goal - 2) real stamps.
export function loyaltyProgress({ stamps = 0, used = 0, goal = 9 }) {
  const current = GIFT_STAMPS + Math.max(0, stamps - used);
  return { goal, stamps: Math.min(goal, current), complete: current >= goal };
}

const deviceStore = 'bipilo-loyalty-device';
// Random id that identifies this browser's cards; no account or phone number.
export function deviceKey(storage = globalThis.localStorage) {
  try {
    let key = storage.getItem(deviceStore);
    if (!/^[0-9a-f-]{36}$/i.test(key || '')) {
      key = crypto.randomUUID();
      storage.setItem(deviceStore, key);
    }
    return key;
  } catch {
    return null;
  }
}
