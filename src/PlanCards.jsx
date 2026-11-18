import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { contactLink } from './contactDetails';
import { language, locale } from './i18n';
import { cloud, db } from './store';
import { defaultPlanCatalog, demoAdminKey, professionalPlanId } from './planConfig';
import './merchant-subscription.css';

const french = language === 'fr';
const copy = (ar, fr) => (french ? fr : ar);
const price = (value) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 0,
  }).format(value);

export function PlanCards({ merchant = false }) {
  const [catalog, setCatalog] = useState(() => {
    if (cloud) return null;
    try {
      return (
        JSON.parse(localStorage.getItem(demoAdminKey))?.plans.find(
          (plan) => plan.id === professionalPlanId,
        ) || defaultPlanCatalog
      );
    } catch {
      return defaultPlanCatalog;
    }
  });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!cloud) return;
    let live = true;
    db.rpc('bipilo_plan_catalog')
      .then(({ data, error }) => {
        if (!live) return;
        if (error || !data) setFailed(true);
        else setCatalog(data);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);
  if (!catalog)
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
  const {
    free_ticket_limit: freeTicketLimit,
    launch_branches: launchBranches,
    standard_price: standardPrice,
  } = catalog;
  const upgrade = contactLink({
    topic: copy('تفعيل باقة Bipilo الاحترافية', 'Activation de Bipilo Pro'),
    message: copy(
      'حاب نفعّل الاحترافية لفرعي. واش هي خطوات الدفع؟',
      'Je souhaite activer l’offre Pro pour ma succursale. Comment régler ?',
    ),
  });
  const plans = [
    {
      title: copy('المجانية', 'Gratuite'),
      amount: 0,
      detail: copy('لفرع واحد', 'Pour une succursale'),
      features: [
        copy(`${freeTicketLimit} تيكي في الشهر`, `${freeTicketLimit} tickets par mois`),
        copy('QR ومتابعة بلا حساب مع تنبيه', 'QR, suivi sans compte et notification'),
        copy('رابط تقييم قوقل بعد الاستلام', 'Lien d’avis Google après le retrait'),
        copy('لوحة الطلبات أو الطابور', 'Gestion des commandes ou de la file'),
        copy('سجل آخر 7 أيام ضمن الباقة', 'Historique des 7 derniers jours inclus'),
      ],
    },
    {
      title: copy('الاحترافية', 'Pro'),
      amount: launchBranches > 0 ? catalog.purchase_price : standardPrice,
      detail: copy('دفعة واحدة لكل فرع', 'Paiement unique par succursale'),
      features: [
        copy(
          'تيكيات بلا سقف شهري للاستعمال العادي',
          'Tickets sans plafond mensuel en usage normal',
        ),
        copy('شعارك، ألوانك، قوالب وبانرات', 'Logo, couleurs, thèmes et bannières'),
        copy('شاشة انتظار وصلاحيات الفريق', 'Écran d’attente et droits d’équipe'),
        copy('تحليلات وتصدير CSV', 'Analyses et export CSV'),
        copy('ملاحظات الزبائن الخاصة بعد الاستلام', 'Commentaires privés après le retrait'),
        copy('دعم مباشر على واتساب', 'Assistance directe sur WhatsApp'),
      ],
    },
  ];
  return (
    <section id="plans" className={merchant ? 'panel billing-plans' : 'wrap access-section'}>
      <header className="section-heading">
        <h2>{copy('باقات Bipilo', 'Offres Bipilo')}</h2>
        <p>
          {copy(
            'ابدا مجانًا، وفعّل الاحترافية بدفعة واحدة كي تحتاجها.',
            'Commencez gratuitement et activez Pro en un seul paiement quand vous en avez besoin.',
          )}
        </p>
      </header>
      <div className="access-cards">
        {plans
          .slice(0, catalog.active ? 2 : 1)
          .map(({ title, amount, detail, features }, index) => (
            <article key={title} className={`access-card${index ? ' featured' : ''}`}>
              <h3>{title}</h3>
              <div className="access-price">{price(amount)}</div>
              <p>{detail}</p>
              {index === 1 && launchBranches > 0 && (
                <p>
                  {copy(
                    `سعر إطلاق لأول ${launchBranches} فرعًا. السعر المرجعي بعدها ${price(standardPrice)}.`,
                    `Tarif de lancement pour les ${launchBranches} premières succursales, puis tarif indicatif de ${price(standardPrice)}.`,
                  )}
                </p>
              )}
              <ul>
                {features.map((feature) => (
                  <li key={feature}>
                    <Check aria-hidden="true" /> {feature}
                  </li>
                ))}
              </ul>
              {index === 1 ? (
                <a className="button full" href={upgrade} target="_blank" rel="noopener noreferrer">
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
          ))}
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
