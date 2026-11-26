import { professionalPlanId } from './planConfig';
import { t as bippoT, locale as bippoLocale } from './i18n.js';
import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  Layers,
  Users,
  History,
  Plus,
  Search,
  RefreshCw,
  LogOut,
  ArrowUpLeft,
  ShieldCheck,
  X,
  Check,
  Settings2,
  AlertCircle,
  ClipboardList,
  Bell,
  BarChart3,
  Download,
  FileText,
  Megaphone,
  KeyRound,
  Gauge,
} from 'lucide-react';
import Brand from './Brand';
import AdminOrderActivity from './AdminOrderActivity';
import AdminShopInsights from './AdminShopInsights';
import { AdminAnnouncements } from './PlatformAnnouncements';
import AdminAccess from './AdminAccess';
import { AlertList, ShopSheet, StatsTab, exportShops } from './AdminInsights';
import { adminAlerts } from './adminDomain';
import { cloud, db } from './store';
import {
  isAdmin,
  loadAdmin,
  loadAdminExtras,
  resolvePlanRequest,
  findAccount,
  saveShop,
  savePlan,
  saveMember,
  removeMember,
  shopTypes,
  subStates,
  expired,
  operating,
} from './adminData';
import './merchant-workspace.css';
import './admin.css';
import { usePanelTitle } from './pageTitle';
const nav = [
  ['overview', bippoT('نظرة عامة'), LayoutDashboard],
  ['requests', bippoT('طلبات وتنبيهات'), Bell],
  ['shops', bippoT('المحلات والأنشطة'), Store],
  ['orders', bippoT('نشاط الطلبات'), ClipboardList],
  ['insights', bippoT('أداء الأنشطة'), Gauge],
  ['subscriptions', bippoT('الاشتراكات'), CreditCard],
  ['plans', bippoT('الخطط والأسعار'), Layers],
  ['team', bippoT('حسابات المحلات'), Users],
  ['admins', bippoT('الأدمين'), KeyRound],
  ['stats', bippoT('الإحصائيات'), BarChart3],
  ['announcements', bippoT('الإعلانات'), Megaphone],
  ['activity', bippoT('سجل التغييرات'), History],
];
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString(bippoLocale) : bippoT('بدون تاريخ نهاية');
const money = (p, c = 'DZD') =>
  p === null
    ? bippoT('السعر غير محدد')
    : new Intl.NumberFormat(bippoLocale, {
        style: 'currency',
        currency: c,
        maximumFractionDigits: 0,
      }).format(Number(p));
export function AdminAccessLink() {
  const [allowed, setAllowed] = useState(!cloud);
  useEffect(() => {
    let alive = true;
    isAdmin()
      .then((ok) => {
        if (alive) setAllowed(Boolean(ok));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return allowed ? (
    <a className="muted" href="/admin">
      {bippoT('إدارة المنصة')}
    </a>
  ) : null;
}
function Modal({ title, close, children }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button type="button" onClick={close} className="icon-button" aria-label={bippoT('إغلاق')}>
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function Admin() {
  const [auth, setAuth] = useState(cloud ? 'loading' : 'allowed'),
    [session, setSession] = useState(null);
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    async function inspect(s) {
      setSession(s);
      if (!s) {
        setAuth('login');
        return;
      }
      try {
        const ok = await isAdmin();
        if (alive) setAuth(ok ? 'allowed' : 'denied');
      } catch {
        if (alive) setAuth('unavailable');
      }
    }
    db.auth.getSession().then(({ data }) => inspect(data.session));
    const { data } = db.auth.onAuthStateChange((_, s) => {
      setTimeout(() => {
        if (alive) inspect(s);
      }, 0);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return auth === 'allowed' ? (
    <AdminPanel session={session} />
  ) : (
    <>
      <header className="nav wrap">
        <Brand />
        <a href="/dashboard">{bippoT('لوحة المحل')}</a>
      </header>
      {auth === 'login' ? (
        <AdminLogin />
      ) : (
        <div className="panel admin-gate">
          <ShieldCheck size={38} />
          <h1>
            {auth === 'loading'
              ? bippoT('نتحقق من الصلاحية…')
              : auth === 'denied'
                ? bippoT('هاذ المساحة خاصة بأدمين المنصة')
                : bippoT('إدارة المنصة مازالت ما تفعّلتش')}
          </h1>
          <p>
            {auth === 'denied'
              ? bippoT(
                  'حساب المحل ما يقدرش يدخل لإدارة المنصة. الصلاحية تتعيّن من قاعدة البيانات فقط.',
                )
              : auth === 'unavailable'
                ? bippoT(
                    'يلزم تفعيل إعدادات إدارة المنصة في قاعدة البيانات. ما عرضنا حتى بيانات إدارية.',
                  )
                : bippoT('لحظات من فضلك.')}
          </p>
          <a className="button outline" href="/dashboard">
            {bippoT('ارجع للوحة المحل')}
          </a>
        </div>
      )}
    </>
  );
}
function AdminLogin() {
  usePanelTitle(bippoT('إدارة المنصة'));
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="panel login"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const { error } = await db.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
        } catch {
          setError(bippoT('تعذر الدخول. راجع البريد وكلمة المرور.'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">
        <ShieldCheck size={16} />
        {bippoT(' إدارة Bipilo')}
      </span>
      <h1>{bippoT('مرحبا بالأدمين')}</h1>
      <p>{bippoT('دخل بحساب إدارة المنصة المصرّح ليه.')}</p>
      <label>
        {bippoT('البريد الإلكتروني')}
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        {bippoT('كلمة المرور')}
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button className="button" disabled={busy}>
        {bippoT('دخول للإدارة')}
      </button>
      <a className="recovery-back" href="/forgot-password">
        {bippoT('ما حطّيتش كلمة مرور؟ ولا نسيتها؟')}
      </a>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
function AdminPanel({ session }) {
  const [tab, setTab] = useState('overview'),
    [data, setData] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [edit, setEdit] = useState(null),
    [planEdit, setPlanEdit] = useState(null),
    [teamForm, setTeamForm] = useState(null),
    [revoke, setRevoke] = useState(null),
    [extras, setExtras] = useState(null),
    [sheet, setSheet] = useState(null);
  const alive = useRef(true);
  const [ordersRefresh, setOrdersRefresh] = useState(0);
  async function refresh() {
    setLoading(true);
    try {
      const [d, x] = await Promise.all([loadAdmin(), loadAdminExtras().catch(() => null)]);
      if (alive.current) {
        setData(d);
        setExtras(x);
        setError('');
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    refresh();
    return () => {
      alive.current = false;
    };
  }, []);
  async function perform(fn, success, close) {
    setBusy(true);
    setError('');
    try {
      await fn();
      close?.();
      setNotice(success);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const shops = data?.shops || [],
    plans = data?.plans || [],
    subs = data?.subscriptions || [],
    members = data?.memberships || [];
  const subFor = (id) => subs.find((s) => s.shop_id === id),
    planFor = (id) => plans.find((p) => p.id === id);
  function openShop(shop) {
    const sub = subFor(shop?.id);
    setError('');
    setEdit({
      id: shop?.id || '',
      name: shop?.name || '',
      kind: shop?.kind || 'cafe',
      city: shop?.city || '',
      status: shop?.status || 'active',
      plan_id: sub?.plan_id || plans.find((p) => p.active)?.id || '',
      sub_status: sub?.status || 'active',
      period_end: sub?.period_end?.slice(0, 10) || '',
      notes: sub?.notes || '',
    });
  }
  const filtered = shops.filter(
    (s) =>
      (s.name + ' ' + s.city).toLowerCase().includes(query.toLowerCase()) &&
      (status === 'all' ||
        (tab === 'subscriptions'
          ? status === 'expired'
            ? expired(subFor(s.id))
            : subFor(s.id)?.status === status
          : s.status === status)),
  );
  const totals = {
    all: shops.length,
    operating: shops.filter((s) => operating(s, subFor(s.id))).length,
    attention: subs.filter((s) => expired(s) || ['past_due', 'cancelled'].includes(s.status))
      .length,
    staff: members.length,
  };
  const overview = extras?.overview?.shops || [],
    freeLimit = extras?.overview?.free_limit || 100;
  const alerts = adminAlerts({ shops, subs, overview, freeLimit });
  const accounts = extras?.members || members.map((m) => ({ ...m }));
  function resolveRequest(id, outcome, shop) {
    perform(
      () => resolvePlanRequest(id, outcome),
      outcome === 'done'
        ? bippoT('علّمنا الطلب. راجع الاشتراك الاحترافي واحفظ.')
        : bippoT('تجاهلنا الطلب.'),
      () => {
        if (outcome !== 'done' || !shop) return;
        openShop(shop);
        setEdit(
          (value) => value && { ...value, plan_id: professionalPlanId, sub_status: 'active' },
        );
      },
    );
  }
  const sheetShop = sheet && shops.find((s) => s.id === sheet);
  function changeTab(id) {
    setTab(id);
    setQuery('');
    setStatus('all');
    setNotice('');
  }

  const heading = nav.find(([id]) => id === tab)[1];
  usePanelTitle(
    tab === 'overview' ? bippoT('إدارة المنصة') : heading + ' · ' + bippoT('إدارة المنصة'),
  );
  const description = {
    overview: bippoT('كل واش صاري في المنصة، في بلاصة وحدة.'),
    shops: bippoT('زيد محل جديد، نظّم معلوماتو، وتحكّم في حالتو.'),
    orders: bippoT('تابع الطلبات اليومية وتواصل مع أصحاب المحلات عند توقف النشاط.'),
    insights: bippoT(
      'كيفاش كل محل يستعمل Bipilo: الطلبات، وقت التحضير، التليفونات، التقييمات والألعاب.',
    ),
    subscriptions: bippoT('تابع الاشتراكات وبدّل الخطط وفترات الصلاحية.'),
    plans: bippoT('الخطط والأسعار'),
    team: bippoT('حسابات المحلات'),
    admins: bippoT('زيد ولا نحّي اللي يقدرو يدخلو لإدارة المنصة.'),
    requests: bippoT(
      'محلات طلبت الاحترافية، تجارب قريبة تكمل، ومحلات قريبة من حد الباقة المجانية.',
    ),
    stats: bippoT('الطلبات والتسجيلات واستعمال المزايا.'),
    announcements: bippoT('اكتب رسالة تبان في لوحة كل المحلات، كيما ميزة جديدة ولا صيانة.'),
    activity: bippoT('سجل التغييرات'),
  }[tab];

  return (
    <div className="merchant-workspace admin-shell">
      <aside className="merchant-sidebar admin-workspace-sidebar">
        <Brand linked={false} />
        <div className="merchant-identity admin-identity">
          <span className="admin-avatar">
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <div>
            <b>{bippoT('إدارة المنصة')}</b>
            <small>{cloud ? bippoT('وصول محمي بالصلاحيات') : bippoT('وضع تجريبي محلي')}</small>
          </div>
        </div>
        <nav aria-label={bippoT('إدارة المنصة')}>
          {nav.map(([id, label, Icon]) => (
            <button
              type="button"
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => changeTab(id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
              {id === 'shops' && data && <small className="admin-nav-count">{shops.length}</small>}
              {id === 'requests' && alerts.length > 0 && (
                <small className="admin-nav-count alert">{alerts.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="merchant-sidebar-footer">
          <a className="merchant-support" href="/dashboard">
            <ArrowUpLeft size={17} />
            {bippoT('لوحة المحل')}
          </a>
          {session && (
            <button
              type="button"
              className="merchant-signout"
              onClick={async () => {
                try {
                  const { error } = await db.auth.signOut();
                  if (error) throw error;
                } catch {
                  setError(bippoT('تعذر تسجيل الخروج. عاود المحاولة.'));
                }
              }}
            >
              <LogOut size={17} />
              {bippoT('تسجيل الخروج')}
            </button>
          )}
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <div>
            <h1>{heading}</h1>
            {description !== heading && <p>{description}</p>}
          </div>
          <div className="admin-top-actions">
            <button
              className="button outline small"
              aria-label={bippoT('تحديث بيانات الإدارة')}
              onClick={
                ['orders', 'insights'].includes(tab)
                  ? () => setOrdersRefresh((value) => value + 1)
                  : refresh
              }
              disabled={loading || busy}
            >
              <RefreshCw size={15} />
              {loading ? bippoT('نحدّث…') : bippoT('تحديث')}
            </button>
            {['overview', 'shops', 'subscriptions'].includes(tab) && (
              <button
                className="button small"
                onClick={() => openShop()}
                disabled={!plans.some((p) => p.active)}
              >
                <Plus size={16} />
                {bippoT(' زيد محل')}
              </button>
            )}
          </div>
        </header>
        {tab === 'orders' && <AdminOrderActivity refreshKey={ordersRefresh} />}
        {tab === 'insights' && <AdminShopInsights refreshKey={ordersRefresh} />}
        {!cloud && (
          <div className="admin-demo">
            <span className="dot" />
            {bippoT(' تجربة محلية — هاذ البيانات غير أمثلة، وما تتبدّلش قاعدة الإنتاج.')}
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <div className="admin-notice" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {!data ? (
          <div className="panel admin-loading">
            {error
              ? bippoT('ما قدرناش نحمّلو البيانات. عاود جرّب التحديث.')
              : bippoT('نحمّلو بيانات المنصة…')}
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <section className="admin-stats">
                  {[
                    [Store, bippoT('المحلات المسجّلة'), totals.all, bippoT('في المنصة')],
                    [
                      ShieldCheck,
                      bippoT('محلات تقدر تخدم'),
                      totals.operating,
                      bippoT('نشطة واشتراكها صالح'),
                    ],
                    [
                      CreditCard,
                      bippoT('اشتراكات تحتاج متابعة'),
                      totals.attention,
                      bippoT('متأخرة، منتهية أو ملغاة'),
                    ],
                    [Users, bippoT('حسابات مرتبطة'), totals.staff, bippoT('تابعة للمحلات')],
                  ].map(([Icon, title, count, caption]) => (
                    <article key={title}>
                      <span className="admin-stat-icon">
                        <Icon size={21} />
                      </span>
                      <small>{title}</small>
                      <strong>{count}</strong>
                      <p>{caption}</p>
                    </article>
                  ))}
                </section>
                <section className="panel admin-section admin-followup">
                  <div className="admin-section-title">
                    <div>
                      <h2>{bippoT('يحتاجو اتصال')}</h2>
                      <p>{bippoT('طلبات التفعيل والاشتراكات اللي تحتاج متابعة.')}</p>
                    </div>
                    {alerts.length > 3 && (
                      <button onClick={() => changeTab('requests')} className="admin-text-link">
                        {bippoT('شوف الكل ')}
                        <ArrowUpLeft size={14} />
                      </button>
                    )}
                  </div>
                  <AlertList
                    alerts={alerts}
                    overview={overview}
                    onOpen={(shop) => setSheet(shop.id)}
                    onResolve={resolveRequest}
                    busy={busy}
                    limit={3}
                  />
                </section>
                <div className="admin-overview-grid">
                  <section className="panel admin-section">
                    <div className="admin-section-title">
                      <div>
                        <h2>{bippoT('آخر المحلات')}</h2>
                        <p>{bippoT('المقاهي والمطاعم اللي انضمّو للمنصة.')}</p>
                      </div>
                      <button onClick={() => setTab('shops')} className="admin-text-link">
                        {bippoT('شوف الكل ')}
                        <ArrowUpLeft size={14} />
                      </button>
                    </div>
                    {shops.slice(0, 5).map((s) => (
                      <div className="admin-venue" key={s.id}>
                        <div className="venue-symbol">
                          <Store size={20} />
                        </div>
                        <div>
                          <b>{s.name}</b>
                          <small>
                            {shopTypes[s.kind]} · {s.city || bippoT('المدينة غير محددة')}
                          </small>
                        </div>
                        <Badge status={s.status} />
                        <button
                          className="icon-button"
                          onClick={() => setSheet(s.id)}
                          aria-label={bippoT('ملف {0}', [s.name])}
                        >
                          <Settings2 size={17} />
                        </button>
                      </div>
                    ))}
                    {!shops.length && (
                      <Empty text={bippoT('مازال ما كاش محلات. زيد أول محل باش تبدا.')} />
                    )}
                  </section>
                  <section className="panel admin-section">
                    <div className="admin-section-title">
                      <div>
                        <h2>{bippoT('توزيع الاشتراكات')}</h2>
                        <p>{bippoT('الخطط المرتبطة بالمحلات حاليًا.')}</p>
                      </div>
                    </div>
                    {plans.map((p) => {
                      const count = subs.filter((s) => s.plan_id === p.id).length;
                      return (
                        <div className="plan-distribution" key={p.id}>
                          <div>
                            <b>{p.name}</b>
                            <span>
                              {count}
                              {bippoT(' محل')}
                            </span>
                          </div>
                          <div className="plan-meter">
                            <i
                              style={{
                                width: `${shops.length ? (count / shops.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="admin-tip">
                      <CreditCard size={20} />
                      <p>
                        {bippoT(
                          'الاشتراكات تُدار يدويًا. الأرقام هنا ما تعنيش تحصيل أموال، والدفع الإلكتروني مازال غير مفعّل.',
                        )}
                      </p>
                    </div>
                  </section>
                </div>
                <Activity rows={data.audit.slice(0, 5)} shops={shops} compact />
              </>
            )}
            {['shops', 'subscriptions'].includes(tab) && (
              <section className="panel admin-section">
                <div className="admin-table-tools">
                  <label className="admin-search">
                    <Search size={17} />
                    <input
                      aria-label={bippoT('البحث عن محل')}
                      placeholder={bippoT('قلّب باسم المحل ولا المدينة…')}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label={bippoT('تصفية الحالة')}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">{bippoT('كل الحالات')}</option>
                    {tab === 'shops' ? (
                      <>
                        <option value="active">{bippoT('نشط')}</option>
                        <option value="suspended">{bippoT('موقوف')}</option>
                      </>
                    ) : (
                      <>
                        <option value="trial">{bippoT('تجريبي')}</option>
                        <option value="active">{bippoT('نشط')}</option>
                        <option value="past_due">{bippoT('متأخر')}</option>
                        <option value="cancelled">{bippoT('ملغى')}</option>
                        <option value="expired">{bippoT('منتهي الصلاحية')}</option>
                      </>
                    )}
                  </select>
                  <small>
                    {filtered.length}
                    {bippoT(' نتيجة')}
                  </small>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={!filtered.length}
                    onClick={() => exportShops({ shops: filtered, subFor, planFor, overview })}
                  >
                    <Download size={15} />
                    CSV
                  </button>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{bippoT('المحل')}</th>
                        <th>
                          {tab === 'shops'
                            ? bippoT('النشاط / المدينة')
                            : bippoT('الخطة / السعر الشهري')}
                        </th>
                        <th>{bippoT('حالة المحل')}</th>
                        <th>{bippoT('الاشتراك')}</th>
                        <th>{bippoT('الصلاحية')}</th>
                        <th>
                          <span className="sr-only">{bippoT('الإجراءات')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => {
                        const sub = subFor(s.id),
                          p = planFor(sub?.plan_id);
                        return (
                          <tr key={s.id}>
                            <td>
                              <b>{s.name}</b>
                              <small dir="ltr">{s.id.slice(0, 8)}</small>
                            </td>
                            <td>
                              {tab === 'shops' ? (
                                <>
                                  {shopTypes[s.kind]}
                                  <small>{s.city || bippoT('غير محددة')}</small>
                                </>
                              ) : (
                                <>
                                  {p?.name || bippoT('بدون خطة')}
                                  <small>
                                    {p
                                      ? money(p.purchase_price ?? p.monthly_price, p.currency)
                                      : '—'}
                                  </small>
                                </>
                              )}
                            </td>
                            <td>
                              <Badge status={s.status} />
                            </td>
                            <td>
                              <Badge status={expired(sub) ? 'expired' : sub?.status || 'none'} />
                            </td>
                            <td>{formatDate(sub?.period_end)}</td>
                            <td>
                              <button
                                className="button outline small"
                                onClick={() => setSheet(s.id)}
                                aria-label={bippoT('ملف {0}', [s.name])}
                              >
                                <FileText size={15} />
                                {bippoT('الملف')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && <Empty text={bippoT('ما لقيناش نتائج بهاذ البحث.')} />}
                {tab === 'subscriptions' && (
                  <div className="admin-tip">
                    <AlertCircle size={18} />
                    <p>
                      {bippoT(
                        'إيقاف المحل أو انتهاء/إلغاء الاشتراك يمنع إنشاء طلبات جديدة. الطلبات الحالية تبقى قابلة للتحديث والاستلام.',
                      )}
                    </p>
                  </div>
                )}
              </section>
            )}
            {tab === 'plans' && (
              <>
                <div className="admin-page-tools">
                  <p>{bippoT('حدّد أسعارك، وخلّي أي خطة قديمة غير متاحة للاشتراكات الجديدة.')}</p>
                  <button
                    className="button small"
                    onClick={() =>
                      setPlanEdit({
                        name: '',
                        monthly_price: '',
                        currency: 'DZD',
                        active: true,
                      })
                    }
                  >
                    <Plus size={16} />
                    {bippoT(' زيد خطة')}
                  </button>
                </div>
                <div className="admin-plan-grid">
                  {plans.map((p) => (
                    <article className="panel admin-plan-card" key={p.id}>
                      <div>
                        <Layers size={24} />
                        <Badge status={p.active ? 'active' : 'archived'} />
                      </div>
                      <h2>{p.name}</h2>
                      <strong>{money(p.purchase_price ?? p.monthly_price, p.currency)}</strong>
                      <p>
                        {bippoT(
                          p.purchase_price != null
                            ? 'دفعة واحدة · إدارة يدوية'
                            : 'للشهر · إدارة يدوية',
                        )}
                      </p>
                      <hr />
                      <small>
                        {subs.filter((s) => s.plan_id === p.id).length}
                        {bippoT(' محل مرتبط بالخطة')}
                      </small>
                      <button
                        className="button outline full"
                        onClick={() =>
                          setPlanEdit({
                            ...p,
                            monthly_price: p.monthly_price ?? '',
                          })
                        }
                      >
                        {bippoT('تعديل الخطة')}
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === 'team' && (
              <section className="panel admin-section">
                <div className="admin-section-title">
                  <div>
                    <h2>{bippoT('حسابات المحلات')}</h2>
                    <p>
                      {bippoT(
                        'اربط حساب Supabase موجود بمحل واحد. هاذ الربط ما يعطيش صلاحية أدمين.',
                      )}
                    </p>
                  </div>
                  <button
                    className="button small"
                    onClick={() =>
                      setTeamForm({
                        user_id: '',
                        shop_id: shops[0]?.id || '',
                      })
                    }
                    disabled={!shops.length}
                  >
                    <Plus size={16} />
                    {bippoT(' ربط حساب')}
                  </button>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{bippoT('الحساب')}</th>
                        <th>{bippoT('المحل')}</th>
                        <th>{bippoT('آخر دخول')}</th>
                        <th>{bippoT('الإجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((m) => (
                        <tr key={m.user_id}>
                          <td>
                            <b dir="ltr">{m.email || (m.phone ? '+' + m.phone : '—')}</b>
                            <small>
                              {m.owner ? bippoT('صاحب المحل') : bippoT('موظف')}
                              {m.email && m.phone && (
                                <>
                                  {' · '}
                                  <span dir="ltr">+{m.phone}</span>
                                </>
                              )}
                            </small>
                            <small dir="ltr">{m.user_id}</small>
                          </td>
                          <td>{shops.find((s) => s.id === m.shop_id)?.name || '—'}</td>
                          <td>
                            {m.last_sign_in_at
                              ? new Date(m.last_sign_in_at).toLocaleDateString(bippoLocale)
                              : '—'}
                          </td>
                          <td>
                            <button className="admin-text-link" onClick={() => setTeamForm(m)}>
                              {bippoT('تغيير المحل')}
                            </button>
                            <button className="admin-danger-link" onClick={() => setRevoke(m)}>
                              {bippoT('نزع الربط')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!accounts.length && <Empty text={bippoT('مازال ما كاش حسابات مرتبطة.')} />}
                <div className="admin-tip">
                  <Users size={19} />
                  <p>
                    {bippoT(
                      'الحساب لازم يكون مسجّل في Bipilo. اكتب الإيميل ولا رقم التليفون تاعو باش تربطو. صلاحية الأدمين تتعطى من قسم «الأدمين».',
                    )}
                  </p>
                </div>
              </section>
            )}
            {tab === 'requests' && (
              <section className="panel admin-section">
                <AlertList
                  alerts={alerts}
                  overview={overview}
                  onOpen={(shop) => setSheet(shop.id)}
                  onResolve={resolveRequest}
                  busy={busy}
                />
                <div className="admin-tip">
                  <AlertCircle size={18} />
                  <p>
                    {bippoT(
                      'المحل يطلب التفعيل من صفحة «الاشتراك». كي يخلّص، اضغط «فعّل الاحترافية» واحفظ الخطة.',
                    )}
                  </p>
                </div>
              </section>
            )}
            {tab === 'stats' &&
              (extras ? (
                <StatsTab stats={extras.stats} overview={overview} shops={shops} />
              ) : (
                <div className="panel admin-loading">
                  {bippoT('ما قدرناش نحمّلو الإحصائيات. عاود جرّب التحديث.')}
                </div>
              ))}
            {tab === 'activity' && <Activity rows={data.audit} shops={shops} />}
            {tab === 'announcements' && <AdminAnnouncements />}
            {tab === 'admins' && <AdminAccess />}
          </>
        )}
        {edit && (
          <Modal
            title={edit.id ? bippoT('تعديل المحل والاشتراك') : bippoT('محل جديد')}
            close={() => !busy && setEdit(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perform(
                  () => saveShop(edit),
                  bippoT('تسجّلت معلومات المحل والاشتراك.'),
                  () => setEdit(null),
                );
              }}
            >
              <div className="admin-form-grid">
                <label>
                  {bippoT('اسم المحل')}
                  <input
                    autoFocus
                    value={edit.name}
                    maxLength={120}
                    required
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        name: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {bippoT('النشاط')}
                  <select
                    value={edit.kind}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        kind: e.target.value,
                      })
                    }
                  >
                    {Object.entries(shopTypes).map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {bippoT('المدينة')}
                  <input
                    maxLength={100}
                    value={edit.city}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        city: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {bippoT('حالة المحل')}
                  <select
                    value={edit.status}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        status: e.target.value,
                      })
                    }
                  >
                    <option value="active">{bippoT('نشط')}</option>
                    <option value="suspended">{bippoT('موقوف')}</option>
                  </select>
                </label>
                <label>
                  {bippoT('خطة الاشتراك')}
                  <select
                    required
                    value={edit.plan_id}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        plan_id: e.target.value,
                      })
                    }
                  >
                    <option value="">{bippoT('اختار خطة')}</option>
                    {plans
                      .filter((p) => p.active || p.id === edit.plan_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {!p.active ? bippoT(' — مؤرشفة') : ''}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {bippoT('حالة الاشتراك')}
                  <select
                    value={edit.sub_status}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        sub_status: e.target.value,
                      })
                    }
                  >
                    {Object.entries(subStates).map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-span">
                  {bippoT('نهاية الصلاحية — اختياري')}
                  <input
                    type="date"
                    disabled={edit.plan_id === professionalPlanId}
                    value={edit.plan_id === professionalPlanId ? '' : edit.period_end}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        period_end: e.target.value,
                      })
                    }
                  />
                  <small>
                    {bippoT('فارغ = بلا تاريخ نهاية. التاريخ حتى نهاية اليوم بتوقيت UTC.')}
                  </small>
                </label>
                <label className="admin-span">
                  {bippoT('ملاحظات داخلية')}
                  <textarea
                    maxLength={2000}
                    rows={3}
                    value={edit.notes}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        notes: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="admin-form-footer">
                <button className="button" disabled={busy}>
                  {busy ? bippoT('نحفظ…') : bippoT('حفظ التغييرات')}
                </button>
                <button
                  type="button"
                  className="button outline"
                  disabled={busy}
                  onClick={() => setEdit(null)}
                >
                  {bippoT('إلغاء')}
                </button>
              </div>
            </form>
          </Modal>
        )}
        {planEdit && (
          <Modal
            title={planEdit.id ? bippoT('تعديل الخطة') : bippoT('خطة جديدة')}
            close={() => !busy && setPlanEdit(null)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perform(
                  () => savePlan(planEdit),
                  bippoT('تسجّلت الخطة.'),
                  () => setPlanEdit(null),
                );
              }}
            >
              <label>
                {bippoT('اسم الخطة')}
                <input
                  autoFocus
                  maxLength={80}
                  required
                  value={planEdit.name}
                  onChange={(e) =>
                    setPlanEdit({
                      ...planEdit,
                      name: e.target.value,
                    })
                  }
                />
              </label>
              <div className="admin-form-grid">
                {planEdit.id === professionalPlanId ? (
                  <>
                    {[
                      ['purchase_price', 'سعر الإطلاق بالدينار', 1, '0.01', 9999999999],
                      ['standard_price', 'السعر العادي بالدينار', 1, '0.01', 9999999999],
                      ['launch_branches', 'عدد الفروع في عرض الإطلاق', 0, '1', 100000],
                      ['free_ticket_limit', 'حد التيكيات الشهري للمجانية', 1, '1', 100000],
                    ].map(([field, label, min, step, max]) => (
                      <label key={field}>
                        {bippoT(label)}
                        <input
                          type="number"
                          required
                          min={min}
                          max={max}
                          step={step}
                          value={planEdit[field] ?? ''}
                          onChange={(e) => setPlanEdit({ ...planEdit, [field]: e.target.value })}
                        />
                      </label>
                    ))}
                    <p className="admin-span">
                      {bippoT('ضع 0 في عدد فروع العرض باش تنتقل للسعر العادي.')}
                    </p>
                  </>
                ) : (
                  <>
                    <label>
                      {bippoT('السعر الشهري — اختياري')}
                      <input
                        type="number"
                        min="0"
                        max="9999999999"
                        step="0.01"
                        value={planEdit.monthly_price}
                        onChange={(e) =>
                          setPlanEdit({
                            ...planEdit,
                            monthly_price: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      {bippoT('العملة')}
                      <select
                        value={planEdit.currency}
                        onChange={(e) =>
                          setPlanEdit({
                            ...planEdit,
                            currency: e.target.value,
                          })
                        }
                      >
                        <option>DZD</option>
                        <option>EUR</option>
                        <option>USD</option>
                      </select>
                    </label>
                  </>
                )}
              </div>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={planEdit.active}
                  onChange={(e) =>
                    setPlanEdit({
                      ...planEdit,
                      active: e.target.checked,
                    })
                  }
                />
                {bippoT(' متاحة للاشتراكات الجديدة')}
              </label>
              <p className="admin-form-note">
                {bippoT('تعديل السعر يغيّر السعر المعروض للمحلات المرتبطة، ولا يخصم أي مبلغ.')}
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button full" disabled={busy}>
                {bippoT('حفظ الخطة')}
              </button>
            </form>
          </Modal>
        )}
        {sheetShop && (
          <Modal title={sheetShop.name} close={() => setSheet(null)}>
            <ShopSheet
              shop={sheetShop}
              sub={subFor(sheetShop.id)}
              plan={planFor(subFor(sheetShop.id)?.plan_id)}
              row={overview.find((r) => r.id === sheetShop.id)}
              freeLimit={freeLimit}
              notes={subFor(sheetShop.id)?.notes}
              branches={shops.filter((b) =>
                overview.some((r) => r.id === b.id && r.parent_id === sheetShop.id),
              )}
              invitedBy={shops.find(
                (s) => s.id === overview.find((r) => r.id === sheetShop.id)?.source?.referred_by,
              )}
              invited={shops.filter((s) =>
                overview.some((r) => r.id === s.id && r.source?.referred_by === sheetShop.id),
              )}
              onEdit={() => {
                setSheet(null);
                openShop(sheetShop);
              }}
            />
          </Modal>
        )}
        {teamForm && (
          <Modal title={bippoT('ربط حساب بمحل')} close={() => !busy && setTeamForm(null)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                perform(
                  async () => {
                    const id = await findAccount(teamForm.user_id);
                    if (!id) throw new Error(bippoT('ما لقيناش حساب بهذا الإيميل ولا الرقم.'));
                    await saveMember(id, teamForm.shop_id);
                  },
                  bippoT('تسجّل ربط الحساب.'),
                  () => setTeamForm(null),
                );
              }}
            >
              <label>
                {bippoT('إيميل الحساب، رقم التليفون ولا UUID')}
                <input
                  dir="ltr"
                  autoFocus
                  required
                  value={teamForm.user_id}
                  onChange={(e) =>
                    setTeamForm({
                      ...teamForm,
                      user_id: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                {bippoT('المحل')}
                <select
                  required
                  value={teamForm.shop_id}
                  onChange={(e) =>
                    setTeamForm({
                      ...teamForm,
                      shop_id: e.target.value,
                    })
                  }
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="admin-form-note">
                {bippoT('الحساب يقدر يكون مربوط بمحل واحد. حفظ ربط جديد يبدّل المحل السابق.')}
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button full" disabled={busy}>
                {bippoT('حفظ الربط')}
              </button>
            </form>
          </Modal>
        )}
        {revoke && (
          <Modal title={bippoT('نزع ربط الحساب؟')} close={() => !busy && setRevoke(null)}>
            <p>
              {bippoT(
                'الحساب يفقد وصوله لطلبات المحل. الحساب نفسه ما يتمسحش، وصلاحية أدمين المنصة ما تتبدّلش.',
              )}
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="admin-form-footer">
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  perform(
                    () => removeMember(revoke.user_id),
                    bippoT('تنحّى ربط الحساب.'),
                    () => setRevoke(null),
                  )
                }
              >
                {bippoT('نزع الربط')}
              </button>
              <button className="button outline" disabled={busy} onClick={() => setRevoke(null)}>
                {bippoT('إلغاء')}
              </button>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}
function Badge({ status }) {
  const labels = {
    active: bippoT('نشط'),
    suspended: bippoT('موقوف'),
    trial: bippoT('تجريبي'),
    past_due: bippoT('متأخر'),
    cancelled: bippoT('ملغى'),
    expired: bippoT('منتهي'),
    archived: bippoT('مؤرشفة'),
    none: bippoT('بدون اشتراك'),
  };
  return (
    <span className={'admin-badge ' + status}>
      <i />
      {labels[status] || status}
    </span>
  );
}
function Empty({ text }) {
  return (
    <div className="admin-empty">
      <Store size={31} />
      <p>{text}</p>
    </div>
  );
}
function Activity({ rows, shops, compact = false }) {
  const entities = {
      shops: bippoT('محل'),
      subscriptions: bippoT('اشتراك'),
      plans: bippoT('خطة'),
      memberships: bippoT('ربط حساب'),
      announcements: bippoT('إعلان'),
      platform_admins: bippoT('صلاحية أدمين'),
    },
    actions = {
      INSERT: bippoT('إضافة'),
      UPDATE: bippoT('تعديل'),
      DELETE: bippoT('نزع'),
      SAVE: bippoT('حفظ'),
    };
  return (
    <section className="panel admin-section admin-audit">
      <div className="admin-section-title">
        <div>
          <h2>{bippoT('آخر التغييرات')}</h2>
          <p>
            {compact
              ? bippoT('سجل واضح لتغييرات الإدارة.')
              : bippoT('آخر 100 عملية. السجل غير قابل للتعديل من الواجهة.')}
          </p>
        </div>
        <History size={19} />
      </div>
      {rows.length ? (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{bippoT('العملية')}</th>
                <th>{bippoT('العنصر')}</th>
                <th>{bippoT('التاريخ')}</th>
                {!compact && <th>{bippoT('حساب الأدمين')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {actions[r.action] || r.action} {entities[r.entity] || r.entity}
                  </td>
                  <td>
                    {shops.find((s) => s.id === r.entity_id)?.name || r.entity_id.slice(0, 8)}
                  </td>
                  <td>{new Date(r.created_at).toLocaleString(bippoLocale)}</td>
                  {!compact && (
                    <td>
                      <code>{r.actor_id?.slice(0, 8) || bippoT('تجربة')}</code>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text={bippoT('مازال ما كاش تغييرات إدارية مسجّلة.')} />
      )}
    </section>
  );
}
