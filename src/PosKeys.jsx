import { t as bippoT, locale } from './i18n.js';
import React, { useEffect, useState } from 'react';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { POS_API_URL, createPosKey, listPosKeys, revokePosKey } from './posApi';

const errors = {
  too_many: 'وصلت لـ5 مفاتيح. احذف واحد قبل ما تزيد.',
  plan_required: 'الربط مع الكاشير في الباقة الاحترافية.',
  forbidden: 'غير صاحب المحل يقدر يسيّر المفاتيح.',
};

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    done(bippoT('نُسخ'));
  } catch {
    done(bippoT('تعذر النسخ.'));
  }
}

// Card body: branch keys for the cashier system, and the API address.
export default function PosKeys({ locked }) {
  const [keys, setKeys] = useState(null),
    [label, setLabel] = useState(''),
    [fresh, setFresh] = useState(null),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(''),
    [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listPosKeys()
      .then((rows) => alive && setKeys(rows || []))
      .catch(() => alive && setError(bippoT('تعذر تحميل المفاتيح.')));
    return () => {
      alive = false;
    };
  }, []);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    try {
      const result = await createPosKey(label);
      if (result?.error) return setError(bippoT(errors[result.error] || 'تعذر إنشاء المفتاح.'));
      setFresh(result);
      setLabel('');
      setKeys(await listPosKeys());
    } catch {
      setError(bippoT('تعذر إنشاء المفتاح.'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(row) {
    if (!window.confirm(bippoT('تحذف المفتاح «{0}»؟ الكاشير اللي يستعملو يحبس.', [row.label])))
      return;
    setError('');
    try {
      await revokePosKey(row.id);
      setKeys((rows) => rows.filter((r) => r.id !== row.id));
      if (fresh?.prefix === row.prefix) setFresh(null);
    } catch {
      setError(bippoT('تعذر حذف المفتاح.'));
    }
  }

  const when = (value) =>
    value
      ? new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
      : bippoT('مازال ما تستعملش');

  return (
    <div className="pos-keys">
      <label className="pos-field">
        {bippoT('عنوان الواجهة')}
        <span>
          <input dir="ltr" readOnly value={POS_API_URL} onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className="icon-button"
            aria-label={bippoT('انسخ العنوان')}
            onClick={() => copy(POS_API_URL, setNote)}
          >
            <Copy size={16} />
          </button>
        </span>
      </label>

      {fresh && (
        <div className="pos-fresh" role="status">
          <b>{bippoT('هذا مفتاحك. انسخو درك: ما يبانش مرة أخرى.')}</b>
          <span>
            <input dir="ltr" readOnly value={fresh.key} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="icon-button"
              aria-label={bippoT('انسخ المفتاح')}
              onClick={() => copy(fresh.key, setNote)}
            >
              <Copy size={16} />
            </button>
          </span>
          <small>
            {bippoT('حطّو في نظام الكاشير فقط، ما تبعثوش في رسالة ولا تحطّو في صفحة ويب.')}
          </small>
        </div>
      )}
      {note && <small role="status">{note}</small>}

      {keys === null && !error && <p role="status">{bippoT('نحمّلو المفاتيح…')}</p>}
      {keys?.length > 0 && (
        <ul className="pos-key-list">
          {keys.map((row) => (
            <li key={row.id}>
              <KeyRound size={16} aria-hidden="true" />
              <span>
                <b>{row.label}</b>
                <small dir="ltr">{row.prefix}…</small>
                <small>{bippoT('آخر استعمال: {0}', [when(row.last_used_at)])}</small>
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label={bippoT('احذف المفتاح «{0}»', [row.label])}
                onClick={() => revoke(row)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <form className="pos-create" onSubmit={create}>
          <label>
            {bippoT('اسم المفتاح')}
            <input
              maxLength={60}
              placeholder={bippoT('مثلًا: كاشير الكونتوار')}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <button className="button small" disabled={busy || keys?.length >= 5}>
            {busy ? bippoT('ننشؤو…') : bippoT('أنشئ مفتاح')}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <a className="pos-docs" href="/developers" target="_blank" rel="noreferrer">
        {bippoT('وثائق المطوّرين')}
      </a>
    </div>
  );
}
