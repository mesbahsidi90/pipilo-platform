import { t as bippoT, locale } from './i18n.js';
import React, { useState } from 'react';
import { Bell, Copy, Mail, MessageCircle, Phone, Store } from 'lucide-react';
import { shopTypes, subStates } from './adminData';
import { toCsv } from './adminDomain';
import { SOURCE_ANSWERS, SOURCE_LABELS, trackingLink } from './signupSourceRules';

// «فيسبوك · ramadan-cafes» from a shop's signup source.
export function sourceText(source) {
  if (!source) return bippoT('غير معروف');
  const label = source.answer
    ? bippoT(SOURCE_LABELS[source.answer])
    : source.utm_source || source.ref || bippoT('غير معروف');
  return [label, source.utm_campaign].filter(Boolean).join(' · ');
}

const dateText = (value) =>
  value ? new Date(value).toLocaleDateString(locale) : bippoT('بدون تاريخ');
const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    : bippoT('أبدًا');

export function alertText(alert) {
  if (alert.kind === 'request') return bippoT('طلب تفعيل الاحترافية');
  if (alert.kind === 'expired') return bippoT('الاشتراك انتهى');
  if (alert.kind === 'trial_ending')
    return bippoT('التجربة تكمل بعد {0} يوم', [Math.max(alert.days, 0)]);
  return bippoT('استعمل {0} من {1} طلب هذا الشهر', [alert.used, alert.limit]);
}

// Contact links for a shop owner: call, WhatsApp, email.
export function ContactLinks({ owner }) {
  if (!owner?.email && !owner?.phone)
    return <small className="admin-muted">{bippoT('بيانات التواصل غير متوفرة')}</small>;
  const digits = (owner.phone || '').replace(/\D/g, '');
  return (
    <span className="admin-contact">
      {digits && (
        <>
          <a href={'tel:+' + digits} aria-label={bippoT('اتصل')}>
            <Phone size={14} />
            <span dir="ltr">+{digits}</span>
          </a>
          <a
            href={'https://wa.me/' + digits}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={bippoT('واتساب')}
          >
            <MessageCircle size={14} />
            {bippoT('واتساب')}
          </a>
        </>
      )}
      {owner.email && (
        <a href={'mailto:' + owner.email}>
          <Mail size={14} />
          <span dir="ltr">{owner.email}</span>
        </a>
      )}
    </span>
  );
}

// «يحتاجو اتصال»: requests and alerts, each with a way to act.
export function AlertList({ alerts, overview, onOpen, onResolve, busy, limit }) {
  const rows = limit ? alerts.slice(0, limit) : alerts;
  if (!rows.length) return <p className="admin-muted">{bippoT('حتى محل ما يحتاج اتصال درك.')}</p>;
  return (
    <ul className="admin-alerts">
      {rows.map((alert) => {
        const row = overview.find((x) => x.id === alert.shop.id);
        return (
          <li key={alert.shop.id + alert.kind} className={'admin-alert ' + alert.kind}>
            <Bell size={16} aria-hidden="true" />
            <div>
              <b>{alert.shop.name}</b>
              <span>{alertText(alert)}</span>
              {alert.kind === 'request' && row?.request?.note && (
                <q className="admin-note">{row.request.note}</q>
              )}
              <ContactLinks owner={row?.owner} />
            </div>
            <div className="admin-alert-actions">
              <button
                type="button"
                className="button outline small"
                onClick={() => onOpen(alert.shop)}
              >
                {bippoT('ملف المحل')}
              </button>
              {alert.kind === 'request' && onResolve && (
                <>
                  <button
                    type="button"
                    className="button small"
                    disabled={busy}
                    onClick={() => onResolve(row.request.id, 'done', alert.shop)}
                  >
                    {bippoT('فعّل الاحترافية')}
                  </button>
                  <button
                    type="button"
                    className="admin-danger-link"
                    disabled={busy}
                    onClick={() => onResolve(row.request.id, 'dismissed')}
                  >
                    {bippoT('تجاهل')}
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const featureNames = [
  ['menu', 'المنيو الإلكتروني'],
  ['ordering', 'الطلب من التليفون'],
  ['loyalty', 'بطاقة الولاء'],
  ['feedback', 'ملاحظات خاصة'],
  ['google_reviews', 'تقييمات Google'],
  ['pos_keys', 'الربط مع الكاشير'],
];

// Everything about one shop in one place.
export function ShopSheet({
  shop,
  sub,
  plan,
  row,
  freeLimit,
  notes,
  branches,
  invitedBy,
  invited = [],
  onEdit,
}) {
  const features = row?.features || {};
  const used = row?.orders_month || 0;
  const share =
    row?.paid || !freeLimit ? null : Math.min(100, Math.round((used / freeLimit) * 100));
  return (
    <div className="admin-sheet">
      <section>
        <h3>
          <Store size={16} /> {shopTypes[shop.kind]} · {shop.city || bippoT('المدينة غير محددة')}
        </h3>
        <dl>
          <dt>{bippoT('التسجيل')}</dt>
          <dd>{dateText(shop.created_at)}</dd>
          <dt>{bippoT('الخطة')}</dt>
          <dd>
            {plan?.name || bippoT('بدون خطة')} ·{' '}
            {sub ? subStates[sub.status] || sub.status : bippoT('بدون اشتراك')}
            {sub?.period_end && ' · ' + bippoT('حتى {0}', [dateText(sub.period_end)])}
          </dd>
          <dt>{bippoT('صاحب المحل')}</dt>
          <dd>
            <ContactLinks owner={row?.owner} />
          </dd>
          <dt>{bippoT('عرفنا من')}</dt>
          <dd>{sourceText(row?.source)}</dd>
          {invitedBy && (
            <>
              <dt>{bippoT('دعاه')}</dt>
              <dd>{invitedBy.name}</dd>
            </>
          )}
          {row?.referral_code && (
            <>
              <dt>{bippoT('كود الإحالة')}</dt>
              <dd>
                <code dir="ltr">{row.referral_code}</code>
                {' · '}
                {invited.length
                  ? bippoT('جاب {0}: {1}', [invited.length, invited.map((s) => s.name).join('، ')])
                  : bippoT('مازال ما جاب حتى محل')}
              </dd>
            </>
          )}
          <dt>{bippoT('آخر دخول')}</dt>
          <dd>{dateTime(row?.owner?.last_sign_in_at)}</dd>
          <dt>{bippoT('الحسابات')}</dt>
          <dd>{row?.members ?? '—'}</dd>
          {branches.length > 0 && (
            <>
              <dt>{bippoT('الفروع')}</dt>
              <dd>{branches.map((b) => b.name).join('، ')}</dd>
            </>
          )}
        </dl>
      </section>
      <section>
        <h3>{bippoT('الاستعمال')}</h3>
        <dl>
          <dt>{bippoT('طلبات هذا الشهر')}</dt>
          <dd>
            {used}
            {share !== null && ' / ' + freeLimit}
          </dd>
          <dt>{bippoT('كل الطلبات')}</dt>
          <dd>{row?.orders_total ?? '—'}</dd>
          <dt>{bippoT('آخر طلب')}</dt>
          <dd>{dateTime(row?.last_order_at)}</dd>
        </dl>
        {share !== null && (
          <div
            className={'plan-meter' + (share >= 80 ? ' warn' : '')}
            role="img"
            aria-label={bippoT('{0}% من حد الباقة المجانية', [share])}
          >
            <i style={{ width: share + '%' }} />
          </div>
        )}
      </section>
      <section>
        <h3>{bippoT('المزايا المفعّلة')}</h3>
        <ul className="admin-chips">
          {featureNames.map(([key, label]) => {
            const on = Boolean(features[key]);
            return (
              <li key={key} className={on ? 'on' : ''}>
                {bippoT(label)}
                {key === 'menu' && on && ' · ' + bippoT('{0} صنف', [features.menu_items || 0])}
                {key === 'pos_keys' && on && ' · ' + features.pos_keys}
              </li>
            );
          })}
        </ul>
      </section>
      {row?.request && (
        <section className="admin-sheet-request">
          <h3>{bippoT('طلب تفعيل الاحترافية')}</h3>
          <p>
            {dateTime(row.request.created_at)}
            {row.request.note && <q className="admin-note">{row.request.note}</q>}
          </p>
        </section>
      )}
      {notes && (
        <section>
          <h3>{bippoT('ملاحظات داخلية')}</h3>
          <p className="admin-sheet-notes">{notes}</p>
        </section>
      )}
      <button type="button" className="button full" onClick={onEdit}>
        {bippoT('تعديل المحل والاشتراك')}
      </button>
    </div>
  );
}

function Bars({ title, rows, label, valueKey = 'count' }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  const total = rows.reduce((sum, r) => sum + r[valueKey], 0);
  return (
    <section className="panel admin-section">
      <div className="admin-section-title">
        <div>
          <h2>{title}</h2>
          <p>{bippoT('المجموع: {0}', [total])}</p>
        </div>
      </div>
      <div className="admin-bars" role="list">
        {rows.map((r) => (
          <span
            key={label(r)}
            role="listitem"
            title={label(r) + ': ' + r[valueKey]}
            aria-label={label(r) + ': ' + r[valueKey]}
          >
            <i style={{ height: (r[valueKey] / max) * 100 + '%' }} />
          </span>
        ))}
      </div>
      <div className="admin-bars-axis">
        <small>{label(rows[0] || {})}</small>
        <small>{label(rows[rows.length - 1] || {})}</small>
      </div>
    </section>
  );
}

export function StatsTab({ stats, overview, shops }) {
  const short = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
  const active = shops.filter((s) => s.status === 'active');
  const rows = overview.filter((r) => active.some((s) => s.id === r.id));
  return (
    <>
      <div className="admin-overview-grid">
        <Bars
          title={bippoT('الطلبات في آخر 30 يوم')}
          rows={stats?.orders || []}
          label={(r) => short(r.day)}
        />
        <Bars
          title={bippoT('محلات جديدة في كل أسبوع')}
          rows={stats?.signups || []}
          label={(r) => short(r.week)}
        />
      </div>
      <SourcesTable overview={overview} shops={shops} />
      <LinkBuilder />
      <section className="panel admin-section">
        <div className="admin-section-title">
          <div>
            <h2>{bippoT('استعمال المزايا')}</h2>
            <p>{bippoT('من {0} محل نشط.', [rows.length])}</p>
          </div>
        </div>
        {featureNames.map(([key, label]) => {
          const count = rows.filter((r) => r.features?.[key]).length;
          return (
            <div className="plan-distribution" key={key}>
              <div>
                <b>{bippoT(label)}</b>
                <span>{count}</span>
              </div>
              <div className="plan-meter">
                <i style={{ width: (rows.length ? (count / rows.length) * 100 : 0) + '%' }} />
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

// Downloads the shops list with plan, usage and contact as a CSV file.
export function exportShops({ shops, subFor, planFor, overview }) {
  const rows = [
    [
      'id',
      'name',
      'kind',
      'city',
      'status',
      'created_at',
      'plan',
      'subscription',
      'period_end',
      'orders_month',
      'orders_total',
      'last_order_at',
      'owner_email',
      'owner_phone',
      'source',
      'ref',
      'utm_source',
      'utm_campaign',
      'referral_code',
      'invited_by',
    ],
  ];
  for (const s of shops) {
    const sub = subFor(s.id);
    const row = overview.find((r) => r.id === s.id) || {};
    rows.push([
      s.id,
      s.name,
      s.kind,
      s.city,
      s.status,
      s.created_at,
      planFor(sub?.plan_id)?.name,
      sub?.status,
      sub?.period_end,
      row.orders_month,
      row.orders_total,
      row.last_order_at,
      row.owner?.email,
      row.owner?.phone,
      row.source?.answer,
      row.source?.ref,
      row.source?.utm_source,
      row.source?.utm_campaign,
      row.referral_code,
      shops.find((x) => x.id === row.source?.referred_by)?.name,
    ]);
  }
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bipilo-shops-' + new Date().toISOString().slice(0, 10) + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Signups per source, and how many became active (orders) and paid.
function SourcesTable({ overview, shops }) {
  const roots = overview.filter((row) => !row.parent_id);
  const keys = [...SOURCE_ANSWERS, ''];
  const rows = keys
    .map((key) => {
      const shops = roots.filter((row) => (row.source?.answer || '') === key);
      return {
        key,
        label: key ? bippoT(SOURCE_LABELS[key]) : bippoT('غير معروف'),
        signups: shops.length,
        active: shops.filter((row) => row.orders_total > 0).length,
        paid: shops.filter((row) => row.paid).length,
      };
    })
    .filter((row) => row.signups > 0);
  const campaigns = new Map();
  for (const row of roots) {
    const name = row.source?.utm_campaign;
    if (!name) continue;
    const item = campaigns.get(name) || { signups: 0, paid: 0 };
    item.signups++;
    if (row.paid) item.paid++;
    campaigns.set(name, item);
  }
  const referrers = new Map();
  for (const row of roots) {
    const by = row.source?.referred_by;
    if (!by) continue;
    const item = referrers.get(by) || { signups: 0, paid: 0 };
    item.signups++;
    if (row.paid) item.paid++;
    referrers.set(by, item);
  }
  const topReferrers = [...referrers]
    .map(([id, item]) => ({ id, name: shops.find((s) => s.id === id)?.name || '—', ...item }))
    .sort((a, b) => b.signups - a.signups)
    .slice(0, 10);
  return (
    <section className="panel admin-section">
      <div className="admin-section-title">
        <div>
          <h2>{bippoT('مصادر التسجيل')}</h2>
          <p>{bippoT('منين جاو المحلات، وشحال منهم خدمو وخلّصو.')}</p>
        </div>
      </div>
      {rows.length ? (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{bippoT('المصدر')}</th>
                <th>{bippoT('تسجّلو')}</th>
                <th>{bippoT('سجّلو طلبات')}</th>
                <th>{bippoT('خلّصو')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key || 'unknown'}>
                  <td>
                    <b>{row.label}</b>
                  </td>
                  <td>{row.signups}</td>
                  <td>{row.active}</td>
                  <td>{row.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-muted">{bippoT('مازال حتى تسجيل.')}</p>
      )}
      {campaigns.size > 0 && (
        <>
          <h3 className="admin-subtitle">{bippoT('الحملات')}</h3>
          <ul className="admin-campaigns">
            {[...campaigns].map(([name, item]) => (
              <li key={name}>
                <code dir="ltr">{name}</code>
                <span>{bippoT('{0} تسجيل · {1} خلّصو', [item.signups, item.paid])}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {topReferrers.length > 0 && (
        <>
          <h3 className="admin-subtitle">{bippoT('المحلات اللي جابو محلات')}</h3>
          <ul className="admin-campaigns">
            {topReferrers.map((item) => (
              <li key={item.id}>
                <b>{item.name}</b>
                <span>{bippoT('{0} تسجيل · {1} خلّصو', [item.signups, item.paid])}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// Builds the link to put in an ad, a post, a flyer QR or a referral message.
function LinkBuilder() {
  const [source, setSource] = useState('facebook');
  const [campaign, setCampaign] = useState('');
  const [page, setPage] = useState('/');
  const [copied, setCopied] = useState('');
  const link = trackingLink(location.origin, source, campaign, page);
  return (
    <section className="panel admin-section">
      <div className="admin-section-title">
        <div>
          <h2>{bippoT('روابط الإعلانات')}</h2>
          <p>
            {bippoT(
              'استعمل رابط خاص لكل إعلان، منشور ولا فلاير. المحل اللي يتسجّل منو يبان مصدرو هنا.',
            )}
          </p>
        </div>
      </div>
      <div className="admin-link-builder">
        <label>
          {bippoT('المصدر')}
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCE_ANSWERS.filter((key) => key !== 'other').map((key) => (
              <option key={key} value={key}>
                {bippoT(SOURCE_LABELS[key])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {bippoT('اسم الحملة — اختياري')}
          <input
            dir="ltr"
            maxLength={60}
            placeholder="cafes-alger-nov"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
          />
        </label>
        <label>
          {bippoT('الصفحة')}
          <select value={page} onChange={(e) => setPage(e.target.value)}>
            <option value="/">{bippoT('الصفحة الرئيسية')}</option>
            <option value="/signup">{bippoT('التسجيل مباشرة')}</option>
          </select>
        </label>
      </div>
      <div className="admin-link-output">
        <input dir="ltr" readOnly value={link} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="button small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(bippoT('نُسخ'));
            } catch {
              setCopied(bippoT('تعذر النسخ.'));
            }
          }}
        >
          <Copy size={15} />
          {bippoT('نسخ الرابط')}
        </button>
        {copied && <small role="status">{copied}</small>}
      </div>
    </section>
  );
}
