import { t as bippoT } from './i18n.js';
import React, { useState } from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { submitOrderFeedback } from './guestApi';

export default function ReviewCard({ url, ticket, allowFeedback, alreadySent }) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy || !message.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (!(await submitOrderFeedback(ticket, message))) throw new Error();
      setSent(true);
      setMessage('');
    } catch {
      setError(bippoT('تعذّر إرسال الملاحظة. عاود المحاولة.'));
    } finally {
      setBusy(false);
    }
  }

  if (!url && !allowFeedback && !alreadySent && !sent) return null;
  return (
    <section className="review-card">
      <Star size={28} aria-hidden="true" />
      <h2>{bippoT('واش رايك في التجربة؟')}</h2>
      {url && (
        <>
          <a className="button" href={url} target="_blank" rel="noopener noreferrer">
            {bippoT('قيّم المحل في Google ')}
            <ExternalLink size={17} />
          </a>
          <small>{bippoT('اختياري، يفتح Google وقد يطلب تسجيل الدخول.')}</small>
        </>
      )}
      {sent || alreadySent ? (
        <p role="status">{bippoT('وصلت ملاحظتك للمحل. يعطيك الصحة!')}</p>
      ) : (
        allowFeedback && (
          <details className="private-feedback">
            <summary>{bippoT('خلّي ملاحظة خاصة للمحل')}</summary>
            <form onSubmit={submit}>
              <label>
                {bippoT('ملاحظتك')}
                <textarea
                  rows={3}
                  maxLength={500}
                  required
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <p>{bippoT('تظهر لصاحب المحل. ما تكتبش فيها معلومات شخصية.')}</p>
              <button className="button outline" disabled={busy || !message.trim()}>
                {bippoT('أرسل الملاحظة')}
              </button>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </form>
          </details>
        )
      )}
    </section>
  );
}
