import { t as bippoT, language, ticketLink } from './i18n.js';
import { remembered, setRemembered } from './sessionRules';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowUpLeft,
  Plus,
  Monitor,
  ExternalLink,
  Copy,
  CheckCheck,
  Radio,
  LogOut,
  ChefHat,
  ScanLine,
  ArrowLeft,
  Menu,
  X,
  Printer,
  Star,
} from 'lucide-react';
import {
  sandbox,
  cloud,
  db,
  listOrders,
  createOrder,
  transition,
  track,
  display,
  subscribe,
} from './store';
import { statuses } from './domain';
import './style.css';
import './redesign.css';
import Landing, { Brand } from './Landing';

// Remember which ad, post or flyer link brought this visitor (for signup).
captureVisit();
const Account = lazy(() => import('./Account'));
const Signup = lazy(() => import('./Signup'));
const TryShop = lazy(() => import('./TryShop'));
const SandboxBar = lazy(() => import('./TryShop').then((m) => ({ default: m.SandboxBar })));
import PublicPages from './PublicPages';
import { publicRoutes, pageInfo } from './publicContent';
const ResetPassword = lazy(() => import('./ResetPassword'));
const Admin = lazy(() => import('./Admin'));
import { ticketBranding } from './shopSettings';
import WaitingBoard from './WaitingBoard';
import ClinicQueue, { QueuePlace } from './ClinicQueue';
import { captureVisit } from './signupSource';
const Orders = lazy(() => import('./Orders'));
import OrderAlerts from './OrderAlerts';
import FollowTicket from './FollowTicket';
import { DemoCustomer } from './LiveDemo';
import CustomerPager from './CustomerPager';
import './alerts-reports.css';
import './signup-links.css';
import './merchant-login.css';
import LanguageSwitcher from './LanguageSwitcher';
import Receipt from './Receipt';
const AcceptInvite = lazy(() => import('./AcceptInvite'));
import { rememberBranch } from './merchantBranches';
import { shopActivity, shopTypes } from './shopActivities';
import CounterTicket from './CounterTicket';
import InvoiceTicket from './InvoiceTicket';
import { counterRoute, trackingCode } from './counterAccess.js';
import ReviewCard from './ReviewCard';
import { getSettings } from './shopSettings';
import { signalGuest, guestExtras } from './guestApi';
import { reviewUrl } from './guestExperience';
import './guest-experience.css';
import { printWithTitle, usePanelTitle, useRouteTitle } from './pageTitle';
import { readRoute, dashboardDestination } from './routes';
import LoyaltyCard from './LoyaltyCard';
import MenuView from './MenuView';
import { ticketMenu } from './menu';
import { OnlineOrderSummary } from './OrderCheckout';
const MenuPage = lazy(() => import('./MenuPage'));
import { loyaltyCard } from './loyalty';
import WhatsAppCode from './WhatsAppCode';
import SignInMethod from './SignInMethod';
const route = readRoute(location);
if (
  route[0] === 'home' &&
  !location.hash &&
  (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone)
) {
  const ticket = localStorage.getItem('bippo-last-ticket');
  if (ticket)
    route.splice(
      0,
      2,
      localStorage.getItem('bippo-last-ticket-route') === 'demo' ? 'demo' : 'track',
      ticket,
    );
  else route.splice(0, 2, 'follow', '');
}
const link = (path) => ticketLink(path);
const homeTitle =
  language === 'fr'
    ? 'Bipilo | Gestion des files et appel des clients'
    : 'Bipilo | تنظيم الطابور ونداء الزبائن';
const routeTitles = {
  queue: bippoT('خذ رقم دور'),
  account: bippoT('الحساب'),
  admin: bippoT('إدارة المنصة'),
  invoice: bippoT('تتبّع الطلب'),
  counter: bippoT('تتبّع الطلب'),
  login: bippoT('تسجيل الدخول'),
  dashboard: bippoT('لوحة التحكم'),
  demo: bippoT('تجربة Bipilo'),
  jarreb: bippoT('جرّب لوحة التحكم'),
  display: bippoT('شاشة الانتظار'),
  follow: bippoT('تتبّع الطلب'),
  invite: bippoT('قبول الدعوة'),
  reset: bippoT('استرجاع كلمة المرور'),
  signup: bippoT('إنشاء حساب'),
  track: bippoT('تتبّع الطلب'),
};
function App() {
  const [page, setPage] = useState(route[0]);
  const [token, setToken] = useState(route[1] || '');
  const title = Object.hasOwn(routeTitles, page)
    ? routeTitles[page]
    : publicRoutes.includes(page)
      ? pageInfo[page].tag
      : null;
  useRouteTitle(title ? title + ' | Bipilo' : homeTitle);
  useEffect(() => {
    const change = () => {
      const [p, t] = readRoute(location);
      setPage(p);
      setToken(t || '');
    };
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  const view = publicRoutes.includes(page) ? (
    <PublicPages key={page} page={page} />
  ) : page === 'invite' ? (
    <AcceptInvite key={token} token={token} />
  ) : page === 'jarreb' ? (
    <TryShop />
  ) : page === 'signup' ? (
    <Signup key={token} initialKind={Object.hasOwn(shopTypes, token) ? token : 'cafe'} />
  ) : page === 'demo' ? (
    <DemoCustomer key={token} token={token} />
  ) : page === 'queue' ? (
    <ClinicQueue key={token} branch={token} />
  ) : page === 'invoice' ? (
    <InvoiceTicket key={token} branch={token} />
  ) : page === 'menu' ? (
    <MenuPage key={token} branch={token} />
  ) : page === 'counter' ? (
    <CounterTicket key={token} branch={token} />
  ) : page === 'follow' ? (
    <FollowTicket />
  ) : page === 'reset' ? (
    <ResetPassword />
  ) : page === 'admin' ? (
    <Admin />
  ) : page === 'account' ? (
    <Account />
  ) : page === 'track' ? (
    <Customer key={token} token={token} />
  ) : page === 'display' ? (
    <Display key={token} token={token} />
  ) : page === 'login' ? (
    <Dashboard loginPage />
  ) : page === 'dashboard' ? (
    <Dashboard key={token} workspace={token} />
  ) : (
    <Landing />
  );
  // No trial bar on the full-screen displays (TV, kitchen, counter tablet).
  const screen =
    page === 'display' || (page === 'dashboard' && ['kitchen', 'customer-screen'].includes(token));
  if (!sandbox || page === 'jarreb' || screen) return view;
  return (
    <>
      <Suspense fallback={null}>
        <SandboxBar />
      </Suspense>
      {view}
    </>
  );
}
function useLive(loader, deps = []) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [last, setLast] = useState(null);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const result = await loader();
        if (alive) {
          setData(result);
          setError('');
          setLast(new Date());
        }
      } catch (e) {
        if (alive) setError(e.message || bippoT('تعذر الاتصال'));
      }
    };
    refresh();
    const stop = subscribe(refresh);
    return () => {
      alive = false;
      stop();
    };
  }, deps);
  return {
    data,
    error,
    last,
  };
}
function Dashboard({ workspace, loginPage = false }) {
  const [session, setSession] = useState(null),
    [authReady, setAuthReady] = useState(!cloud);
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = db.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!authReady) return;
    if (loginPage && (session || !cloud)) {
      location.replace(dashboardDestination(location.search));
    } else if (!loginPage && cloud && !session) {
      const next = new URL('/dashboard' + (workspace ? '/' + workspace : ''), location.origin);
      const branch = new URLSearchParams(location.search).get('branch');
      if (branch) next.searchParams.set('branch', branch);
      const target = dashboardDestination(
        '?next=' + encodeURIComponent(next.pathname + next.search),
      );
      location.replace('/login?next=' + encodeURIComponent(target));
    }
  }, [authReady, loginPage, session, workspace]);
  if (!authReady)
    return (
      <main className="merchant-login">
        <p role="status">{bippoT('جارٍ الاتصال…')}</p>
      </main>
    );
  if (loginPage) return cloud && !session ? <Login /> : null;
  return cloud && !session ? null : <Orders Share={Share} workspace={workspace} />;
}

function Login() {
  usePanelTitle(bippoT('تسجيل الدخول'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState('whatsapp');
  const [remember, setRemember] = useState(() => {
    try {
      return remembered(localStorage);
    } catch {
      return true;
    }
  });
  function chooseRemember(on) {
    setRemember(on);
    try {
      setRemembered(localStorage, on);
    } catch {
      // Without storage the sign-in stays in this tab only.
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      rememberBranch(null);
      const result = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
    } catch {
      setError(bippoT('تعذر الدخول. تحقق من البريد وكلمة المرور.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="merchant-login">
      <div className="merchant-login-content">
        <Brand />
        <h1>{bippoT('أهلًا بعودتك')}</h1>
        <SignInMethod value={method} onChange={setMethod} />
        {method === 'whatsapp' ? (
          <>
            <p>{bippoT('ادخل برقم الهاتف تاع حسابك، نبعثولك كود في واتساب.')}</p>
            <WhatsAppCode
              existingOnly
              onVerified={() => {
                rememberBranch(null);
              }}
            />
          </>
        ) : (
          <>
            <p>{bippoT('ادخل بالبريد الإلكتروني وكلمة المرور تاع حسابك.')}</p>
            <form onSubmit={submit} aria-busy={busy}>
              <label>
                {bippoT('البريد الإلكتروني')}
                <input
                  type="email"
                  name="email"
                  dir="ltr"
                  autoComplete="username"
                  placeholder="nom@exemple.com"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                {bippoT('كلمة المرور')}
                <input
                  type="password"
                  name="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="button" disabled={busy || !email.trim() || !password}>
                {busy ? bippoT('جارٍ الاتصال…') : bippoT('دخول')}
              </button>
            </form>
          </>
        )}
        <label className="remember-device">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => chooseRemember(event.target.checked)}
          />
          <span>
            {bippoT('تذكّرني على هذا الجهاز')}
            <small>
              {remember
                ? bippoT('ما نطلبوش كود في كل مرة. إذا ما فتحتش 30 يوم، نطلبوه.')
                : bippoT('جهاز مشترك: تخرج وحدك كي تسكّر المتصفح.')}
            </small>
          </span>
        </label>
        <div className="merchant-login-links">
          <a href="/forgot-password">{bippoT('نسيت كلمة المرور؟')}</a>
          <a href="/signup">{bippoT('إنشاء حساب')}</a>
        </div>
      </div>
    </main>
  );
}

function Share({ order, close }) {
  const [copied, setCopied] = useState(false),
    [branding, setBranding] = useState(null),
    [width, setWidth] = useState('80'),
    [preview, setPreview] = useState(false),
    [printError, setPrintError] = useState('');
  const url = link('track/' + order.token);
  const fixed = branding?.kind !== 'clinic' && branding?.tracking_mode === 'counter';
  const counterUrl = fixed && order.counter_pending ? link(counterRoute(branding.shop_id)) : null;
  const code = fixed && order.counter_pending == null ? trackingCode(order) : '';
  useEffect(() => {
    let live = true;
    getSettings()
      .then((v) => live && setBranding(v))
      .catch(() => live && setPrintError(bippoT('تعذر تحميل بيانات التيكي. أغلق النافذة وعاود.')));
    const esc = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', esc);
    return () => {
      live = false;
      document.removeEventListener('keydown', esc);
    };
  }, []);
  return (
    <div className="modal" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={bippoT('مشاركة الطلب')}
        className="panel share"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          autoFocus
          className="close icon-button"
          onClick={close}
          aria-label={bippoT('إغلاق')}
        >
          <X />
        </button>
        <h2>
          {branding && !shopActivity(branding.kind).foodService ? bippoT('تيكي ') : bippoT('طلب ')}
          {order.number}
        </h2>
        {code ? (
          <>
            <p>{bippoT('الزبون يمسح QR الثابت ويدخل هذا الكود.')}</p>
            <strong className="counter-code" dir="ltr">
              {code}
            </strong>
          </>
        ) : (
          <>
            <p>
              {bippoT(
                counterUrl
                  ? 'خلّي الزبون يمسح QR الثابت هنا أو من ملصق الكونتوار.'
                  : 'ليفتح الزبون الرابط أو يمسح الرمز.',
              )}
            </p>
            <QRCodeSVG value={counterUrl || url} size={210} level="M" marginSize={3} />
          </>
        )}
        <div className="receipt-controls">
          <label className="comparison-sr-only" htmlFor="receipt-width">
            {bippoT('عرض التيكي')}
          </label>
          <select
            id="receipt-width"
            aria-label={bippoT('عرض التيكي')}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          >
            <option value="80">{bippoT('80 مم')}</option>
            <option value="58">{bippoT('58 مم')}</option>
          </select>
          <button
            className="button"
            disabled={!branding}
            onClick={() => printWithTitle(bippoT('طباعة التيكي'))}
          >
            <Printer size={17} />
            {bippoT(' طباعة التيكي')}
          </button>
        </div>
        <button
          className="button outline full"
          disabled={!branding}
          onClick={() => setPreview(true)}
        >
          {bippoT('معاينة التيكي')}
        </button>
        {printError && (
          <p role="alert" className="error">
            {printError}
          </p>
        )}
        <small>
          {bippoT(
            'اختار نفس عرض الورق في نافذة الطباعة، مقياس 100٪، بلا هوامش ولا ترويسة. تقدر تحفظه PDF.',
          )}
        </small>
        <a className="button full" href={'#track/' + order.token} target="_blank" rel="noreferrer">
          {bippoT('افتح صفحة الزبون ')}
          <ExternalLink size={17} />
        </a>
        <button
          className="button outline full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy size={16} />
          {copied ? bippoT('نُسخ الرابط') : bippoT('نسخ الرابط')}
        </button>
        <input
          aria-label={bippoT('رابط الطلب')}
          readOnly
          value={url}
          dir="ltr"
          onFocus={(e) => e.target.select()}
        />
        {!cloud && (
          <small>
            {bippoT('رمز التجربة يعمل في المتصفح نفسه. للأجهزة الأخرى، فعّل Supabase.')}
          </small>
        )}
      </section>
      {branding && (
        <Receipt
          order={order}
          branding={branding}
          url={url}
          code={code}
          width={width}
          preview={preview}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}
function Customer({ token }) {
  const [branding, setBranding] = useState(null),
    [ack, setAck] = useState(() => sessionStorage.getItem('bippo-alert-ack-' + token) === '1'),
    [confirmError, setConfirmError] = useState(''),
    [card, setCard] = useState(null),
    [menu, setMenu] = useState(null);
  useEffect(() => {
    let alive = true;
    ticketBranding(token)
      .then((v) => alive && setBranding(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);
  const {
    data: o,
    error,
    last,
  } = useLive(async () => {
    const order = await track(token);
    if (!order) return null;
    let extras = {};
    try {
      extras = (await guestExtras(token)) || {};
    } catch {}
    return {
      ...order,
      ...extras,
    };
  }, [token]);
  const status = o?.status;
  useEffect(() => {
    // Opening the order links it to this browser's card; a ready order is stamped.
    if (!status || status === 'cancelled') return;
    let alive = true;
    loyaltyCard(token)
      .then((value) => alive && setCard(value))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, status]);
  useEffect(() => {
    let alive = true;
    ticketMenu(token)
      .then((value) => alive && setMenu(value))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);
  const hasMenu = menu?.sections?.some((section) => section.items?.length);
  const report = (event) => signalGuest(token, event).catch(() => false);
  useEffect(() => {
    if (!o || o.status === 'collected') return;
    let alive = true;
    const pulse = () => {
      if (document.visibilityState !== 'visible') return;
      void report('heartbeat');
      if (o.status === 'ready') void report('ready_seen');
      if (sessionStorage.getItem('bippo-alert-armed-' + token) === '1')
        void report('sound_enabled');
      if (
        o.status === 'ready' &&
        sessionStorage.getItem('bippo-alert-ack-' + token) === '1' &&
        !o.coming_at
      )
        void signalGuest(token, 'coming')
          .then(
            (ok) =>
              alive && setConfirmError(ok ? '' : bippoT('ما وصلش تأكيدك للمحل، نعاودو الإرسال.')),
          )
          .catch(() => alive && setConfirmError(bippoT('ما وصلش تأكيدك للمحل، نعاودو الإرسال.')));
    };
    void report('opened');
    pulse();
    const timer = setInterval(pulse, 15000);
    document.addEventListener('visibilitychange', pulse);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', pulse);
    };
  }, [token, o?.status, o?.coming_at]);
  useEffect(() => {
    if (token) {
      localStorage.setItem('bippo-last-ticket', token);
      localStorage.setItem('bippo-last-ticket-route', 'track');
    }
  }, [token]);
  const acknowledge = () => {
    setAck(true);
    void signalGuest(token, 'coming')
      .then((ok) => setConfirmError(ok ? '' : bippoT('ما وصلش تأكيدك للمحل، نعاودو الإرسال.')))
      .catch(() => setConfirmError(bippoT('ما وصلش تأكيدك للمحل، نعاودو الإرسال.')));
  };
  let review = '';
  try {
    review = reviewUrl(o?.google_review_url || '');
  } catch {}
  return (
    <CustomerPager
      branding={branding}
      number={o?.number}
      status={o?.status}
      room={o?.room}
      acknowledged={ack || Boolean(o?.coming_at)}
      loading={!o && !last && !error}
      error={error || (!o && last ? bippoT('راجع موظف المحل باش يعطيك رابط الطلب.') : '')}
      loyalty={
        <>
          <QueuePlace queue={o?.queue} />
          <OnlineOrderSummary online={o?.online} status={o?.status} />
          <LoyaltyCard card={card} />
          {hasMenu && (
            <details className="pager-menu">
              <summary>{bippoT('شوف المنيو')}</summary>
              <MenuView menu={menu} />
            </details>
          )}
        </>
      }
      extra={
        o?.status === 'collected' ? (
          <ReviewCard
            key={token}
            url={review}
            ticket={token}
            allowFeedback={o.private_feedback_enabled}
            alreadySent={o.feedback_sent}
            initialRating={o.rating}
          />
        ) : confirmError ? (
          <p className="guest-confirm-error" role="status">
            {confirmError}
          </p>
        ) : null
      }
    >
      {o && o.status !== 'cancelled' && (
        <OrderAlerts
          ticket={token}
          status={o.status}
          tone={branding?.alert_tone || 'pager'}
          offline={Boolean(error)}
          onEnabled={() => void report('sound_enabled')}
          onPushEnabled={() => void report('push_enabled')}
          onAcknowledge={acknowledge}
          onRefresh={() => window.dispatchEvent(new Event('nawba-change'))}
        />
      )}
    </CustomerPager>
  );
}
function Display({ token }) {
  const { data, error } = useLive(() => display(token), [token]);
  return <WaitingBoard orders={data} error={error} />;
}
createRoot(document.getElementById('root')).render(
  <>
    <Suspense fallback={null}>
      <App />
    </Suspense>
    <LanguageSwitcher />
  </>,
);
import './bippo.css';
import './platform-colors.css';
