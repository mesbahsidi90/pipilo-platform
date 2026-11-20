import React, { useEffect, useState } from 'react';
import { Megaphone, Sparkles, TriangleAlert, Send, Square } from 'lucide-react';
import { t, language, locale } from './i18n';
import {
  adminAnnouncements,
  announcementBody,
  cleanAnnouncement,
  dismissAnnouncement,
  endAnnouncement,
  myAnnouncements,
  postAnnouncement,
} from './announcements';
import './announcements.css';

const toneIcons = { info: Megaphone, new: Sparkles, warning: TriangleAlert };
const toneLabels = { info: 'معلومة', new: 'ميزة جديدة', warning: 'تنبيه' };
const audienceLabels = {
  all: 'كل المحلات',
  free: 'المحلات المجانية',
  paid: 'المحلات الاحترافية',
};

// Shop dashboard: the platform's live announcements, until «فهمت».
export function ShopAnnouncements() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let live = true;
    myAnnouncements()
      .then((rows) => live && setItems(rows || []))
      .catch(() => {
        // An announcement never blocks the dashboard.
      });
    return () => {
      live = false;
    };
  }, []);
  async function dismiss(id) {
    setItems((rows) => rows.filter((row) => row.id !== id));
    try {
      await dismissAnnouncement(id);
    } catch {
      // It shows again on the next visit.
    }
  }
  if (!items.length) return null;
  return (
    <section className="shop-announcements" aria-label={t('إعلانات Bipilo')}>
      {items.map((item) => {
        const Icon = toneIcons[item.tone] || Megaphone;
        return (
          <article key={item.id} className={'shop-announcement tone-' + (item.tone || 'info')}>
            <Icon size={18} aria-hidden="true" />
            <div>
              <small>{t(toneLabels[item.tone] || 'معلومة')} · Bipilo</small>
              <p>{announcementBody(item, language)}</p>
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer">
                  {t('اقرا أكثر')}
                </a>
              )}
            </div>
            <button type="button" className="button outline small" onClick={() => dismiss(item.id)}>
              {t('فهمت')}
            </button>
          </article>
        );
      })}
    </section>
  );
}

const emptyForm = { body_ar: '', body_fr: '', tone: 'new', audience: 'all', link: '', ends_on: '' };

// Admin: write an announcement, see who dismissed it, end it.
export function AdminAnnouncements() {
  const [rows, setRows] = useState(null),
    [form, setForm] = useState(emptyForm),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function load() {
    try {
      setRows(await adminAnnouncements());
    } catch {
      setError(t('ما قدرناش نحمّلو الإعلانات. عاود جرّب التحديث.'));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const { value, error: invalid } = cleanAnnouncement(form);
    if (invalid) return setError(t(invalid));
    setBusy(true);
    try {
      await postAnnouncement(value);
      setForm(emptyForm);
      setNotice(t('تنشر الإعلان. يبان في لوحة المحلات كي يفتحوها.'));
      await load();
    } catch {
      setError(t('ما قدرناش ننشرو الإعلان. عاود المحاولة.'));
    } finally {
      setBusy(false);
    }
  }
  async function end(id) {
    setBusy(true);
    setError('');
    try {
      await endAnnouncement(id);
      setNotice(t('وقّفنا الإعلان.'));
      await load();
    } catch {
      setError(t('ما قدرناش نوقّفو الإعلان. عاود المحاولة.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-section admin-announcements">
      <form onSubmit={submit} className="admin-announcement-form">
        <label>
          {t('الإعلان بالعربية')}
          <textarea
            required
            rows={3}
            maxLength={400}
            placeholder={t('مثلًا: ميزة جديدة! تقدر دروك توقّف الأرقام من الاستقبال.')}
            value={form.body_ar}
            onChange={change('body_ar')}
          />
        </label>
        <label>
          {t('بالفرنسية (اختياري)')}
          <textarea
            rows={2}
            maxLength={400}
            dir="ltr"
            value={form.body_fr}
            onChange={change('body_fr')}
          />
        </label>
        <div className="admin-form-grid">
          <label>
            {t('النوع')}
            <select value={form.tone} onChange={change('tone')}>
              {Object.entries(toneLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('لمن')}
            <select value={form.audience} onChange={change('audience')}>
              {Object.entries(audienceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('رابط (اختياري)')}
            <input
              type="url"
              dir="ltr"
              maxLength={300}
              placeholder="https://"
              value={form.link}
              onChange={change('link')}
            />
          </label>
          <label>
            {t('يبان حتى (اختياري)')}
            <input type="date" value={form.ends_on} onChange={change('ends_on')} />
          </label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <button className="button" disabled={busy}>
          <Send size={16} />
          {busy ? t('ننشرو…') : t('انشر الإعلان')}
        </button>
      </form>
      <h2>{t('الإعلانات السابقة')}</h2>
      {!rows ? (
        <p role="status">{t('نحمّلو…')}</p>
      ) : !rows.length ? (
        <p className="admin-form-note">{t('مازال ما نشرت حتى إعلان.')}</p>
      ) : (
        <ul className="admin-announcement-list">
          {rows.map((row) => (
            <li key={row.id} className={row.live ? 'live' : 'ended'}>
              <div>
                <small>
                  {t(toneLabels[row.tone] || 'معلومة')} · {t(audienceLabels[row.audience] || '')} ·{' '}
                  {new Date(row.created_at).toLocaleDateString(locale)}
                </small>
                <p>{row.body_ar}</p>
                <small>
                  {row.live
                    ? row.ends_at
                      ? t('يبان حتى {0}', [new Date(row.ends_at).toLocaleDateString(locale)])
                      : t('يبان حتى توقّفو')
                    : t('موقّف')}
                  {' · '}
                  {t('{0} حساب ضغط «فهمت»', [row.dismissed || 0])}
                </small>
              </div>
              {row.live && (
                <button
                  type="button"
                  className="button outline small"
                  disabled={busy}
                  onClick={() => end(row.id)}
                >
                  <Square size={14} />
                  {t('وقّف')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
