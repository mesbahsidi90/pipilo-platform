import React, { useEffect, useRef, useState } from 'react';
import { Check, Delete, ExternalLink, Megaphone, Monitor, Repeat, Smartphone } from 'lucide-react';
import { t } from './i18n.js';
import DotNumber from './DotNumber';
import { cleanCallNumber, screenLink as linkState } from './quickCallRules';
import { screenStatus } from './store';
import { useWaitingToken, waitingDisplayLink } from './MerchantCodes';
import './quick-call.css';

// «نداء سريع»: for a cashier who already uses another till (e.g. one that prints
// kitchen tickets). Type the invoice number once, press «نادي», and it appears
// big on the waiting screen with sound. No «قيد التحضير» step.
export default function QuickCall({
  calls,
  waiting = [],
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
  // Is the waiting screen on? Checked every 30 seconds.
  const [screen, setScreen] = useState({ state: 'unknown' });
  useEffect(() => {
    let live = true;
    const check = () =>
      screenStatus()
        .then((status) => live && setScreen(linkState(status)))
        .catch(() => live && setScreen({ state: 'unknown' }));
    check();
    const timer = setInterval(check, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
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
        {screen.state !== 'unknown' && (
          <span className={'quick-call-screen ' + screen.state} role="status">
            <i aria-hidden="true" />
            {screen.state === 'on'
              ? t('الشاشة متصلة')
              : screen.state === 'never'
                ? t('الشاشة مازال ما تشعلت')
                : t('الشاشة ما راهيش متصلة منذ {0} د', [screen.minutes])}
          </span>
        )}
        {screenLink && (
          <a className="button outline small" href={screenLink} target="_blank" rel="noreferrer">
            <Monitor size={16} />
            {t('افتح شاشة النداء')}
            <ExternalLink size={14} />
          </a>
        )}
      </header>

      <section className="quick-call-waiting" aria-labelledby="quick-call-waiting-title">
        <h2 id="quick-call-waiting-title">
          <Smartphone size={20} />
          {t('زبائن يستنّاو في تليفوناتهم')}
          {waiting.length > 0 && <span className="quick-call-count">{waiting.length}</span>}
        </h2>
        {waiting.length ? (
          <>
            <p className="quick-call-hint">
              {t('كي يوجد الطلب، اضغط على الرقم: يبان في الشاشة ويصوني تليفون الزبون.')}
            </p>
            <ul>
              {waiting.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    className={
                      Date.now() - (Date.parse(order.created_at || '') || 0) < 30000 ? 'new' : ''
                    }
                    disabled={busy}
                    onClick={() => onCall(order.number)}
                    aria-label={t('نادي {0}', [order.number])}
                  >
                    <b dir="ltr">{order.number}</b>
                    <span>
                      <Megaphone size={18} />
                      {t('نادي')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="quick-call-empty">
            {t('كي يمسح الزبون الكود ويكتب رقم فاتورتو، يبان رقمو هنا.')}
          </p>
        )}
      </section>

      <div className="quick-call-body">
        <form className="quick-call-pad" onSubmit={submit}>
          <label className="quick-call-field">
            <span>{labelNumber}</span>
            <input
              ref={input}
              value={value}
              onChange={(event) => setValue(cleanCallNumber(event.target.value))}
              // The page keypad types the number; the phone keyboard stays closed.
              inputMode="none"
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
