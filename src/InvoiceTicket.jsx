import React, { useEffect, useRef, useState } from 'react';
import Brand from './Brand';
import { cloud, db, createOrder } from './store';
import { getSettings } from './shopSettings';
import { normalizeNumber } from './domain';
import { t } from './i18n';
import { isBranchId } from './merchantBranches';
import { localDate } from './reporting';
import './counter-ticket.css';

async function invoiceTicket(branch, orderNumber = null, requestKey = null) {
  if (!cloud) {
    const shop = await getSettings();
    if (branch !== 'local' || shop.kind === 'clinic' || shop.tracking_mode !== 'invoice')
      return null;
    if (orderNumber === null) return { name: shop.name };
    const order = await createOrder(orderNumber, { invoiceRequestKey: requestKey });
    return order || { error: 'duplicate' };
  }
  if (!isBranchId(branch)) return null;
  const { data, error } = await db.rpc('invoice_ticket', {
    branch,
    order_number: orderNumber,
    request_key: requestKey,
  });
  if (error?.message === 'BIPILO_MONTHLY_TICKET_LIMIT') return { error: 'unavailable' };
  if (error) throw error;
  return data;
}

export default function InvoiceTicket({ branch }) {
  const [shop, setShop] = useState(undefined);
  const [number, setNumber] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const keys = useRef({});

  useEffect(() => {
    let live = true;
    invoiceTicket(branch)
      .then((result) => {
        if (live) setShop(result);
      })
      .catch(() => {
        if (live) setError(t('تعذر الاتصال. عاود المحاولة.'));
      });
    return () => {
      live = false;
    };
  }, [branch, retry]);

  async function submit(event) {
    event.preventDefault();
    if (busy || !shop) return;
    setError('');
    let normalized;
    try {
      normalized = normalizeNumber(number);
    } catch (failure) {
      setError(failure.message);
      return;
    }

    const storageKey = 'bipilo-invoice/' + branch + '/' + normalized + '/' + localDate(Date.now());
    let key = keys.current[storageKey];
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved && saved.until > Date.now()) key ||= saved.key;
    } catch {}
    key ||= crypto.randomUUID();
    keys.current[storageKey] = key;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ key, until: Date.now() + 86400000 }));
    } catch {}

    setBusy(true);
    try {
      const result = await invoiceTicket(branch, normalized, key);
      if (result?.token) {
        location.replace('#track/' + result.token);
        return;
      }
      if (result?.error === 'duplicate') {
        delete keys.current[storageKey];
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
        setError(t('هذا الرقم مسجّل من قبل. تأكّد من الفاتورة أو اسأل الكاشير.'));
      } else if (result?.error === 'rate_limit') {
        setError(t('كاين طلبات بزاف دُرك. استنّى دقيقة وعاود.'));
      } else {
        setError(t('تسجيل الطلب غير متاح حاليًا. اسأل الكاشير.'));
      }
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
        {shop && (
          <form onSubmit={submit}>
            <label>
              {t('رقم الطلب في الفاتورة')}
              <input
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={4}
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              />
            </label>
            <button className="button full" disabled={busy}>
              {t('تابع طلبك')}
            </button>
          </form>
        )}
        {shop === null && <p>{t('تسجيل الطلب غير متاح حاليًا. اسأل الكاشير.')}</p>}
        {shop === undefined && !error && <p role="status">{t('جارٍ الاتصال…')}</p>}
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
