import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { contactLink } from './contactDetails';
import { language, locale } from './i18n';
import { cloud, db } from './store';
import { defaultPlanCatalog, demoAdminKey, professionalPlanId } from './planConfig';
import { FEATURE_KEYS, planLines } from './planRules';
import './merchant-subscription.css';

const french = language === 'fr';
const copy = (ar, fr) => (french ? fr : ar);
const price = (value, currency = 'DZD') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const DETAIL = {
  free: ['لفرع واحد', 'Pour une succursale'],
  once: ['دفعة واحدة لكل فرع', 'Paiement unique par succursale'],
  monthly: ['في الشهر لكل فرع', 'Par mois et par succursale'],
  yearly: ['في العام لكل فرع', 'Par an et par succursale'],
};

// Demo (no server): the plans saved in this browser's admin, or the defaults.
function demoPlans() {
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem(demoAdminKey))?.plans || [];
  } catch {
    stored = [];
  }
  const ready = stored.filter((plan) => plan.billing && plan.is_public && plan.active);
  if (ready.length) return ready.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return [
    {
      id: 'free',
      name: 'المجانية',
      name_fr: 'Gratuite',
      price: 0,
      billing: 'free',
      ticket_limit: defaultPlanCatalog.free_ticket_limit,
      features: [],
      is_default: true,
      notes_ar:
        'QR ومتابعة بلا حساب مع تنبيه\nرابط تقييم قوقل بعد الاستلام\nلوحة الطلبات أو الطابور',
      notes_fr:
        'QR, suivi sans compte et notification\nLien d’avis Google après le retrait\nGestion des commandes ou de la file',
    },
    {
      id: professionalPlanId,
      name: 'الاحترافية',
      name_fr: 'Pro',
      price: defaultPlanCatalog.purchase_price,
      billing: 'once',
      ticket_limit: null,
      features: FEATURE_KEYS,
      notes_ar: 'شعارك، ألوانك، قوالب وبانرات\nشاشة انتظار وصلاحيات الفريق\nدعم مباشر على واتساب',
      notes_fr:
        'Logo, couleurs, thèmes et bannières\nÉcran d’attente et droits d’équipe\nAssistance directe sur WhatsApp',
    },
  ];
}

// «باقات Bipilo»: the plans the admin marked «تبان في صفحة الأسعار».
export function PlanCards({ merchant = false }) {
  const [plans, setPlans] = useState(() => (cloud ? null : demoPlans()));
  const [catalog, setCatalog] = useState(() => (cloud ? null : defaultPlanCatalog));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!cloud) return;
    let live = true;
    Promise.all([db.rpc('bipilo_plans'), db.rpc('bipilo_plan_catalog')])
      .then(([list, pro]) => {
        if (!live) return;
        if (list.error || !Array.isArray(list.data)) return setFailed(true);
        setPlans(list.data);
        if (!pro.error) setCatalog(pro.data);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);
  if (!plans)
    return (
      <section id="plans" className="wrap access-section">
        <h2>{copy('باقات Bipilo', 'Offres Bipilo')}</h2>
        <p role="status">
          {failed
            ? copy(
                'تعذّر تحميل الباقات. تواصل مع الدعم للاستفسار.',
                'Les offres sont indisponibles. Contactez l’assistance.',
              )
            : copy('نحمّل الباقات…', 'Chargement des offres…')}
        </p>
        {failed && (
          <a className="button outline" href="#contact">
            {copy('تواصل معنا', 'Nous contacter')}
          </a>
        )}
      </section>
    );
  // The highlighted card: the Pro plan, otherwise the first paid one.
  const featured =
    plans.find((plan) => plan.id === professionalPlanId) ||
    plans.find((plan) => Number(plan.price) > 0);
  const request = (plan) =>
    contactLink({
      topic: copy('تفعيل باقة Bipilo', 'Activation d’une offre Bipilo'),
      message: copy(
        `حاب نفعّل باقة «${plan.name}» لفرعي. واش هي خطوات الدفع؟`,
        `Je souhaite activer l’offre « ${plan.name_fr || plan.name} » pour ma succursale. Comment régler ?`,
      ),
    });
  const launch = catalog?.launch_branches > 0 ? catalog : null;
  return (
    <section id="plans" className={merchant ? 'panel billing-plans' : 'wrap access-section'}>
      <header className="section-heading">
        <h2>{copy('باقات Bipilo', 'Offres Bipilo')}</h2>
        <p>
          {copy(
            'ابدا مجانًا، وبدّل الباقة كي تحتاج ميزات أكثر.',
            'Commencez gratuitement et changez d’offre quand vous avez besoin de plus.',
          )}
        </p>
      </header>
      <div className="access-cards">
        {plans.map((plan) => {
          const free = plan.billing === 'free' || !Number(plan.price);
          const detail = DETAIL[plan.billing] || DETAIL.once;
          return (
            <article key={plan.id} className={`access-card${plan === featured ? ' featured' : ''}`}>
              <h3>{french ? plan.name_fr || plan.name : plan.name}</h3>
              <div className="access-price">{price(free ? 0 : plan.price, plan.currency)}</div>
              <p>{copy(...detail)}</p>
              {plan.id === professionalPlanId && launch && (
                <p>
                  {copy(
                    `سعر إطلاق لأول ${launch.launch_branches} فرعًا. السعر المرجعي بعدها ${price(launch.standard_price)}.`,
                    `Tarif de lancement pour les ${launch.launch_branches} premières succursales, puis tarif indicatif de ${price(launch.standard_price)}.`,
                  )}
                </p>
              )}
              <ul>
                {planLines(plan, french).map((line) => (
                  <li key={line}>
                    <Check aria-hidden="true" /> {line}
                  </li>
                ))}
              </ul>
              {!free ? (
                <a
                  className="button full"
                  href={request(plan)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {copy('اطلب التفعيل عبر واتساب', 'Demander l’activation sur WhatsApp')}
                </a>
              ) : (
                !merchant && (
                  <a className="button outline full" href="/signup">
                    {copy('إنشاء حساب مجاني', 'Créer un compte gratuit')}
                  </a>
                )
              )}
            </article>
          );
        })}
      </div>
      <p className="billing-note">
        {copy(
          'الدفعة تشمل الميزات المذكورة وتصليحاتها وتحسيناتها. الإضافات الجديدة اختيارية، ورسائل واتساب للزبائن تكون برصيد منفصل عند توفرها.',
          'Le paiement couvre les fonctionnalités indiquées, leurs correctifs et leurs améliorations. Les nouveautés sont facultatives et les messages WhatsApp aux clients auront un crédit séparé lorsqu’ils seront disponibles.',
        )}
      </p>
    </section>
  );
}
