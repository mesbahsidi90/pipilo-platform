import React, { useEffect, useState } from 'react';
import { ChevronLeft, MessageCircle } from 'lucide-react';
import { cloud, db } from './store';
import { t, locale } from './i18n.js';
import { subStates } from './adminData';
import { supportWhatsApp } from './contactDetails';
import { PlanCards } from './PlanCards';
import { professionalPlanId } from './planConfig';

export default function MerchantSubscription({ shopId, shopError, branchCount }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!cloud || !shopId) return;
    let active = true;
    async function load() {
      try {
        const { data, error } = await db.from('subscriptions')
          .select('status,period_end,plan_id,plans(name)')
          .eq('shop_id', shopId).maybeSingle();
        if (error) throw error;
        if (active) setResult({ shopId, data });
      } catch {
        if (active) setResult({ shopId, error: true });
      }
    }
    load();
    return () => { active = false; };
  }, [shopId]);

  if (cloud && (shopError || (result?.shopId === shopId && result?.error))) {
    return <p role="alert" className="error">{t('تعذر تحميل الاشتراك.')}</p>;
  }
  if (cloud && (!result || result.shopId !== shopId)) return <p role="status">{t('جارٍ الاتصال…')}</p>;

  const subscription = result?.data;
  const plan = subscription?.plans;
  const expiry = subscription?.period_end ? new Date(subscription.period_end) : null;
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null;
  const trial = subscription?.status === 'trial';
  const state = daysLeft === 0 ? t('منتهي') : subscription
    ? subStates[subscription.status] : t(cloud ? 'ما كاش اشتراك مربوط بهذا المحل.' : 'وضع تجريبي');
  const activeProfessional = subscription?.plan_id === professionalPlanId && subscription.status === 'active' && daysLeft !== 0;
  return <div className="merchant-billing">
    <section className="panel billing-summary" aria-label={t('الباقة الحالية')}>
      <div>
        <span className="billing-badge">{state}</span>
        <h2>{trial && daysLeft > 0 ? t('باقي {0} يوم', [daysLeft]) : plan?.name || t('الباقة الحالية')}</h2>
        {trial && daysLeft > 0 && plan?.name && <p>{plan.name}</p>}
        {activeProfessional && !expiry && <p>{t('دفعة واحدة، بلا تجديد إجباري')}</p>}
        {expiry && <p className="billing-expiry">{t('تاريخ نهاية الاشتراك')} <time dateTime={subscription.period_end}>{expiry.toLocaleDateString(locale)}</time></p>}
        {!cloud && <p className="billing-expiry">{t('وضع تجريبي · البيانات في هذا المتصفح فقط')}</p>}
      </div>
      {branchCount != null && <dl className="billing-count"><dt>{t('الفروع')}</dt><dd>{branchCount}</dd></dl>}
    </section>

    <a className="billing-help" href={supportWhatsApp} target="_blank" rel="noopener noreferrer">
      <MessageCircle size={18} /><span>{t('تحتاج مساعدة؟ تواصل مع الدعم المباشر على واتساب')}</span><ChevronLeft className="billing-chevron" size={16} />
    </a>

    <PlanCards merchant />
  </div>;
}
