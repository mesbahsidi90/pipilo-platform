import React, { useEffect, useState } from 'react';
import { branchOrderFeedback } from './guestApi';
import { locale, t } from './i18n';
import './post-pickup.css';

export default function MerchantFeedback() {
  const [notes, setNotes] = useState(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    branchOrderFeedback()
      .then((data) => {
        if (active) setNotes(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  function refresh() {
    setFailed(false);
    setNotes(null);
    setRevision((value) => value + 1);
  }

  return (
    <section className="panel merchant-feedback">
      <header>
        <h2>{t('آخر ملاحظات الزبائن')}</h2>
        <button type="button" className="button outline small" onClick={refresh}>
          {t('تحديث')}
        </button>
      </header>
      {failed ? (
        <p role="alert">{t('تعذّر تحميل الملاحظات.')}</p>
      ) : !notes ? (
        <p role="status">{t('جارٍ الاتصال…')}</p>
      ) : notes.length === 0 ? (
        <p>{t('ما كاش ملاحظات بعد.')}</p>
      ) : (
        <ul>
          {notes.map((note) => (
            <li key={note.order_id}>
              <b>{t('تيكي {0}', [note.number])}</b>
              <time dateTime={note.created_at}>
                {new Date(note.created_at).toLocaleString(locale)}
              </time>
              <p dir="auto">{note.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
