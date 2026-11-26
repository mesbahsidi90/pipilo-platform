import { printWithTitle } from './pageTitle';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import Brand from './Brand';
import { clinicRoute } from './ClinicQueue';
import { language, t, ticketLink, translate } from './i18n.js';
import { BellRing } from 'lucide-react';
import {
  claimCounterTicket,
  counterRoute,
  counterTicket,
  invoiceRoute,
  normalizeTrackingCode,
} from './counterAccess.js';
import './counter-ticket.css';
import { sandbox } from './store';
import { trialPlaceId } from './trialSync';

export function CounterPoster({ shop, clinic = false, enabled = true }) {
  const preview = useRef(null);
  const invoice = !clinic && shop.tracking_mode === 'invoice';
  const route = clinic ? clinicRoute : invoice ? invoiceRoute : counterRoute;
  // In the trial, any phone reaches the trial's server copy.
  const url = ticketLink(sandbox ? 'trial-place/' + trialPlaceId() : route(shop.shop_id));
  function downloadCode() {
    const svg = preview.current?.querySelector('svg');
    if (!svg) return;
    const file = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const fileUrl = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = fileUrl;
    anchor.download = 'bippo-counter-qr.svg';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  }
  // A6 card for the counter, in the shop's own colour.
  const ink =
    (shop.display_style?.theme === 'custom' && shop.display_style.palette?.latest) || '#0c3e38';
  const other = language === 'fr' ? 'ar' : 'fr';
  const title = 'سكاني الـ QR';
  const promise = clinic ? 'وكي يجي دورك، نبيبيولك!' : 'وكي توجد لاكوموند، نبيبيولك!';
  const poster = (
    <article className="counter-poster" style={{ '--poster-ink': ink }}>
      <header className="counter-poster-top">
        {shop.logo ? (
          <img src={shop.logo} alt="" />
        ) : (
          <span aria-hidden="true">{Array.from(shop.name || 'B')[0].toUpperCase()}</span>
        )}
        <h3 dir="auto">{shop.name}</h3>
      </header>
      <div className="counter-poster-title">
        <h4>{t(title)}</h4>
      </div>
      <div className="counter-poster-qr">
        <QRCodeSVG value={url} size={220} marginSize={1} fgColor="#111" />
      </div>
      <p className="counter-poster-promise">
        <BellRing size={24} aria-hidden="true" />
        {t(promise)}
      </p>
      <p className="counter-poster-other" dir={other === 'fr' ? 'ltr' : 'rtl'}>
        {translate(title, other)} · {translate(promise, other)}
      </p>
      <footer className="counter-poster-foot">
        <span>{t('بلا تطبيق · بلا تسجيل')}</span>
        <span dir="ltr">
          by <b>Bipilo</b>
        </span>
      </footer>
    </article>
  );
  return (
    <section className="counter-settings">
      <div ref={preview}>{poster}</div>
      <button
        type="button"
        className="button outline"
        disabled={!enabled}
        onClick={() => printWithTitle(t('اطبع الكود'))}
      >
        {t('طباعة ملصق الكونتوار')}
      </button>
      <button type="button" className="button outline" disabled={!enabled} onClick={downloadCode}>
        {t('تحميل QR بصيغة SVG')}
      </button>
      {enabled &&
        createPortal(
          <div className="receipt-print-root counter-print">{poster}</div>,
          document.body,
        )}
    </section>
  );
}

export default function CounterTicket({ branch }) {
  const [shop, setShop] = useState(undefined);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestKey = useRef(null);

  useEffect(() => {
    let active = true;
    const storageKey = 'bipilo-counter-claim/' + branch;
    try {
      requestKey.current ||= sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, requestKey.current);
    } catch {
      requestKey.current ||= crypto.randomUUID();
    }
    claimCounterTicket(branch, requestKey.current)
      .then((result) => {
        if (!active) return;
        if (result?.token) {
          try {
            sessionStorage.removeItem(storageKey);
          } catch {}
          location.replace('#track/' + result.token);
        } else {
          setShop(result);
        }
      })
      .catch(() => {
        if (active) setError(t('تعذر الاتصال. عاود المحاولة.'));
      });
    return () => {
      active = false;
    };
  }, [branch, retry]);

  async function submit(event) {
    event.preventDefault();
    const normalized = normalizeTrackingCode(code);
    if (!/^[0-9A-F]{12}$/.test(normalized)) {
      setError(t('تأكد من كود المتابعة وعاود.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await counterTicket(branch, normalized);
      if (result?.token) location.hash = 'track/' + result.token;
      else setError(t('الكود غير صالح أو فات وقت المتابعة. اسأل الكاشير.'));
    } catch {
      setError(t('تعذر الاتصال. عاود المحاولة.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap counter-guest">
      <Brand linked={false} />
      <section className="panel">
        <h1>{shop?.name || t('تابع طلبك')}</h1>
        {shop === undefined && !error && <p role="status">{t('جارٍ الاتصال…')}</p>}
        {shop === null && <p>{t('متابعة الطلبات بهذا الرمز غير متاحة. اسأل الكاشير.')}</p>}
        {shop && Object.hasOwn(shop, 'token') && (
          <>
            <p role="status">{t('ما كاش طلب ينتظر المسح. خلي الكاشير يسجّل طلبك ومن بعد عاود.')}</p>
            <button
              className="button full"
              type="button"
              onClick={() => {
                setShop(undefined);
                setError('');
                setRetry((value) => value + 1);
              }}
            >
              {t('عاود المحاولة')}
            </button>
          </>
        )}
        {shop && (
          <details open={!Object.hasOwn(shop, 'token')}>
            <summary>{t('عندك كود متابعة مكتوب؟')}</summary>
            <form onSubmit={submit}>
              <label>
                {t('كود المتابعة')}
                <input
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  maxLength={20}
                  placeholder="A1B2-C3D4-E5F6"
                />
              </label>
              <button className="button full" disabled={busy}>
                {t('افتح الطلب')}
              </button>
            </form>
          </details>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {shop === undefined && error && (
          <button
            className="button"
            onClick={() => {
              setError('');
              setRetry((value) => value + 1);
            }}
          >
            {t('عاود المحاولة')}
          </button>
        )}
      </section>
    </main>
  );
}
