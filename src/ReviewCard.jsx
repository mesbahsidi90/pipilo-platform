import { t as bippoT } from './i18n.js';
import React, { useState } from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { submitOrderFeedback, rateOrder } from './guestApi';

function StarRating({ ticket, initial }) {
  const [stars, setStars] = useState(initial || 0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = Boolean(initial) || stars > 0;

  async function rate(value) {
    if (done || busy) return;
    setBusy(true);
    setError('');
    try {
      if (!(await rateOrder(ticket, value))) throw new Error();
      setStars(value);
    } catch {
      setError(bippoT('تعذّر حفظ التقييم. عاود المحاولة.'));
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || stars;
  return (
    <div className="star-rating">
      <div
        className="star-rating-row"
        role="radiogroup"
        aria-label={bippoT('قيّم الخدمة من 1 إلى 5')}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={stars === value}
            aria-label={bippoT('{0} من 5', [value])}
            disabled={done || busy}
            className={value <= shown ? 'on' : ''}
            onMouseEnter={() => !done && setHover(value)}
            onClick={() => rate(value)}
          >
            <Star size={30} aria-hidden="true" />
          </button>
        ))}
      </div>
      {done && <p role="status">{bippoT('شكرًا على تقييمك!')}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ReviewCard({ url, ticket, allowFeedback, alreadySent, initialRating }) {
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

  return (
    <section className="review-card">
      <h2>{bippoT('واش رايك في التجربة؟')}</h2>
      <StarRating ticket={ticket} initial={initialRating} />
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
