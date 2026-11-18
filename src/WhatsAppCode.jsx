import { t as bippoT } from './i18n.js';
import React, { useEffect, useRef, useState } from 'react';
import { db } from './store';
import { normalizePhone, validCode } from './phone';

const RESEND_SECONDS = 60;

function sendError(e, existingOnly) {
  const text = `${e?.code || ''} ${e?.message || ''}`.toLowerCase();
  if (existingOnly && (text.includes('signups not allowed') || text.includes('otp_disabled')))
    return bippoT('ما كاينش حساب بهذا الرقم. أنشئ حساب جديد.');
  if (e?.status === 429 || text.includes('rate')) return bippoT('محاولات كثيرة. استنى شوية وعاود.');
  if (text.includes('invalid') && text.includes('phone'))
    return bippoT('رقم الهاتف ماشي صحيح. اكتبو كيما 0551234567.');
  return bippoT('ما قدرناش نبعثو الكود في واتساب. تأكد من الرقم وعاود.');
}

// Two steps: phone number → 6-digit code sent on WhatsApp by Supabase Auth
// (Twilio Verify). `existingOnly` stops the login form from creating accounts.
export default function WhatsAppCode({ existingOnly = false, onVerified }) {
  const [phone, setPhone] = useState(''),
    [sentTo, setSentTo] = useState(null),
    [code, setCode] = useState(''),
    [wait, setWait] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const codeInput = useRef(null);

  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  useEffect(() => {
    if (sentTo) codeInput.current?.focus();
  }, [sentTo]);

  async function send(target) {
    setBusy(true);
    setError('');
    try {
      const { error } = await db.auth.signInWithOtp({
        phone: target,
        options: { channel: 'whatsapp', shouldCreateUser: !existingOnly },
      });
      if (error) throw error;
      setSentTo(target);
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (e) {
      setError(sendError(e, existingOnly));
    } finally {
      setBusy(false);
    }
  }

  function requestCode(event) {
    event.preventDefault();
    const target = normalizePhone(phone);
    if (!target) {
      setError(bippoT('رقم الهاتف ماشي صحيح. اكتبو كيما 0551234567.'));
      return;
    }
    send(target);
  }

  async function verify(event) {
    event.preventDefault();
    if (!validCode(code)) return;
    setBusy(true);
    setError('');
    try {
      const { data, error } = await db.auth.verifyOtp({
        phone: sentTo,
        token: code.trim(),
        type: 'sms',
      });
      if (error) throw error;
      onVerified?.(data.session);
    } catch (e) {
      setError(
        e?.status === 429
          ? bippoT('محاولات كثيرة. استنى شوية وعاود.')
          : bippoT('الكود غالط ولا فاتت مدتو. عاود اكتبو ولا اطلب كود جديد.'),
      );
    } finally {
      setBusy(false);
    }
  }

  // A <div> rather than a nested <form>, so it also works inside the signup form.
  const submitOnEnter = (handler) => (e) => {
    if (e.key === 'Enter') handler(e);
  };

  if (!sentTo)
    return (
      <div className="whatsapp-code" aria-busy={busy}>
        <label>
          {bippoT('رقم الهاتف (واتساب)')}
          <input
            type="tel"
            name="phone"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0551 23 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={submitOnEnter(requestCode)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          type="button"
          className="button full"
          disabled={busy || !phone.trim()}
          onClick={requestCode}
        >
          {busy ? bippoT('نبعثو الكود…') : bippoT('ابعثلي الكود في واتساب')}
        </button>
      </div>
    );

  return (
    <div className="whatsapp-code" aria-busy={busy}>
      <p className="whatsapp-code-sent">
        {bippoT('بعثنا كود من 6 أرقام في واتساب لـ')} <bdi dir="ltr">{sentTo}</bdi>
      </p>
      <label>
        {bippoT('كود التأكيد')}
        <input
          ref={codeInput}
          name="code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={submitOnEnter(verify)}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button full"
        disabled={busy || !validCode(code)}
        onClick={verify}
      >
        {busy ? bippoT('نتأكدو…') : bippoT('تأكيد')}
      </button>
      <div className="whatsapp-code-actions">
        <button
          type="button"
          className="link"
          disabled={busy || wait > 0}
          onClick={() => send(sentTo)}
        >
          {wait > 0 ? bippoT('عاود البعث بعد {0} ثانية', [wait]) : bippoT('عاود ابعث الكود')}
        </button>
        <button
          type="button"
          className="link"
          disabled={busy}
          onClick={() => {
            setSentTo(null);
            setError('');
          }}
        >
          {bippoT('بدّل الرقم')}
        </button>
      </div>
    </div>
  );
}
