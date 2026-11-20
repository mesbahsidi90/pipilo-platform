import React, { useEffect, useRef, useState } from 'react';
import Brand from './Brand';
import { t, ticketLink } from './i18n.js';
import { trialRequest } from './trialSync';
import './counter-ticket.css';

// A fixed QR code of the /jarreb trial, scanned by any phone: a clinic gives a
// number, a counter hands over the cashier's pending order, an invoice asks
// for the number on the receipt. Then the trial ticket opens.
export default function TrialPlace({ place }) {
  const [info, setInfo] = useState(undefined);
  const [state, setState] = useState('idle'); // idle | busy | waiting | taken | paused | error
  const [number, setNumber] = useState('');
  const request = useRef(null);
  if (!request.current) {
    const key = 'bipilo-trial-request/' + place;
    try {
      request.current = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key, request.current);
    } catch {
      request.current = crypto.randomUUID();
    }
  }
  const open = (token) => {
    try {
      sessionStorage.removeItem('bipilo-trial-request/' + place);
    } catch {
      // Nothing to clean.
    }
    location.assign(ticketLink('trial/' + token));
  };

  async function act(route, extra = {}) {
    setState('busy');
    try {
      const result = await trialRequest(route, { place, request: request.current, ...extra });
      if (result.token) return open(result.token);
      setState(
        result.paused ? 'paused' : result.waiting ? 'waiting' : result.taken ? 'taken' : 'error',
      );
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    let alive = true;
    trialRequest('trial-place', { place })
      .then((value) => {
        if (!alive) return;
        setInfo(value);
        // The counter QR hands over the waiting order straight away.
        if (value.kind !== 'clinic' && value.tracking_mode === 'counter') void act('trial-claim');
      })
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [place]);

  const clinic = info?.kind === 'clinic';
  const invoice = !clinic && info?.tracking_mode === 'invoice';
  const busy = state === 'busy';
  return (
    <main className="wrap counter-guest">
      <Brand linked={false} />
      <section className="panel">
        <h1>{info?.name || t(clinic ? 'خذ رقم دور' : 'تابع طلبك')}</h1>
        {info === undefined && <p role="status">{t('جارٍ الاتصال…')}</p>}
        {info === null && <p>{t('انتهت هذي التجربة. اطلب من صاحب المحل تيكي جديد.')}</p>}
        {info && clinic && (
          <>
            {info.paused || state === 'paused' ? (
              <p role="status" className="queue-closed">
                {t('الأرقام وقفت لليوم. توجّه للاستقبال.')}
              </p>
            ) : (
              <>
                <p>{t('خذ رقمك وفعّل التنبيه باش تعرف كي يجي دورك.')}</p>
                <button
                  className="button full"
                  type="button"
                  disabled={busy}
                  onClick={() => act('trial-join')}
                >
                  {t('خذ رقم دور')}
                </button>
              </>
            )}
          </>
        )}
        {info && invoice && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (number.trim()) void act('trial-invoice', { number: number.trim() });
            }}
          >
            <label>
              {t('رقم الطلب في الفاتورة')}
              <input
                dir="ltr"
                inputMode="numeric"
                maxLength={8}
                required
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              />
            </label>
            <button className="button full" disabled={busy || !number.trim()}>
              {t('تابع طلبي')}
            </button>
          </form>
        )}
        {info && !clinic && !invoice && state !== 'waiting' && state !== 'error' && (
          <p role="status">{t('جارٍ الاتصال…')}</p>
        )}
        {state === 'waiting' && (
          <>
            <p role="status">{t('ما كاش طلب ينتظر المسح. خلي الكاشير يسجّل طلبك ومن بعد عاود.')}</p>
            <button type="button" className="button full" onClick={() => act('trial-claim')}>
              {t('عاود المسح')}
            </button>
          </>
        )}
        {state === 'taken' && (
          <p role="alert" className="error">
            {t('هذا الرقم عندو تيكي من قبل. تأكد من رقم الفاتورة.')}
          </p>
        )}
        {state === 'error' && (
          <p role="alert" className="error">
            {t('تعذر الاتصال. عاود المحاولة.')}
          </p>
        )}
        <small>{t('تيكي تجربة Bipilo · يتمسح بعد 6 ساعات.')}</small>
      </section>
    </main>
  );
}
