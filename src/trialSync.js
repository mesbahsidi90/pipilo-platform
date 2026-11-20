// The /jarreb trial keeps its dashboard in this browser. Each order is also
// copied to the server for 6 hours, so a second phone can scan its QR, get the
// alert and answer «راني جاي» (see supabase/functions/order-alerts/trial.ts).

import { mergeTrialTickets } from './trialRules';

const base = import.meta.env.VITE_SUPABASE_URL;
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const sessionKey = 'bipilo-trial-session';
export const trialAvailable = Boolean(base && apiKey);

export function trialSession() {
  try {
    let value = localStorage.getItem(sessionKey);
    if (!value || !/^[A-Za-z0-9_-]{32,100}$/.test(value)) {
      value = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
      localStorage.setItem(sessionKey, value);
    }
    return value;
  } catch {
    return null;
  }
}

function trialShop() {
  try {
    const shop = JSON.parse(localStorage.getItem('bippo-shop-settings') || '{}');
    return {
      name: shop.name || 'Bipilo',
      kind: shop.kind || 'cafe',
      tracking_mode: ['counter', 'invoice'].includes(shop.tracking_mode)
        ? shop.tracking_mode
        : 'order',
    };
  } catch {
    return { name: 'Bipilo', kind: 'cafe', tracking_mode: 'order' };
  }
}

// The public id printed on the trial's fixed QR codes (clinic, counter, invoice).
const placeKey = 'bipilo-trial-place';
export function trialPlaceId() {
  try {
    let value = localStorage.getItem(placeKey);
    if (!value || !/^[0-9a-f-]{36}$/.test(value)) {
      value = crypto.randomUUID();
      localStorage.setItem(placeKey, value);
    }
    return value;
  } catch {
    return 'local';
  }
}

function pausedToday() {
  try {
    const day = localStorage.getItem('bipilo-demo-clinic-pause');
    return (
      day === new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(Date.now())
    );
  } catch {
    return false;
  }
}

// Tell the server what the fixed QR codes open: shop name, activity, mode, pause.
let placeSavedAt = 0;
export async function saveTrialPlace(force = false) {
  const session = trialSession();
  if (!trialAvailable || !session) return false;
  if (!force && Date.now() - placeSavedAt < 5 * 60000) return true;
  placeSavedAt = Date.now();
  try {
    await trialRequest('trial-place-save', {
      session,
      place: trialPlaceId(),
      ...trialShop(),
      paused: pausedToday(),
    });
    return true;
  } catch {
    placeSavedAt = 0;
    return false;
  }
}

export async function trialRequest(route, body) {
  if (!trialAvailable) throw new Error('Trial server unavailable');
  const res = await fetch(`${base}/functions/v1/order-alerts/${route}`, {
    method: 'POST',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw Object.assign(new Error(data.error || 'Trial request failed'), { status: res.status });
  return data;
}

// Copy one trial order (new or changed) to the server. Never blocks the board.
export async function mirrorTrialOrder(order) {
  const session = trialSession();
  if (!trialAvailable || !session || !order?.token) return false;
  const { name, kind } = trialShop();
  try {
    await trialRequest('trial-upsert', {
      session,
      token: order.token,
      number: order.number,
      name,
      kind,
      status: order.status,
      counter_pending: order.counter_pending === true,
    });
    return true;
  } catch {
    return false;
  }
}

const ordersKey = 'nawba-demo-v1';
const readOrders = () => {
  try {
    return JSON.parse(localStorage.getItem(ordersKey) || '[]');
  } catch {
    return [];
  }
};

// What the customers' phones reported, keyed by ticket token. The board
// refreshes every 2 seconds; the server is asked at most every 4.
let cached = { at: 0, value: {} };
let copied = false;
export async function trialSignals() {
  const session = trialSession();
  if (!trialAvailable || !session) return {};
  if (Date.now() - cached.at < 4000) return cached.value;
  void saveTrialPlace();
  const { signals } = await trialRequest('trial-signals', { session });
  cached = {
    at: Date.now(),
    value: Object.fromEntries((signals || []).map((row) => [row.token, row])),
  };
  const { orders, changed, missing } = mergeTrialTickets(readOrders(), cached.value);
  if (changed) {
    try {
      localStorage.setItem(ordersKey, JSON.stringify(orders));
      window.dispatchEvent(new Event('nawba-change'));
    } catch {
      // The board shows what it has.
    }
  }
  if (!copied) {
    copied = true;
    for (const order of missing) void mirrorTrialOrder(order);
  }
  return cached.value;
}
