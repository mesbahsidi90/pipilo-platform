import React, { useEffect, useState } from 'react';
import { Download, Lightbulb, Search } from 'lucide-react';
import { loadShopInsights, shopTypes } from './adminData';
import { insightHints, insightTotals, share, toCsv } from './adminDomain';
import { locale, t } from './i18n.js';
import './admin-insights.css';

const PERIODS = [7, 30, 90];

const HINTS = {
  no_orders: 'ما دار حتى طلب في هاد المدة.',
  stopped: 'ما دار حتى طلب هاد الأسبوع: كلّمو.',
  few_follow: 'قليل اللي يتابعو من التليفون: شوف وين راه الكود ولا كيفاش يعطيوه.',
  few_alerts: 'يحلّو الصفحة بصح ما يفعّلوش التنبيه: لازم نسهّلو زر التنبيه.',
  weak_delivery: 'بزاف إشعارات ما وصلوش: تليفونات مقفولة ولا iPhone بلا الشاشة الرئيسية.',
  many_cancelled: 'بزاف طلبات ملغاة.',
  no_ratings: 'حتى زبون ما قيّم: فعّل التقييم ولا ذكّر الزبائن.',
  slow: 'التحضير طويل (أكثر من 25 دقيقة).',
};

const number = (value) => new Intl.NumberFormat(locale).format(Number(value) || 0);
const minutes = (value) =>
  value === null || value === undefined ? '—' : t('{0} د', [number(value)]);
const percent = (part, whole) => {
  const value = share(Number(part) || 0, Number(whole) || 0);
  return value === null ? '' : value + '%';
};
const when = (value) =>
  value
    ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    : t('أبدًا');

// One step of the guest funnel: count, share of orders, and a bar.
function Step({ label, value, orders }) {
  const width = share(Number(value) || 0, Number(orders) || 0) ?? 0;
  return (
    <div className="insight-step">
      <div>
        <span>{t(label)}</span>
        <b>
          {number(value)}
          {orders > 0 && <small>{percent(value, orders)}</small>}
        </b>
      </div>
      <i style={{ '--w': Math.min(width, 100) + '%' }} />
    </div>
  );
}

const FUNNEL = [
  ['followed', 'تابعو من التليفون'],
  ['alerts_on', 'فعّلو التنبيه'],
  ['rang', 'رنّ تليفونهم'],
  ['delivered', 'وصلهم الإشعار'],
  ['saw_ready', 'شافو «جاهز»'],
  ['coming', 'ضغطو «راني جاي»'],
  ['played', 'لعبو لعبة'],
  ['ratings', 'قيّمو'],
];

function exportCsv(shops, days) {
  const keys = [
    'name',
    'kind',
    'city',
    'plan_name',
    'tracking_mode',
    'orders',
    'today',
    'active_days',
    'prep_avg',
    'prep_median',
    'pickup_avg',
    'peak_hour',
    'followed',
    'alerts_on',
    'rang',
    'delivered',
    'saw_ready',
    'coming',
    'played',
    'ratings',
    'rating_avg',
    'comments',
    'loyalty_stamps',
    'recalled',
    'cancelled',
    'from_invoice',
    'from_counter',
    'from_clinic',
    'from_online',
    'from_pos',
    'last_order_at',
  ];
  const file = new Blob([toCsv([keys, ...shops.map((s) => keys.map((k) => s[k]))])], {
    type: 'text/csv;charset=utf-8',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = `bipilo-shops-${days}d.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function ShopCard({ shop }) {
  const orders = Number(shop.orders) || 0;
  const perDay = shop.active_days ? Math.round((orders / shop.active_days) * 10) / 10 : 0;
  const sources = [
    ['from_invoice', 'كود الفاتورة'],
    ['from_counter', 'كود الكونتوار'],
    ['from_clinic', 'كود العيادة'],
    ['from_online', 'طلب أونلاين'],
    ['from_pos', 'الكاشير (POS)'],
  ].filter(([key]) => Number(shop[key]) > 0);
  const byStaff = orders - sources.reduce((sum, [key]) => sum + (Number(shop[key]) || 0), 0);
  const hints = insightHints(shop);
  return (
    <article className="insight-shop">
      <header>
        <div>
          <h3 dir="auto">{shop.name}</h3>
          <small>
            {[
              shopTypes[shop.kind] || shop.kind,
              shop.city,
              shop.branches ? t('{0} فروع', [shop.branches]) : null,
              shop.plan_name,
            ]
              .filter(Boolean)
              .join(' · ')}
          </small>
        </div>
        <small>{t('آخر طلب: {0}', [when(shop.last_order_at)])}</small>
      </header>

      <div className="insight-figures">
        <div>
          <small>{t('الطلبات')}</small>
          <b>{number(orders)}</b>
          <span>{t('اليوم: {0}', [number(shop.today)])}</span>
        </div>
        <div>
          <small>{t('في اليوم (أيام الخدمة)')}</small>
          <b>{number(perDay)}</b>
          <span>{t('{0} يوم خدمة', [number(shop.active_days)])}</span>
        </div>
        <div>
          <small>{t('وقت التحضير')}</small>
          <b>{minutes(shop.prep_median)}</b>
          <span>{t('المتوسط: {0}', [minutes(shop.prep_avg)])}</span>
        </div>
        <div>
          <small>{t('من «جاهز» حتى الاستلام')}</small>
          <b>{minutes(shop.pickup_avg)}</b>
          <span>
            {shop.peak_hour === null || shop.peak_hour === undefined
              ? ''
              : t('الذروة: {0}:00', [shop.peak_hour])}
          </span>
        </div>
        <div>
          <small>{t('التقييم')}</small>
          <b>{shop.rating_avg ? '★ ' + shop.rating_avg : '—'}</b>
          <span>{t('{0} تقييم · {1} تعليق', [number(shop.ratings), number(shop.comments)])}</span>
        </div>
      </div>

      <div className="insight-funnel">
        {FUNNEL.map(([key, label]) => (
          <Step key={key} label={label} value={shop[key]} orders={orders} />
        ))}
      </div>

      <footer>
        <div className="insight-chips">
          {sources.map(([key, label]) => (
            <span key={key}>
              {t(label)} <b>{number(shop[key])}</b>
            </span>
          ))}
          {orders > 0 && byStaff > 0 && (
            <span>
              {t('سجّلهم العامل')} <b>{number(byStaff)}</b>
            </span>
          )}
          {Number(shop.recalled) > 0 && (
            <span>
              {t('إعادة نداء')} <b>{number(shop.recalled)}</b>
            </span>
          )}
          {Number(shop.cancelled) > 0 && (
            <span>
              {t('ملغاة')} <b>{number(shop.cancelled)}</b>
            </span>
          )}
          {Number(shop.loyalty_stamps) > 0 && (
            <span>
              {t('طوابع الوفاء')} <b>{number(shop.loyalty_stamps)}</b>
            </span>
          )}
        </div>
        {hints.length > 0 && (
          <ul className="insight-hints">
            {hints.map((key) => (
              <li key={key}>
                <Lightbulb size={14} />
                {t(HINTS[key])}
              </li>
            ))}
          </ul>
        )}
      </footer>
    </article>
  );
}

// «أداء الأنشطة»: how each shop uses Bipilo, to follow them up and improve the product.
export default function AdminShopInsights({ refreshKey }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let live = true;
    setError(false);
    setData(null);
    loadShopInsights(days)
      .then((result) => live && setData(result))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [days, refreshKey]);

  const shops = data?.shops || [];
  const totals = insightTotals(shops);
  const visible = shops.filter((shop) =>
    [shop.name, shop.city].join(' ').toLowerCase().includes(query.trim().toLowerCase()),
  );
  const trial = data?.trial;

  return (
    <div className="admin-insights">
      <div className="insight-tools">
        <div className="insight-periods" role="group" aria-label={t('المدة')}>
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              className={days === value ? 'active' : ''}
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              {t('{0} يوم', [value])}
            </button>
          ))}
        </div>
        <label className="admin-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('ابحث على محل…')}
          />
        </label>
        <button
          type="button"
          className="button outline small"
          disabled={!shops.length}
          onClick={() => exportCsv(shops, days)}
        >
          <Download size={15} />
          CSV
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {t('تعذر تحميل أداء الأنشطة. عاود جرّب التحديث.')}
        </p>
      )}
      {!data && !error && <p role="status">{t('نحمّلو بيانات المنصة…')}</p>}

      {data && (
        <>
          <section className="panel admin-section insight-platform">
            <div className="admin-section-title">
              <div>
                <h2>{t('المنصة كاملة')}</h2>
                <p>{t('آخر {0} يوم · {1} محل خدم من {2}', [days, totals.active, shops.length])}</p>
              </div>
            </div>
            <div className="insight-figures">
              <div>
                <small>{t('الطلبات')}</small>
                <b>{number(totals.orders)}</b>
                <span>{t('اليوم: {0}', [number(totals.today)])}</span>
              </div>
              <div>
                <small>{t('تابعو من التليفون')}</small>
                <b>{percent(totals.followed, totals.orders) || '—'}</b>
                <span>{number(totals.followed)}</span>
              </div>
              <div>
                <small>{t('رنّ تليفونهم')}</small>
                <b>{number(totals.rang)}</b>
                <span>{t('وصل: {0}', [number(totals.delivered)])}</span>
              </div>
              <div>
                <small>{t('التقييم')}</small>
                <b>{totals.rating_avg ? '★ ' + totals.rating_avg : '—'}</b>
                <span>{t('{0} تقييم', [number(totals.ratings)])}</span>
              </div>
              <div>
                <small>{t('لعبو لعبة')}</small>
                <b>{number(totals.played)}</b>
                <span>{t('نحسبو من اليوم')}</span>
              </div>
            </div>
            <div className="insight-funnel">
              {FUNNEL.map(([key, label]) => (
                <Step key={key} label={label} value={totals[key]} orders={totals.orders} />
              ))}
            </div>
            {trial && (
              <p className="insight-trial">
                {t(
                  'التجربة من صفحة الهبوط: {0} تجربة محل · {1} تيكي · {2} حلّو الصفحة · {3} فعّلو التنبيه · {4} رنّ · {5} «راني جاي»',
                  [
                    number(trial.places),
                    number(trial.tickets),
                    number(trial.opened),
                    number(trial.alerts_on),
                    number(trial.rang),
                    number(trial.coming),
                  ],
                )}
              </p>
            )}
          </section>

          <div className="insight-shops">
            {visible.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
            {!visible.length && <p className="admin-empty">{t('ما كاين حتى محل.')}</p>}
          </div>
        </>
      )}
    </div>
  );
}
