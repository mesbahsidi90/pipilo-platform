import React from 'react';
import {
  ArrowLeft,
  Car,
  Coffee,
  Scissors,
  Shirt,
  Stethoscope,
  UtensilsCrossed,
} from 'lucide-react';
import { t } from './i18n.js';
import Brand from './Brand';
import { shopActivity, shopTypes } from './shopActivities';
import { sampleOrders, sampleShops } from './sandboxRules';
import './try-shop.css';

const choices = [
  ['cafe', Coffee],
  ['restaurant', UtensilsCrossed],
  ['clinic', Stethoscope],
  ['laundry', Shirt],
  ['car_wash', Car],
  ['tailor', Scissors],
];

// Local keys of the browser-only workspace (see store, shopSettings, menu…).
const sampleKeys = [
  'nawba-demo-v1',
  'bippo-shop-settings',
  'bipilo-demo-menu',
  'bipilo-demo-loyalty',
  'bipilo-demo-pos-keys',
  'bippo-guest-signals',
];

function start(kind) {
  const activity = shopActivity(kind);
  try {
    for (const key of sampleKeys) localStorage.removeItem(key);
    localStorage.setItem(
      'bippo-shop-settings',
      JSON.stringify({
        name: t(sampleShops[kind].name),
        city: t('الجزائر العاصمة'),
        kind,
        tracking_mode: activity.trackingMode,
        waiting_mode: activity.clinic || activity.foodService ? 'onsite' : 'return',
      }),
    );
    localStorage.setItem('nawba-demo-v1', JSON.stringify(sampleOrders(kind)));
  } catch {
    // Private windows without storage still open the dashboard with defaults.
  }
  location.assign('/dashboard');
}

// /jarreb: pick an activity, then open the real dashboard on sample data.
export default function TryShop() {
  return (
    <main className="try-shop">
      <div className="try-shop-brand">
        <Brand />
      </div>
      <h1>{t('جرّب لوحة التحكم بلا تسجيل')}</h1>
      <p>
        {t(
          'اختار نشاطك ونحلّولك محل تجريبي فيه زبائن يستنّاو وتقارير أسبوع. نادي، جهّز، وشوف واش يشوف الزبون.',
        )}
      </p>
      <div className="try-shop-grid">
        {choices.map(([kind, Icon]) => (
          <button key={kind} type="button" onClick={() => start(kind)}>
            <Icon size={26} />
            <b>{shopTypes[kind]}</b>
            <small>{t(sampleShops[kind].name)}</small>
          </button>
        ))}
      </div>
      <p className="try-shop-note">
        {t(
          'التجربة تبقى في هذا المتصفح برك، وما تتبعث لحتى واحد. كي تحب، سجّل محلك الحقيقي مجانًا.',
        )}
      </p>
      <a className="try-shop-signup" href="/signup">
        {t('سجّل محلك مجانًا')}
        <ArrowLeft size={16} />
      </a>
    </main>
  );
}

// Thin bar on top of every page while the trial runs.
export function SandboxBar() {
  return (
    <div className="sandbox-bar" role="note">
      <span>{t('تجربة بأمثلة · البيانات في هذا المتصفح برك')}</span>
      <a href="/jarreb">{t('بدّل النشاط')}</a>
      <a href="/login">{t('اخرج من التجربة')}</a>
      <a className="sandbox-bar-cta" href="/signup">
        {t('سجّل محلك مجانًا')}
      </a>
    </div>
  );
}
