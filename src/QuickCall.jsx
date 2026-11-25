import React, { useEffect, useRef, useState } from 'react';
import { Check, Delete, ExternalLink, Megaphone, Monitor, Repeat } from 'lucide-react';
import { t } from './i18n.js';
import DotNumber from './DotNumber';
import { cleanCallNumber } from './quickCallRules';
import { useWaitingToken, waitingDisplayLink } from './MerchantCodes';
import './quick-call.css';

// «نداء سريع»: for a cashier who already uses another till (e.g. one that prints
// kitchen tickets). Type the invoice number once, press «نادي», and it appears
// big on the waiting screen with sound. No «قيد التحضير» step.
export default function QuickCall({
  calls,
  busy,
  onCall,
  onCollect,
  onRingAgain,
  venue,
  notice,
  labelNumber,
}) {
  const [value, setValue] = useState('');
  const { token, code } = useWaitingToken();
  const screenLink = token ? waitingDisplayLink(token, venue, venue, false, true, code) : null;
  const input = useRef(null);
  useEffect(() => {
    input.current?.focus();
  }, []);

  const press = (key) => {
    setValue((current) => cleanCallNumber(current + key));
    input.current?.focus();
  };
  async function submit(event) {
    event?.preventDefault();
    const number = cleanCallNumber(value);
    if (!number || busy) return;
    const ok = await onCall(number);
    if (ok !== false) setValue('');
    input.current?.focus();
  }

  return (
    <section className="quick-call" aria-labelledby="quick-call-title">
      <header className="quick-call-head">
        <div>
          <p id="quick-call-title">
            {t('اكتب رقم الفاتورة واضغط «نادي». يبان كبير في الشاشة ويتقال بالصوت.')}
          </p>
        </div>
        {screenLink && (
          <a className="button outline small" href={screenLink} target="_blank" rel="noreferrer">
            <Monitor size={16} />
            {t('افتح شاشة النداء')}
            <ExternalLink size={14} />
          </a>
        )}
      </header>

      <div className="quick-call-body">
        <form className="quick-call-pad" onSubmit={submit}>
          <label className="quick-call-field">
            <span>{labelNumber}</span>
            <input
              ref={input}
              value={value}
              onChange={(event) => setValue(cleanCallNumber(event.target.value))}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={8}
              dir="ltr"
            />
          </label>
          <div className="quick-call-keys" dir="ltr">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
              <button type="button" key={key} onClick={() => press(key)}>
                {key}
              </button>
            ))}
            <button
              type="button"
              className="quick-call-delete"
              onClick={() => setValue((current) => current.slice(0, -1))}
              aria-label={t('امسح رقم')}
            >
              <Delete size={22} />
            </button>
            <button type="button" onClick={() => press('0')}>
              0
            </button>
            <button
              type="button"
              className="quick-call-clear"
              onClick={() => setValue('')}
              aria-label={t('امسح الكل')}
            >
              C
            </button>
          </div>
          <button className="button quick-call-go" disabled={!value || busy}>
            <Megaphone size={22} />
            {busy ? t('لحظة…') : t('نادي')}
          </button>
          {notice && (
            <p className="quick-call-notice" role="status">
              {notice}
            </p>
          )}
        </form>

        <div className="quick-call-list">
          <h2>{t('تنادات')}</h2>
          {calls.length ? (
            <ul>
              {calls.map((order) => (
                <li key={order.id}>
                  <DotNumber value={order.number} />
                  <div className="quick-call-actions">
                    {onRingAgain && (
                      <button
                        type="button"
                        className="button outline small"
                        disabled={busy}
                        onClick={() => onRingAgain(order)}
                      >
                        <Repeat size={15} />
                        {t('بيبيلو مرة تانية')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="button small"
                      disabled={busy}
                      onClick={() => onCollect(order)}
                    >
                      <Check size={15} />
                      {t('تسلّم')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="quick-call-empty">{t('ما كاش نداء دروك.')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
