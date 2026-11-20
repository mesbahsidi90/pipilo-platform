import React, { useEffect, useState } from 'react';
import { ChevronLeft, MessageCircle } from 'lucide-react';
import { cloud, db, sandbox } from './store';
import { t, locale } from './i18n.js';
import { subStates } from './adminData';
import { supportWhatsApp } from './contactDetails';
import { PlanCards } from './PlanCards';
import { professionalPlanId } from './planConfig';
import { myPlanRequest, requestPlanUpgrade } from './planRequest';
import ReferralCard from './ReferralCard';
import { ProQuote } from './ProQuote';

export default function MerchantSubscription({ shopId, shopError, branchCount }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!cloud || !shopId) return;
    let active = true;
    async function load() {
      try {
        const { data, error } = await db
          .from('subscriptions')
          .select('status,period_end,plan_id,plans(name)')
          .eq('shop_id', shopId)
          .maybeSingle();
        if (error) throw error;
        if (active) setResult({ shopId, data });
      } catch {
        if (active) setResult({ shopId, error: true });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [shopId]);

  if (cloud && (shopError || (result?.shopId === shopId && result?.error))) {
    return (
      <p role="alert" className="error">
        {t('تعذر تحميل الاشتراك.')}
      </p>
    );
  }
  if (cloud && (!result || result.shopId !== shopId))
    return <p role="status">{t('جارٍ الاتصال…')}</p>;

  const subscription = result?.data;
  const plan = subscription?.plans;
  const expiry = subscription?.period_end ? new Date(subscription.period_end) : null;
  const daysLeft = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000))
    : null;
  const trial = subscription?.status === 'trial';
  const state =
    daysLeft === 0
      ? t('منتهي')
      : subscription
        ? subStates[subscription.status]
        : t(cloud ? 'ما كاش اشتراك مربوط بهذا المحل.' : 'وضع تجريبي');
  const activeProfessional =
    subscription?.plan_id === professionalPlanId &&
    subscription.status === 'active' &&
    daysLeft !== 0;
  return (
    <div className="merchant-billing">
      <section className="panel billing-summary" aria-label={t('الباقة الحالية')}>
        <div>
          <span className="billing-badge">{state}</span>
          <h2>
            {trial && daysLeft > 0
              ? t('باقي {0} يوم', [daysLeft])
              : plan?.name || t('الباقة الحالية')}
          </h2>
          {trial && daysLeft > 0 && plan?.name && <p>{plan.name}</p>}
          {activeProfessional && !expiry && <p>{t('دفعة واحدة، بلا تجديد إجباري')}</p>}
          {expiry && (
            <p className="billing-expiry">
              {t('تاريخ نهاية الاشتراك')}{' '}
              <time dateTime={subscription.period_end}>{expiry.toLocaleDateString(locale)}</time>
            </p>
          )}
          {!cloud && (
            <p className="billing-expiry">{t('وضع تجريبي · البيانات في هذا المتصفح فقط')}</p>
          )}
        </div>
        {branchCount != null && (
          <dl className="billing-count">
            <dt>{t('الفروع')}</dt>
            <dd>{branchCount}</dd>
          </dl>
        )}
      </section>

      {!activeProfessional && !sandbox && <PlanRequest />}
      {!sandbox && <ReferralCard />}
      <a className="billing-help" href={supportWhatsApp} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={18} />
        <span>{t('تحتاج مساعدة؟ تواصل مع الدعم المباشر على واتساب')}</span>
        <ChevronLeft className="billing-chevron" size={16} />
      </a>

      <PlanCards merchant />
    </div>
  );
}

const requestErrors = {
  already_paid: 'الاحترافية مفعّلة عندك من قبل.',
  rate_limit: 'بعثت بزاف طلبات اليوم. عاود غدوة.',
  forbidden: 'غير صاحب المحل يقدر يطلب التفعيل.',
};

// Ask the platform to activate Pro; the request shows up in the admin.
function PlanRequest() {
  const [request, setRequest] = useState(undefined);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    myPlanRequest()
      .then((value) => alive && setRequest(value || null))
      .catch(() => alive && setRequest(null));
    return () => {
      alive = false;
    };
  }, []);
  if (request === undefined) return null;
  if (request)
    return (
      <section className="panel billing-request done" role="status">
        <h3>{t('طلبك وصلنا ✓')}</h3>
        <p>
          {t('بعثت طلب تفعيل الاحترافية نهار {0}. نتصلو بيك باش نكمّلو.', [
            new Date(request.created_at).toLocaleDateString(locale),
          ])}
        </p>
        <ProQuote />
      </section>
    );
  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await requestPlanUpgrade(note);
      if (result?.error) setError(t(requestErrors[result.error] || 'تعذر إرسال الطلب.'));
      else setRequest(result);
    } catch {
      setError(t('تعذر إرسال الطلب.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel billing-request" onSubmit={send}>
      <h3>{t('تحب الاحترافية؟')}</h3>
      <p>{t('ابعث طلب وفريق Bipilo يتصل بيك باش يفعّلها لمحلك.')}</p>
      <ProQuote />
      <label>
        {t('ملاحظة — اختياري')}
        <textarea
          rows={2}
          maxLength={300}
          placeholder={t('مثلًا: أحسن وقت نتصلو بيك')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? t('نبعثو…') : t('اطلب تفعيل الاحترافية')}
      </button>
    </form>
  );
}
