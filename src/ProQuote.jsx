import React, { useEffect, useState } from 'react';
import { t, locale } from './i18n.js';
import { adminProQuote, dzd, myProQuote } from './referral';
import './merchant-subscription.css';

// The Pro price for this branch, with the invite discount and referral credit.
function Breakdown({ quote }) {
  if (!quote) return null;
  const discounts = Number(quote.invite_discount) > 0 || Number(quote.credit_used) > 0;
  return (
    <dl className="pro-quote">
      {discounts && (
        <>
          <dt>{t('سعر الاحترافية')}</dt>
          <dd>{dzd(quote.price)}</dd>
        </>
      )}
      {Number(quote.invite_discount) > 0 && (
        <>
          <dt>{t('خصم الدعوة')}</dt>
          <dd>− {dzd(quote.invite_discount)}</dd>
        </>
      )}
      {Number(quote.credit_used) > 0 && (
        <>
          <dt>{t('رصيد الإحالة')}</dt>
          <dd>− {dzd(quote.credit_used)}</dd>
        </>
      )}
      <dt className="pro-quote-total">{discounts ? t('تخلّص') : t('سعر الاحترافية')}</dt>
      <dd className="pro-quote-total">{dzd(quote.total)}</dd>
    </dl>
  );
}

export function ProQuote() {
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    let alive = true;
    myProQuote()
      .then((value) => alive && setQuote(value))
      .catch(() => {
        // The request still works without the price.
      });
    return () => {
      alive = false;
    };
  }, []);
  if (!quote || quote.purchased) return null;
  return <Breakdown quote={quote} />;
}

// Admin shop sheet: what to collect before activating Pro, or what was paid.
export function AdminProQuote({ shopId }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    adminProQuote(shopId)
      .then((value) => alive && setData(value))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [shopId]);
  if (failed) return <p className="admin-form-note">{t('تعذر حساب سعر الاحترافية.')}</p>;
  if (!data) return <p className="admin-form-note">{t('نحمّلو…')}</p>;
  const { purchase, quote, earned } = data;
  return (
    <div className="admin-pro-quote">
      {purchase ? (
        <p>
          {purchase.total == null
            ? t('الاحترافية مفعّلة قبل نظام الإحالة.')
            : t('خلّص {0} يوم {1}.', [
                dzd(purchase.total),
                new Date(purchase.created_at).toLocaleDateString(locale),
              ])}
        </p>
      ) : (
        <>
          <p>{t('قبل ما تفعّل الاحترافية، الفرع يخلّص:')}</p>
          <Breakdown quote={quote} />
        </>
      )}
      {Number(earned) > 0 && (
        <p className="admin-form-note">{t('ربح من الإحالة: {0} في المجموع.', [dzd(earned)])}</p>
      )}
    </div>
  );
}
