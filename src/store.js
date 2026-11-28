import { t as bippoT } from './i18n.js';
import { createClient } from '@supabase/supabase-js';
import { normalizeNumber, validTransition, active, cleanGuestName } from './domain';
import { branchFetch } from './merchantBranches';
import { sandboxActive, sandboxFlag } from './sandboxRules';
import { authStorage, expireIdleSession } from './sessionRules';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// The no-account trial at /jarreb runs on local sample data (see sandboxRules).
export const sandbox = (() => {
  try {
    const saved = localStorage.getItem(sandboxFlag);
    const on = sandboxActive(location, saved ? Number(saved) : null);
    if (on) localStorage.setItem(sandboxFlag, String(Date.now()));
    else if (saved) localStorage.removeItem(sandboxFlag);
    return on;
  } catch {
    return false;
  }
})();
export const cloud = Boolean(url && key) && !sandbox;
export const authLinkError = new URLSearchParams(location.hash.slice(1)).get('error_description');
// «تذكّرني على هذا الجهاز» and the 30-day expiry (see sessionRules).
const authStore = (() => {
  if (!cloud) return undefined;
  try {
    expireIdleSession(localStorage);
    return authStorage(localStorage, sessionStorage);
  } catch {
    return undefined;
  }
})();
export const db = cloud
  ? createClient(url, key, {
      global: { fetch: branchFetch(url) },
      auth: authStore ? { storage: authStore } : undefined,
    })
  : null;
const STORAGE = 'nawba-demo-v1';
// Trial orders are copied to the server so a second phone can open them.
const mirror = (order) => {
  if (sandbox && order) void import('./trialSync').then((m) => m.mirrorTrialOrder(order));
};
const seed = [101, 102, 103].map((number, i) => ({
  id: crypto.randomUUID(),
  token: crypto.randomUUID(),
  number: String(number),
  status: i === 0 ? 'ready' : 'preparing',
  created_at: new Date().toISOString(),
}));
const read = () => {
  const raw = localStorage.getItem(STORAGE);
  if (!raw) {
    localStorage.setItem(STORAGE, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw);
};
const save = (orders) => {
  localStorage.setItem(STORAGE, JSON.stringify(orders));
  window.dispatchEvent(new Event('nawba-change'));
};
export async function listOrders() {
  if (!cloud) return read();
  const { data: shop, error: shopError } = await db.rpc('current_shop_id');
  if (shopError) throw shopError;
  if (!shop) return [];
  const query = () => db.from('orders').select('*').eq('shop_id', shop);
  const [recent, restored] = await Promise.all([
    query().order('created_at', { ascending: false }).limit(200),
    query()
      .in('status', ['preparing', 'ready'])
      .gte('restored_at', new Date(Date.now() - 86400000).toISOString())
      .order('restored_at', { ascending: false })
      .limit(200),
  ]);
  if (recent.error) throw recent.error;
  // During rolling deployment, the previous schema can still serve the existing board.
  if (restored.error && restored.error.code !== '42703') throw restored.error;
  return [
    ...new Map(
      [...(restored.data || []), ...recent.data].map((order) => [order.id, order]),
    ).values(),
  ];
}
export const counterScanRequired = () =>
  bippoT('خلّي الزبون يمسح QR الثابت للطلب الحالي، أو ألغيه إذا الزبون ما راحش يمسح.');

export async function createOrder(
  value,
  { fixedCounter = false, invoiceRequestKey = null, guestName = null } = {},
) {
  const number = normalizeNumber(value);
  const guest_name = cleanGuestName(guestName);
  if (!cloud) {
    const rows = read();
    if (invoiceRequestKey) {
      const existing = rows.find((o) => o.invoice_request_key === invoiceRequestKey);
      if (
        existing?.number === number &&
        existing.status !== 'cancelled' &&
        Date.parse(existing.created_at) > Date.now() - 86400000
      )
        return existing;
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Algiers',
        dateStyle: 'short',
      });
      if (
        existing ||
        rows.some(
          (o) =>
            o.number === number &&
            o.status !== 'cancelled' &&
            (active(o) || day.format(new Date(o.created_at)) === day.format(new Date())),
        )
      )
        return null;
      if (
        rows.filter((o) => o.invoice_request_key && Date.parse(o.created_at) > Date.now() - 60000)
          .length >= 30
      ) {
        return { error: 'rate_limit' };
      }
    }
    if (fixedCounter && rows.some((o) => o.counter_pending && active(o)))
      throw new Error(counterScanRequired());
    if (rows.some((o) => o.number === number && active(o)))
      throw new Error(bippoT('يوجد طلب نشط بهذا الرقم'));
    const o = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      number,
      status: 'preparing',
      counter_pending: fixedCounter,
      ...(guest_name && { guest_name }),
      ...(invoiceRequestKey && { invoice_request_key: invoiceRequestKey }),
      created_at: new Date().toISOString(),
    };
    save([o, ...rows]);
    mirror(o);
    return o;
  }
  const { data, error } = await db
    .from('orders')
    .insert({
      number,
      ...(guest_name && { guest_name }),
    })
    .select()
    .single();
  if (error?.message === 'BIPILO_MONTHLY_TICKET_LIMIT')
    throw new Error(
      bippoT('وصلت للحد الشهري. تقدر تكمّل الطلبات المفتوحة أو تطلب تفعيل الاحترافية.'),
    );
  if (error?.code === '23505' && error.message.includes('orders_counter_pending'))
    throw new Error(counterScanRequired());
  if (error)
    throw new Error(error.code === '23505' ? bippoT('يوجد طلب نشط بهذا الرقم') : error.message);
  return data;
}
export function claimLocalCounterTicket(requestKey) {
  const rows = read();
  const recent = (order) => Date.parse(order.created_at) > Date.now() - 86400000;
  const existing = rows.find((order) => order.counter_claim_key === requestKey);
  if (existing) return recent(existing) ? existing.token : null;
  const pending = rows.find((order) => order.counter_pending && active(order) && recent(order));
  if (!pending) return null;
  save(
    rows.map((order) =>
      order.id === pending.id
        ? { ...order, counter_pending: false, counter_claim_key: requestKey }
        : order,
    ),
  );
  return pending.token;
}
export async function transition(order, status, { clinic = false } = {}) {
  if (!validTransition(order.status, status, { clinic }))
    throw new Error(bippoT('تغيير الحالة غير مسموح'));
  if (!cloud) {
    const rows = read();
    const current = rows.find((o) => o.id === order.id);
    if (!current || current.status !== order.status)
      throw new Error(bippoT('تغيرت حالة الطلب، حدّث الصفحة'));
    if (current.counter_pending && ['ready', 'collected'].includes(status))
      throw new Error(counterScanRequired());
    if (status === 'preparing' && rows.some((o) => o.number === current.number && active(o))) {
      throw new Error(bippoT('يوجد طلب نشط بهذا الرقم'));
    }
    const now = new Date().toISOString();
    const timestamps = {
      ready: { ready_at: now },
      collected: { collected_at: now },
      cancelled: { counter_pending: current.counter_pending == null ? null : false },
      preparing: { restored_at: now },
    };
    const next = { ...current, status, ...timestamps[status] };
    save(rows.map((o) => (o.id === current.id ? next : o)));
    mirror(next);
    return;
  }
  const { data, error } = await db
    .from('orders')
    .update({
      status,
    })
    .eq('id', order.id)
    .eq('status', order.status)
    .select();
  if (error?.code === '23505') throw new Error(bippoT('يوجد طلب نشط بهذا الرقم'));
  if (error?.message === 'BIPILO_COUNTER_SCAN_REQUIRED') throw new Error(counterScanRequired());
  if (error) throw error;
  if (!data.length) throw new Error(bippoT('تغيرت حالة الطلب، حدّث الصفحة'));
}
export async function track(token) {
  if (!cloud) return read().find((o) => o.token === token) || null;
  const { data, error } = await db.rpc('track_order', {
    ticket: token,
  });
  if (error) throw error;
  return data?.[0] || null;
}
// «نادي» again / «بيبيلو مرة تانية»: the waiting screen shows and says the
// number again. Not twice within 10 seconds.
export async function recallOrder(order) {
  if (!cloud) {
    const rows = read();
    const current = rows.find((o) => o.id === order.id);
    if (!current || current.status !== 'ready') return false;
    if (current.recalled_at && Date.now() - Date.parse(current.recalled_at) < 10000) return false;
    const next = { ...current, recalled_at: new Date().toISOString() };
    save(rows.map((o) => (o.id === current.id ? next : o)));
    return true;
  }
  const { data, error } = await db.rpc('recall_order', { target: order.id });
  if (error) throw new Error(bippoT('تعذر إعادة النداء في الشاشة.'));
  return Boolean(data);
}
export async function display(token) {
  if (!cloud)
    return read()
      .filter(active)
      .map(({ number, status, room, ready_at, recalled_at }) => ({
        number,
        status,
        room: status === 'ready' ? room || null : null,
        // A re-call shows as a new call on the screen.
        ready_at:
          status === 'ready' ? [ready_at, recalled_at].filter(Boolean).sort().at(-1) || null : null,
      }));
  const { data, error } = await db.rpc('display_orders', {
    ticket: token,
  });
  if (error) throw error;
  // «الشاشة متصلة» in «نداء سريع»: about once a minute while the screen works.
  if (Date.now() - lastHeartbeat > 55000) {
    lastHeartbeat = Date.now();
    db.rpc('display_heartbeat', { ticket: token }).then(
      () => {},
      () => {},
    );
  }
  return data;
}
let lastHeartbeat = 0;
// When this branch's waiting screen was last seen: { seen_at, now } (server clock).
export async function screenStatus() {
  if (!cloud) return null;
  const { data, error } = await db.rpc('waiting_screen_status');
  if (error) throw error;
  return data;
}
// The waiting screen's header and sound: shop name, logo, activity, tone.
export async function displayBranding(token) {
  if (!cloud) {
    try {
      const shop = JSON.parse(localStorage.getItem('bippo-shop-settings') || '{}');
      return {
        name: shop.name || '',
        kind: shop.kind || 'cafe',
        logo: shop.logo || '',
        alert_tone: shop.alert_tone || 'pager',
        language: shop.display_language || 'ar',
        digits: shop.display_style?.digits || 'dots',
        theme: shop.display_style?.theme || 'dark',
        palette: shop.display_style?.palette || null,
      };
    } catch {
      return null;
    }
  }
  const { data, error } = await db.rpc('display_branding', { ticket: token });
  if (error) return null;
  return data;
}
export function subscribe(fn) {
  window.addEventListener('storage', fn);
  window.addEventListener('nawba-change', fn);
  const timer = setInterval(fn, 2000);
  const channel = db
    ?.channel('staff-orders')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      fn,
    )
    .subscribe();
  return () => {
    clearInterval(timer);
    window.removeEventListener('storage', fn);
    window.removeEventListener('nawba-change', fn);
    if (channel) db.removeChannel(channel);
  };
}
// Future POS and notification adapters belong here, outside the UI.
export const integrations = {
  pos: null,
  payments: null,
  notifications: null,
};
