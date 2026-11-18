import React, { useEffect, useRef, useState } from 'react';
import { Mail, MessageCircle, Search } from 'lucide-react';
import { loadOrderActivity, loadDailyOrders } from './adminData';
import { activityDays, needsOrderFollowup } from './adminDomain';
import { locale, t } from './i18n';

const dateOptions = { timeZone: 'Africa/Algiers' };
const dayLabel = (day) => new Date(day + 'T12:00:00Z').toLocaleDateString(locale, dateOptions);
const orderStatuses = {
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  collected: 'تم الاستلام',
  cancelled: 'ملغى',
};

function ContactLinks({ shop }) {
  const phone = /^\+?[1-9]\d{7,14}$/.test(shop.phone || '') ? shop.phone.replace(/^\+/, '') : '';
  return (
    <div className="admin-order-contact">
      {phone && (
        <a
          className="button outline small"
          href={`https://wa.me/${phone}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={15} />
          WhatsApp
        </a>
      )}
      {shop.email && (
        <a
          className="button outline small"
          href={'mailto:' + encodeURIComponent(shop.email).replace('%40', '@')}
        >
          <Mail size={15} />
          {t('البريد الإلكتروني')}
        </a>
      )}
      {!phone && !shop.email && <small>{t('بيانات التواصل غير متوفرة')}</small>}
    </div>
  );
}

export default function AdminOrderActivity({ refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyFollowup, setOnlyFollowup] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    let active = true;
    setError(false);
    loadOrderActivity()
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) {
          setData(null);
          setError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (error)
    return (
      <p className="error" role="alert">
        {t('تعذر تحميل نشاط الطلبات. عاود جرّب التحديث.')}
      </p>
    );
  if (!data) return <p role="status">{t('نحمّلو بيانات المنصة…')}</p>;
  const { shops, today } = data;
  const yesterday = activityDays(today, 2)[1];
  const followupCount = shops.filter((shop) => needsOrderFollowup(shop, today)).length;
  const visible = shops.filter(
    (shop) =>
      (!onlyFollowup || needsOrderFollowup(shop, today)) &&
      (shop.name + ' ' + (shop.city || '')).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const shop = shops.find((item) => item.id === selected);

  return (
    <>
      <section className="panel admin-section">
        <div className="admin-section-title">
          <div>
            <h2>{t('متابعة نشاط المحلات')}</h2>
            <p>
              {t(
                'المتابعة تشمل المحلات النشطة اللي سبق لها سجلت طلبات ومرّت عليها 3 أيام كاملة بلا طلب جديد.',
              )}
            </p>
          </div>
          <strong>{t('{0} محل للمتابعة', [followupCount])}</strong>
        </div>
        <div className="admin-table-tools">
          <label className="admin-search">
            <Search size={17} />
            <input
              aria-label={t('البحث عن محل')}
              placeholder={t('قلّب باسم المحل ولا المدينة…')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={onlyFollowup}
              onChange={(e) => setOnlyFollowup(e.target.checked)}
            />
            {t('المحلات اللي تحتاج متابعة فقط')}
          </label>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                {['المحل', 'طلبات اليوم', 'طلبات أمس', 'آخر طلب', 'متابعة المحل'].map((label) => (
                  <th key={label}>{t(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="admin-text-link"
                      aria-pressed={selected === item.id}
                      onClick={() => setSelected(selected === item.id ? null : item.id)}
                    >
                      {item.name}
                    </button>
                    <small>{item.city}</small>
                  </td>
                  <td>{item.daily[today] || 0}</td>
                  <td>{item.daily[yesterday] || 0}</td>
                  <td>
                    {item.last_order_at
                      ? new Date(item.last_order_at).toLocaleString(locale, dateOptions)
                      : t('ما سجّل حتى طلب')}
                  </td>
                  <td>
                    {needsOrderFollowup(item, today) && <strong>{t('يحتاج متابعة')}</strong>}
                    <ContactLinks shop={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <p>{t('ما لقيناش نتائج بهاذ البحث.')}</p>}
      </section>
      {shop && (
        <ShopDailyOrders key={shop.id + today} shop={shop} today={today} refreshKey={refreshKey} />
      )}
    </>
  );
}

function ShopDailyOrders({ shop, today, refreshKey }) {
  const section = useRef(null);
  const [day, setDay] = useState(today);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    section.current?.focus();
  }, []);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError(false);
    loadDailyOrders(shop.branch_ids, day, page)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [shop.branch_ids, day, page, refreshKey]);

  return (
    <section
      ref={section}
      tabIndex={-1}
      className="panel admin-section"
      aria-label={t('طلبات المحل اليومية')}
    >
      <div className="admin-section-title">
        <div>
          <h2>{shop.name}</h2>
          <p>{t('طلبات آخر 14 يومًا · توقيت الجزائر')}</p>
        </div>
        <label>
          {t('اختر اليوم')}
          <select
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setPage(0);
            }}
          >
            {activityDays(today).map((date) => (
              <option key={date} value={date}>
                {dayLabel(date)} · {shop.daily[date] || 0}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p className="error" role="alert">
          {t('تعذر تحميل طلبات هذا اليوم.')}
        </p>
      ) : !result ? (
        <p role="status">{t('نحمّلو بيانات المنصة…')}</p>
      ) : result.orders.length ? (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                {['رقم الطلب', 'الفرع', 'الحالة', 'وقت التسجيل'].map((label) => (
                  <th key={label}>{t(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <bdi>{order.number}</bdi>
                  </td>
                  <td>{order.shops?.name || '—'}</td>
                  <td>{t(orderStatuses[order.status] || order.status)}</td>
                  <td>{new Date(order.created_at).toLocaleTimeString(locale, dateOptions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{t('ما كاين حتى طلب في هذا اليوم.')}</p>
      )}
      <div className="admin-order-contact">
        {page > 0 && (
          <button className="button outline small" onClick={() => setPage(page - 1)}>
            {t('الصفحة السابقة')}
          </button>
        )}
        {result?.more && (
          <button className="button outline small" onClick={() => setPage(page + 1)}>
            {t('الصفحة التالية')}
          </button>
        )}
      </div>
    </section>
  );
}
