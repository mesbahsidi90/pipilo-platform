import { language, locale as viewerLocale, translate } from './i18n.js';
import React, { useState } from 'react';
import { Store, UtensilsCrossed, Car } from 'lucide-react';
import { formatPrice, localName } from './menuRules';
import { cartLines, cartSummary, checkoutProblem } from './orderingRules';
import { placeOrder } from './ordering';

const modeIcons = { pickup: Store, table: UtensilsCrossed, car: Car };
export const modeLabels = { pickup: 'استلام من المحل', table: 'على الطاولة', car: 'في الطوموبيل' };

const problems = {
  empty: 'اختار حاجة من المنيو ولا اكتب طلبك.',
  table: 'اكتب رقم الطاولة.',
  plate: 'اكتب رقم لوحة الطوموبيل.',
  mode: 'اختار كيفاش تستلم.',
  closed: 'المحل ما راهوش ياخذ الطلبات من التليفون درك.',
  rate_limit: 'طلبات كثيرة في هذي الدقيقة. عاود بعد شوية.',
  invalid: 'كاين مشكل في الطلب. حدّث الصفحة وعاود.',
  busy: 'المحل عندو بزاف طلبات مفتوحة. عاود بعد شوية.',
};

// Checkout for ordering from the phone: mode, table/car details, note, send.
export default function OrderCheckout({
  branch,
  menu,
  cart,
  initialMode,
  initialTable = '',
  onBack,
}) {
  const lang = language;
  const t = (text, values) => translate(text, lang, values);
  const modes = menu.ordering?.modes || ['pickup'];
  const [mode, setMode] = useState(modes.includes(initialMode) ? initialMode : modes[0]);
  const [details, setDetails] = useState({
    name: '',
    note: '',
    table: initialTable,
    plate: '',
    color: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Same key for retries of this checkout, so a double tap makes one order.
  const [requestKey] = useState(() => crypto.randomUUID());
  const lines = cartLines(cart);
  const { total } = cartSummary(cart, menu);
  const items = new Map(menu.sections.flatMap((s) => s.items.map((i) => [i.id, i])));
  const field = (key) => ({
    value: details[key],
    onChange: (e) => setDetails({ ...details, [key]: e.target.value }),
  });

  async function send(event) {
    event.preventDefault();
    const problem = checkoutProblem(mode, { lines, ...details });
    if (problem) return setError(t(problems[problem]));
    setBusy(true);
    setError('');
    try {
      const result = await placeOrder({ branch, mode, cart, menu, details, requestKey });
      if (result?.token) {
        location.assign('/#track/' + result.token);
        return;
      }
      setError(
        result?.error === 'sold_out'
          ? t('«{0}» نفد. نحّيه من الطلب وعاود.', [result.item])
          : t(problems[result?.error] || problems.invalid),
      );
    } catch {
      setError(t('ما قدرناش نبعثو الطلب. تأكد من الاتصال وعاود.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="checkout" onSubmit={send}>
      <h2>{t('كمّل طلبك')}</h2>
      {lines.length > 0 && (
        <ul className="checkout-lines">
          {lines.map(({ id, qty }) => (
            <li key={id}>
              <span>
                {qty} × {localName(items.get(id), lang)}
              </span>
              <span>
                {formatPrice(Number(items.get(id)?.price || 0) * qty, menu.currency, viewerLocale)}
              </span>
            </li>
          ))}
          <li className="checkout-total">
            <span>{t('المجموع')}</span>
            <span>{formatPrice(total, menu.currency, viewerLocale)}</span>
          </li>
        </ul>
      )}
      <fieldset>
        <legend>{t('كيفاش تستلم؟')}</legend>
        <div className="checkout-modes">
          {modes.map((key) => {
            const Icon = modeIcons[key];
            return (
              <label key={key} className={mode === key ? 'on' : ''}>
                <input
                  type="radio"
                  name="order-mode"
                  value={key}
                  checked={mode === key}
                  onChange={() => setMode(key)}
                />
                <Icon size={22} aria-hidden="true" />
                {t(modeLabels[key])}
              </label>
            );
          })}
        </div>
      </fieldset>
      {mode === 'table' && (
        <label className="field">
          {t('رقم الطاولة')}
          <input inputMode="numeric" maxLength={10} required {...field('table')} />
        </label>
      )}
      {mode === 'car' && (
        <>
          <label className="field">
            {t('رقم لوحة الطوموبيل')}
            <input dir="ltr" maxLength={20} required {...field('plate')} />
          </label>
          <label className="field">
            {t('اللون — اختياري')}
            <input maxLength={20} {...field('color')} />
          </label>
        </>
      )}
      <label className="field">
        {t('اسمك — اختياري')}
        <input maxLength={40} autoComplete="given-name" {...field('name')} />
      </label>
      <label className="field">
        {lines.length ? t('ملاحظة — اختياري') : t('اكتب طلبك')}
        <textarea rows={2} maxLength={200} {...field('note')} />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="button full" disabled={busy}>
        {busy ? t('نبعثو طلبك…') : t('ابعث الطلب')}
      </button>
      <small className="hint">{t('تخلّص كي تستلم. المحل يقبل طلبك قبل ما يبدا يحضّرو.')}</small>
      <button type="button" className="button outline full" onClick={onBack}>
        {t('رجوع للمنيو')}
      </button>
    </form>
  );
}

// Customer's order page: what they ordered and whether the shop accepted it.
export function OnlineOrderSummary({ online, status }) {
  if (!online) return null;
  const t = (text, values) => translate(text, language, values);
  const d = online.details || {};
  const where =
    online.mode === 'table'
      ? t('على الطاولة {0}', [d.table])
      : online.mode === 'car'
        ? t('في الطوموبيل {0}', [[d.plate, d.color].filter(Boolean).join(' · ')])
        : t('استلام من المحل');
  return (
    <section className="online-summary" aria-label={t('طلبك من التليفون')}>
      {status === 'preparing' && (
        <span className={'online-state' + (online.accepted ? ' ok' : '')}>
          {online.accepted ? t('المحل قبل طلبك ✓') : t('نستناو المحل يقبل طلبك…')}
        </span>
      )}
      <span>{where}</span>
      {(d.items || []).length > 0 && (
        <ul className="checkout-lines">
          {d.items.map((item, i) => (
            <li key={i}>
              <span>
                {item.qty} × {item.name}
              </span>
            </li>
          ))}
          <li className="checkout-total">
            <span>{t('المجموع')}</span>
            <span>{formatPrice(d.total, online.currency || 'DZD', viewerLocale)}</span>
          </li>
        </ul>
      )}
      {d.note && <small>{d.note}</small>}
    </section>
  );
}
