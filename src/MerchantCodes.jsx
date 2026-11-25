import React, { useEffect, useRef, useState } from 'react';
import {
  ChefHat,
  ChevronDown,
  Copy,
  Monitor,
  Plus,
  Printer,
  RefreshCw,
  Tablet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { t, ticketLink } from './i18n.js';
import { cloud, db } from './store';
import { rememberBranch } from './merchantBranches';
import { CounterPoster } from './CounterTicket';
import { workspaceAction } from './MerchantTeam';
import ShopSettings from './ShopSettings.jsx';
import { saveScreenLanguage } from './shopSettings';
import ScreenStylePicker from './ScreenStylePicker';
import './merchant-codes.css';

function screenLink(screen, shopId) {
  const link = new URL('/dashboard/' + screen, location.origin);
  if (shopId) link.searchParams.set('branch', shopId);
  return link.href;
}

function ScreenActions({ link, showField = false }) {
  const [message, setMessage] = useState('');
  return (
    <>
      {showField && (
        <input
          aria-label={t('رابط الشاشة')}
          dir="ltr"
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
        />
      )}
      <div className="branch-code-actions">
        <a className="button small" href={link} target="_blank" rel="noreferrer">
          {t('افتح الشاشة')}
        </a>
        <button
          type="button"
          className="button outline small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setMessage(t('نُسخ الرابط'));
            } catch {
              setMessage(t('تعذر نسخ الرابط.'));
            }
          }}
        >
          <Copy size={15} />
          {t('نسخ الرابط')}
        </button>
      </div>
      {message && <small role="status">{message}</small>}
    </>
  );
}

// The short TV address of a branch's call screen: bipilo.app/tv/k7m2x9.
export function shortScreenLink(code) {
  return code ? new URL('/tv/' + code, location.origin).href : null;
}

export function waitingDisplayLink(
  token,
  venue,
  branch,
  clinic,
  calls = false,
  code = null,
  lang = null,
) {
  // The short address takes its language from the server (the branch's setting).
  if (calls && !clinic && code) return shortScreenLink(code);
  // «شاشة النداء» on a real branch opens /tv.html: a plain page that old TV
  // browsers can run (the main site needs a recent browser). The trial keeps
  // the in-app screen, which reads this browser's own orders.
  if (calls && !clinic && token !== 'local') {
    const tv = new URL('/tv.html', location.origin);
    tv.searchParams.set('t', token);
    tv.searchParams.set('lang', lang || new URL(ticketLink('x')).searchParams.get('lang') || 'ar');
    if (venue) tv.searchParams.set('venue', venue);
    if (branch && branch !== venue) tv.searchParams.set('venueBranch', branch);
    return tv.href;
  }
  const url = new URL(ticketLink('display/' + token));
  if (lang) url.searchParams.set('lang', lang);
  if (clinic) url.searchParams.set('queue', '1');
  // «شاشة النداء»: only the called numbers, for shops using «نداء سريع».
  if (calls) url.searchParams.set('calls', '1');
  if (venue) url.searchParams.set('venue', venue);
  if (branch && branch !== venue) url.searchParams.set('venueBranch', branch);
  return url.href;
}

// The branch's waiting-screen token ('local' in the trial).
export function useWaitingToken() {
  const [token, setToken] = useState(cloud ? null : 'local');
  const [code, setCode] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    db.rpc('waiting_screen_link').then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setError(t('تعذر تحميل رابط شاشة الانتظار.'));
      else setToken(data);
    });
    // The short code for typing on a TV remote; the long link still works without it.
    db.rpc('waiting_screen_code').then(({ data, error }) => {
      if (active && !error && typeof data === 'string') setCode(data);
    });
    return () => {
      active = false;
    };
  }, []);
  return { token, setToken, code, setCode, error, setError };
}

function WaitingScreen({
  canManage,
  venue,
  branch,
  clinic,
  language = 'ar',
  onLanguage,
  screenStyle,
  onStyle,
}) {
  const { token, setToken, code, setCode, error, setError } = useWaitingToken();
  const [lang, setLang] = useState(language === 'fr' ? 'fr' : 'ar');
  const [langBusy, setLangBusy] = useState(false);
  const link = token ? waitingDisplayLink(token, venue, branch, clinic, false, null, lang) : null;
  const callsLink =
    token && !clinic ? waitingDisplayLink(token, venue, branch, false, true, code, lang) : null;
  const tvAddress = !clinic && code ? shortScreenLink(code).replace(/^https?:\/\//, '') : null;
  const [busy, setBusy] = useState(false);

  async function changeLanguage(next) {
    const previous = lang;
    setLang(next);
    setLangBusy(true);
    setError('');
    try {
      await saveScreenLanguage(next);
      onLanguage?.(next);
    } catch (e) {
      setLang(previous);
      setError(e.message);
    } finally {
      setLangBusy(false);
    }
  }

  async function rotate() {
    if (!window.confirm(t('تبدّل رابط شاشة الانتظار؟ الرابط القديم يتوقف.'))) return;
    setBusy(true);
    setError('');
    try {
      const { data, error } = await db.rpc('waiting_screen_link', { rotate: true });
      if (error || !data) throw error || new Error();
      setToken(data);
      // The short TV address changes too, so old screens stop.
      const next = await db.rpc('waiting_screen_code', { rotate: true });
      if (!next.error && typeof next.data === 'string') setCode(next.data);
    } catch {
      setError(t('تعذر تغيير رابط شاشة الانتظار.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="branch-code-card">
      <h3>
        <Monitor size={19} />
        {t('شاشة الانتظار')}
      </h3>
      <p>{t('افتح الرابط في متصفح التلفزيون أو التابلت لعرض أرقام الطلبات.')}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <label className="branch-screen-language">
        {t('لغة الشاشة')}
        <select
          value={lang}
          disabled={!canManage || langBusy}
          onChange={(event) => changeLanguage(event.target.value)}
        >
          <option value="ar">العربية</option>
          <option value="fr">Français</option>
        </select>
        <small>
          {t('الكتابة والنداء في التلفاز يتبعو هاذ اللغة. التلفاز يتبدّل وحدو في دقائق.')}
        </small>
      </label>
      <ScreenStylePicker value={screenStyle} canManage={canManage} onSaved={onStyle} />
      {!link && !error && <p role="status">{t('جارٍ الاتصال…')}</p>}
      {link && <ScreenActions key={link} link={link} showField />}
      {callsLink && (
        <div className="branch-calls-screen">
          <h4>{t('شاشة النداء')}</h4>
          <p>{t('النداءات برك، بلا «قيد التحضير». للمحلات اللي تخدم بـ «نداء سريع».')}</p>
          {tvAddress && (
            <div className="branch-tv-address">
              <span>{t('اكتب هاذ العنوان في متصفح التلفاز:')}</span>
              <b dir="ltr">{tvAddress}</b>
            </div>
          )}
          <ScreenActions key={callsLink} link={callsLink} />
        </div>
      )}
      {link && cloud && canManage && (
        <button type="button" className="button outline small" disabled={busy} onClick={rotate}>
          <RefreshCw size={15} />
          {t('تغيير الرابط')}
        </button>
      )}
    </article>
  );
}

function BranchTools({ shop, canManage, onSaved, foodService, venue }) {
  const clinic = shop.kind === 'clinic';
  const fixed = ['counter', 'invoice'].includes(shop.tracking_mode);
  const customer = screenLink('customer-screen', shop.shop_id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsSummary = useRef(null);
  const posterEnabled = clinic || fixed;
  return (
    <div className="branch-tools">
      <header>
        <h2>{t('كيفاش يمسح الزبون الكود؟')}</h2>
        <p>{t('اختار الطريقة المناسبة للفرع.')}</p>
      </header>
      <div className="merchant-code-grid">
        <article className="branch-code-card">
          <h3>
            <Printer size={19} />
            {t('الكود المطبوع')}
          </h3>
          <CounterPoster shop={shop} clinic={clinic} enabled={posterEnabled} />
          {!posterEnabled && (
            <>
              <p>{t('معاينة فقط. فعّل QR ثابت في إعدادات الفرع باش تقدر تطبعه وتستعمله.')}</p>
              {canManage && (
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => {
                    setSettingsOpen(true);
                    settingsSummary.current?.focus();
                  }}
                >
                  {t('افتح إعدادات الفرع')}
                </button>
              )}
            </>
          )}
        </article>
        {!clinic && (
          <article className="branch-code-card">
            <h3>
              <Tablet size={19} />
              {t('شاشة الزبون (تابلت)')}
            </h3>
            <p>{t('امسح هذا الرمز بالتابلت باش تفتح شاشة مشاركة الأكواد.')}</p>
            <div className="branch-screen-qr">
              <QRCodeSVG value={customer} size={126} marginSize={4} />
            </div>
            <ScreenActions key={customer} link={customer} />
          </article>
        )}
      </div>
      <h2>{t('شاشات إضافية (اختياري)')}</h2>
      <div className="merchant-code-grid">
        {foodService && (
          <article className="branch-code-card">
            <h3>
              <ChefHat size={19} />
              {t('شاشة المطبخ')}
            </h3>
            <p>{t('من التابلت في المطبخ، علّم الطلب جاهز باش يتحدّث عند الزبون.')}</p>
            <ScreenActions link={screenLink('kitchen', shop.shop_id)} showField />
          </article>
        )}
        <WaitingScreen
          key={shop.shop_id}
          canManage={canManage}
          venue={venue || shop.name}
          branch={shop.name}
          clinic={clinic}
          language={shop.display_language}
          onLanguage={(display_language) => onSaved?.({ ...shop, display_language })}
          screenStyle={shop.display_style}
          onStyle={(display_style) => onSaved?.({ ...shop, display_style })}
        />
      </div>
      {canManage && (
        <details
          className="branch-settings"
          open={settingsOpen}
          onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
        >
          <summary ref={settingsSummary}>
            {t('إعدادات الفرع')}
            <ChevronDown size={17} />
          </summary>
          {settingsOpen && <ShopSettings branchOnly onSaved={onSaved} />}
        </details>
      )}
    </div>
  );
}

export default function MerchantCodes({
  shop,
  error,
  workspace,
  refresh,
  onSaved,
  canManage,
  foodService,
  adding,
  setAdding,
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  if (!shop && !workspace?.branches?.length)
    return error ? (
      <p role="alert" className="error">
        {error}
      </p>
    ) : (
      <p role="status">{t('نحمّلو الإعدادات…')}</p>
    );
  const active = workspace?.active || shop?.shop_id;
  const branches = workspace?.branches?.length
    ? workspace.branches
    : [{ id: active, name: shop?.name, city: shop?.city }];

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setFailure('');
    try {
      await workspaceAction('create_branch', { name: name.trim() });
      setAdding(false);
      setName('');
      await refresh();
    } catch {
      setFailure(t('تعذر حفظ التغيير. عاود المحاولة.'));
    } finally {
      setBusy(false);
    }
  }

  function select(id) {
    rememberBranch(id);
    if (location.pathname === '/dashboard/codes' && !location.hash) location.reload();
    else location.assign('/dashboard/codes');
  }

  return (
    <div className="merchant-branches-codes">
      {workspace?.manager && (
        <div className="branch-add">
          <button
            type="button"
            className="button small"
            aria-expanded={adding}
            onClick={() => setAdding((value) => !value)}
          >
            <Plus size={17} />
            {t('فرع جديد')}
          </button>
          {adding && (
            <form className="panel" onSubmit={create}>
              <label>
                {t('اسم الفرع')}
                <input
                  autoFocus
                  value={name}
                  maxLength={100}
                  required
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <button className="button small" disabled={busy || !name.trim()}>
                {t('زيد فرع')}
              </button>
            </form>
          )}
          {failure && (
            <p role="alert" className="error">
              {failure}
            </p>
          )}
        </div>
      )}
      {branches.map((branch, index) => {
        const selected = branch.id === active;
        const title = (
          <>
            <span>
              <strong>{selected && shop ? shop.name : branch.name}</strong>
              {branch.status && (
                <small className={'branch-status ' + branch.status}>
                  {t(branch.status === 'active' ? 'شغّال' : 'موقوف')}
                </small>
              )}
              <small className="branch-caption">
                {branch.city || (branch.id === workspace?.home ? t('الفرع الرئيسي') : '')}
              </small>
            </span>
            <ChevronDown size={18} />
          </>
        );
        return selected ? (
          <details className="branch-block" key={branch.id || index} open>
            <summary>{title}</summary>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {shop && (
              <BranchTools
                key={shop.shop_id}
                shop={shop}
                onSaved={onSaved}
                canManage={canManage}
                foodService={foodService}
                venue={branches.find((item) => item.id === workspace?.home)?.name}
              />
            )}
          </details>
        ) : (
          <section className="branch-block" key={branch.id}>
            <button type="button" className="branch-switch" onClick={() => select(branch.id)}>
              {title}
            </button>
          </section>
        );
      })}
    </div>
  );
}
