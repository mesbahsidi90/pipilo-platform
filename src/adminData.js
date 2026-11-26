import { t as bippoT } from './i18n.js';
import { cloud, db } from './store';
import { defaultPlanCatalog, demoAdminKey, professionalPlanId } from './planConfig';
export { expired, operating } from './adminDomain';
const KEY = demoAdminKey;
const demoProfessional = {
  ...defaultPlanCatalog,
  id: professionalPlanId,
  name: 'احترافية · دفعة واحدة',
  currency: 'DZD',
  monthly_price: null,
};
export { shopTypes } from './shopActivities';
export const subStates = {
  trial: bippoT('تجريبي'),
  active: bippoT('نشط'),
  past_due: bippoT('متأخر'),
  cancelled: bippoT('ملغى'),
};
function read() {
  const stored = localStorage.getItem(KEY);
  if (stored) {
    const data = JSON.parse(stored);
    if (!data.plans.some((plan) => plan.id === professionalPlanId))
      data.plans.push(demoProfessional);
    return data;
  }
  const plan = crypto.randomUUID(),
    shop = crypto.randomUUID();
  const data = {
    shops: [
      {
        id: shop,
        name: bippoT('مقهى الرّواق — مثال'),
        kind: 'cafe',
        city: bippoT('الجزائر'),
        status: 'active',
        created_at: new Date().toISOString(),
        order_count: 0,
      },
    ],
    plans: [
      {
        id: plan,
        name: bippoT('البداية'),
        monthly_price: 0,
        currency: 'DZD',
        active: true,
      },
      demoProfessional,
    ],
    subscriptions: [
      {
        shop_id: shop,
        plan_id: plan,
        status: 'active',
        period_end: null,
        notes: '',
      },
    ],
    memberships: [],
    audit: [],
  };
  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}
function write(data, entity, id) {
  data.audit.unshift({
    id: crypto.randomUUID(),
    entity,
    entity_id: id,
    action: 'SAVE',
    created_at: new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(data));
}
const check = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
export async function isAdmin() {
  return !cloud || check(await db.rpc('is_platform_admin'));
}
export async function loadAdmin() {
  if (!cloud) return read();
  const results = await Promise.all([
    db.from('shops').select('id,name,kind,city,status,created_at').order('created_at', {
      ascending: false,
    }),
    db.from('plans').select('*').order('created_at'),
    db.from('subscriptions').select('*'),
    db.from('memberships').select('*'),
    db
      .from('admin_audit')
      .select('*')
      .order('created_at', {
        ascending: false,
      })
      .limit(100),
    db.from('shop_notes').select('*'),
  ]);
  const [shops, plans, subscriptions, memberships, audit, notes] = results.map(check);
  return {
    shops,
    plans,
    subscriptions: subscriptions.map((s) => ({
      ...s,
      notes: notes.find((n) => n.shop_id === s.shop_id)?.notes || '',
    })),
    memberships,
    audit,
  };
}
export async function loadOrderActivity() {
  if (cloud) return check(await db.rpc('admin_order_activity'));
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return { today, shops: read().shops.map((shop) => ({ ...shop, daily: {}, branch_ids: [] })) };
}

export async function loadDailyOrders(branchIds, day, page) {
  if (!cloud || !branchIds.length) return { orders: [], more: false };
  const start = new Date(day + 'T00:00:00+01:00');
  const end = new Date(start.getTime() + 86400000);
  const offset = page * 50;
  const orders = check(
    await db
      .from('orders')
      .select('id,shop_id,number,status,created_at,shops(name)')
      .in('shop_id', branchIds)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + 50),
  );
  return { orders: orders.slice(0, 50), more: orders.length > 50 };
}
export async function saveShop(form) {
  if (!form.name.trim()) throw new Error(bippoT('دخل اسم المحل'));
  if (!form.plan_id) throw new Error(bippoT('اختار خطة الاشتراك'));
  const ends =
    form.period_end && form.plan_id !== professionalPlanId
      ? new Date(form.period_end + 'T23:59:59Z').toISOString()
      : null;
  if (!cloud) {
    const d = read(),
      id = form.id || crypto.randomUUID();
    const shop = {
      id,
      name: form.name.trim(),
      kind: form.kind,
      city: form.city.trim(),
      status: form.status,
      created_at: d.shops.find((s) => s.id === id)?.created_at || new Date().toISOString(),
    };
    d.shops = [shop, ...d.shops.filter((s) => s.id !== id)];
    d.subscriptions = [
      {
        shop_id: id,
        plan_id: form.plan_id,
        status: form.sub_status,
        period_end: ends,
        notes: form.notes,
      },
      ...d.subscriptions.filter((s) => s.shop_id !== id),
    ];
    write(d, 'shops', id);
    return id;
  }
  return check(
    await db.rpc('admin_save_shop', {
      shop: form.id || null,
      shop_name: form.name.trim(),
      shop_kind: form.kind,
      shop_city: form.city.trim(),
      shop_status: form.status,
      plan: form.plan_id,
      subscription_status: form.sub_status,
      ends_at: ends,
      internal_notes: form.notes,
    }),
  );
}
export async function savePlan(form) {
  const price = form.monthly_price === '' ? null : Number(form.monthly_price);
  if (price !== null && (!Number.isFinite(price) || price < 0))
    throw new Error(bippoT('السعر لازم يكون رقم موجب أو صفر'));
  const item = {
    name: form.name.trim(),
    monthly_price: price,
    currency: form.currency,
    active: form.active,
  };
  if (form.id === professionalPlanId) {
    const purchasePrice = Number(form.purchase_price);
    const standardPrice = Number(form.standard_price);
    const launchBranches = Number(form.launch_branches);
    const freeTicketLimit = Number(form.free_ticket_limit);
    if (
      ![purchasePrice, standardPrice].every(
        (value) => Number.isFinite(value) && value > 0 && value < 1e10,
      ) ||
      !Number.isInteger(launchBranches) ||
      launchBranches < 0 ||
      launchBranches > 100000 ||
      !Number.isInteger(freeTicketLimit) ||
      freeTicketLimit < 1 ||
      freeTicketLimit > 100000
    ) {
      throw new Error(bippoT('راجع أسعار الباقة وحدودها.'));
    }
    Object.assign(item, {
      purchase_price: purchasePrice,
      standard_price: standardPrice,
      launch_branches: launchBranches,
      free_ticket_limit: freeTicketLimit,
      monthly_price: null,
      currency: 'DZD',
    });
  }
  if (!cloud) {
    const d = read(),
      id = form.id || crypto.randomUUID();
    d.plans = [
      ...d.plans.filter((p) => p.id !== id),
      {
        ...item,
        id,
      },
    ];
    write(d, 'plans', id);
    return;
  }
  check(
    await (
      form.id ? db.from('plans').update(item).eq('id', form.id) : db.from('plans').insert(item)
    )
      .select()
      .single(),
  );
}
export async function saveMember(user_id, shop_id) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      user_id.trim(),
    )
  )
    throw new Error(bippoT('دخل معرّف حساب UUID صحيح'));
  if (!cloud) {
    const d = read();
    d.memberships = [
      ...d.memberships.filter((m) => m.user_id !== user_id),
      {
        user_id: user_id.trim(),
        shop_id,
      },
    ];
    write(d, 'memberships', user_id);
    return;
  }
  const existing = check(
    await db.from('memberships').select('user_id').eq('user_id', user_id.trim()).maybeSingle(),
  );
  check(
    await (
      existing
        ? db
            .from('memberships')
            .update({
              shop_id,
            })
            .eq('user_id', user_id.trim())
        : db.from('memberships').insert({
            user_id: user_id.trim(),
            shop_id,
          })
    )
      .select()
      .single(),
  );
}
export async function removeMember(user_id) {
  if (!cloud) {
    const d = read();
    d.memberships = d.memberships.filter((m) => m.user_id !== user_id);
    write(d, 'memberships', user_id);
    return;
  }
  check(await db.from('memberships').delete().eq('user_id', user_id));
}

// Requests for Pro, per-shop usage/features/owner, accounts and platform stats.
export async function loadAdminExtras() {
  if (!cloud) {
    const d = read();
    const today = new Date();
    return {
      requests: d.requests || [],
      overview: {
        free_limit: 100,
        shops: d.shops.map((s, index) => ({
          source:
            index === 0
              ? (() => {
                  try {
                    return JSON.parse(localStorage.getItem('bipilo-demo-source') || 'null');
                  } catch {
                    return null;
                  }
                })()
              : null,
          referral_code: index === 0 ? localStorage.getItem('bipilo-demo-referral') : null,
          id: s.id,
          paid: false,
          orders_month: s.order_count || 0,
          orders_total: s.order_count || 0,
          last_order_at: null,
          owner: s.owner || null,
          welcomed_at: (d.welcomes || {})[s.id] || null,
          members: d.memberships.filter((m) => m.shop_id === s.id).length,
          features: {},
          request: (d.requests || []).find((r) => r.shop_id === s.id) || null,
        })),
      },
      members: d.memberships.map((m) => ({ ...m, email: null, phone: null, owner: false })),
      stats: {
        signups: Array.from({ length: 12 }, (_, i) => ({
          week: new Date(today - (11 - i) * 7 * 86400000).toISOString().slice(0, 10),
          count: 0,
        })),
        orders: Array.from({ length: 30 }, (_, i) => ({
          day: new Date(today - (29 - i) * 86400000).toISOString().slice(0, 10),
          count: 0,
        })),
      },
    };
  }
  const [requests, overview, members, stats] = await Promise.all([
    db.rpc('admin_plan_requests'),
    db.rpc('admin_shop_overview'),
    db.rpc('admin_members'),
    db.rpc('admin_platform_stats'),
  ]).then((results) => results.map(check));
  return { requests, overview, members, stats };
}

export async function resolvePlanRequest(id, outcome) {
  if (!cloud) {
    const d = read();
    d.requests = (d.requests || []).filter((r) => r.id !== id);
    write(d, 'plan_requests', id);
    return true;
  }
  return check(await db.rpc('admin_resolve_plan_request', { target: id, outcome }));
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Account id from an email, a phone number or a pasted UUID.
export async function findAccount(contact) {
  const value = contact.trim();
  if (uuidPattern.test(value)) return value;
  if (!cloud) return null;
  return check(await db.rpc('admin_find_user', { contact: value }));
}

// «أداء الأنشطة»: per-shop numbers over the last `days` days.
export async function loadShopInsights(days = 30) {
  if (cloud) return check(await db.rpc('admin_shop_insights', { days }));
  // Demo: the first example shop gets this browser's demo orders.
  const { listOrders } = await import('./store');
  const since = Date.now() - days * 86400000;
  const orders = (await listOrders()).filter((o) => Date.parse(o.created_at) >= since);
  const minutes = (a, b) => (Date.parse(b) - Date.parse(a)) / 60000;
  const prep = orders
    .filter((o) => o.ready_at && minutes(o.created_at, o.ready_at) > 0)
    .map((o) => minutes(o.created_at, o.ready_at))
    .sort((a, b) => a - b);
  const round = (value) => (value === null ? null : Math.round(value * 10) / 10);
  const hours = {};
  orders.forEach((o) => {
    const hour = new Date(o.created_at).getHours();
    hours[hour] = (hours[hour] || 0) + 1;
  });
  const count = (test) => orders.filter(test).length;
  const days_ = new Set(orders.map((o) => o.created_at.slice(0, 10)));
  const shops = read().shops.map((shop, index) => ({
    ...shop,
    branches: 0,
    plan_name: null,
    orders: index ? 0 : orders.length,
    today: index
      ? 0
      : count((o) => o.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)),
    active_days: index ? 0 : days_.size,
    cancelled: index ? 0 : count((o) => o.status === 'cancelled'),
    last_order_at: index
      ? null
      : orders
          .map((o) => o.created_at)
          .sort()
          .pop() || null,
    prep_avg: index || !prep.length ? null : round(prep.reduce((a, b) => a + b, 0) / prep.length),
    prep_median: index || !prep.length ? null : round(prep[Math.floor(prep.length / 2)]),
    pickup_avg: null,
    peak_hour: index
      ? null
      : Number(Object.entries(hours).sort((a, b) => b[1] - a[1])[0]?.[0] ?? NaN) || null,
    from_invoice: index ? 0 : count((o) => o.invoice_request_key),
    recalled: index ? 0 : count((o) => o.recalled_at),
    followed: 0,
    alerts_on: 0,
    rang: 0,
    delivered: 0,
    saw_ready: 0,
    coming: 0,
    played: 0,
    ratings: 0,
    rating_avg: null,
    comments: 0,
    loyalty_stamps: 0,
  }));
  return { days, since: new Date(since).toISOString(), shops, trial: null };
}

// «رسالة ترحيب»: remember that a shop owner was welcomed (or forget it).
export async function markWelcomed(shopId, done = true) {
  if (cloud) return check(await db.rpc('admin_mark_welcomed', { target: shopId, done }));
  const d = read();
  d.welcomes = { ...(d.welcomes || {}) };
  if (done) d.welcomes[shopId] = new Date().toISOString();
  else delete d.welcomes[shopId];
  write(d, 'shop_welcomes', shopId);
  return d.welcomes[shopId] || null;
}
