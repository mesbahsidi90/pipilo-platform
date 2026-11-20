import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserPlus, UserMinus } from 'lucide-react';
import { t, locale } from './i18n';
import { cloud, db } from './store';

const demoKey = 'bipilo-demo-admins';
function readDemo() {
  try {
    const rows = JSON.parse(localStorage.getItem(demoKey) || 'null');
    if (Array.isArray(rows) && rows.length) return rows;
  } catch {
    // Fall back to the demo admin.
  }
  return [{ user_id: 'demo-admin', email: 'admin@bipilo.local', added_at: null, self: true }];
}
const writeDemo = (rows) => {
  try {
    localStorage.setItem(demoKey, JSON.stringify(rows));
  } catch {
    // Demo only.
  }
};
function check({ data, error }) {
  if (error) throw error;
  return data;
}

export async function listAdmins() {
  if (cloud) return check(await db.rpc('admin_list_admins')) || [];
  return readDemo();
}
// 'added' | 'already' | 'not_found'
export async function addAdmin(contact) {
  if (cloud) return check(await db.rpc('admin_add_admin', { contact }));
  const value = contact.trim().toLowerCase();
  if (!value.includes('@')) return 'not_found';
  const rows = readDemo();
  if (rows.some((row) => row.email === value)) return 'already';
  writeDemo([
    ...rows,
    { user_id: crypto.randomUUID(), email: value, added_at: new Date().toISOString() },
  ]);
  return 'added';
}
// 'removed' | 'self' | 'last' | 'not_admin'
export async function removeAdmin(userId) {
  if (cloud) return check(await db.rpc('admin_remove_admin', { target: userId }));
  const rows = readDemo();
  const row = rows.find((r) => r.user_id === userId);
  if (!row) return 'not_admin';
  if (row.self) return 'self';
  if (rows.length <= 1) return 'last';
  writeDemo(rows.filter((r) => r.user_id !== userId));
  return 'removed';
}

const addMessages = {
  added: 'تزاد كأدمين. يدخل لـ /admin بنفس الحساب.',
  already: 'هاذ الحساب أدمين من قبل.',
  not_found: 'ما لقيناش حساب بهاذ الإيميل ولا الرقم. لازم يسجّل في Bipilo أولًا.',
};
const removeMessages = {
  removed: 'تنحّات صلاحية الأدمين.',
  self: 'ما تقدرش تنحّي روحك. خلّي أدمين آخر يديرها.',
  last: 'لازم يبقى أدمين واحد على الأقل.',
  not_admin: 'هاذ الحساب ماشي أدمين.',
};
const formatDate = (value) => (value ? new Date(value).toLocaleDateString(locale) : '—');
const who = (row) => row.email || (row.phone ? '+' + row.phone : row.user_id);

// /admin → «الأدمين»: who can open this page, add one, remove one.
export default function AdminAccess() {
  const [rows, setRows] = useState(null),
    [contact, setContact] = useState(''),
    [confirming, setConfirming] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function load() {
    try {
      setRows(await listAdmins());
    } catch {
      setError(t('ما قدرناش نحمّلو قائمة الأدمين. عاود جرّب التحديث.'));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function add(event) {
    event.preventDefault();
    if (!contact.trim()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await addAdmin(contact.trim());
      const message = t(addMessages[result] || addMessages.not_found);
      if (result === 'added') {
        setNotice(message);
        setContact('');
        await load();
      } else setError(message);
    } catch {
      setError(t('ما قدرناش نزيدو الأدمين. عاود المحاولة.'));
    } finally {
      setBusy(false);
    }
  }
  async function remove(row) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await removeAdmin(row.user_id);
      const message = t(removeMessages[result] || removeMessages.not_admin);
      if (result === 'removed') {
        setNotice(message);
        await load();
      } else setError(message);
    } catch {
      setError(t('ما قدرناش ننحّيو الصلاحية. عاود المحاولة.'));
    } finally {
      setConfirming(null);
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-section admin-access">
      <div className="admin-section-title">
        <div>
          <h2>{t('شكون يقدر يدخل لإدارة المنصة')}</h2>
          <p>
            {t('الأدمين يشوف كل المحلات والحسابات ويبدّل الاشتراكات. زيد غير الناس اللي تثق فيهم.')}
          </p>
        </div>
      </div>
      <form className="admin-access-form" onSubmit={add}>
        <label>
          {t('إيميل ولا رقم تيليفون الحساب')}
          <input
            dir="ltr"
            autoComplete="off"
            maxLength={120}
            placeholder="name@example.com / 0551 23 45 67"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </label>
        <button className="button small" disabled={busy || !contact.trim()}>
          <UserPlus size={16} />
          {t('زيد أدمين')}
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="admin-notice">
          {notice}
        </p>
      )}
      {!rows ? (
        <p role="status">{t('نحمّلو…')}</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('الحساب')}</th>
                <th>{t('تزاد')}</th>
                <th>{t('آخر دخول')}</th>
                <th>{t('الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id}>
                  <td>
                    <b dir="ltr">{who(row)}</b>
                    {row.self && <small>{t('هذا أنت')}</small>}
                  </td>
                  <td>
                    {formatDate(row.added_at)}
                    {row.added_by && <small dir="ltr">{row.added_by}</small>}
                  </td>
                  <td>{formatDate(row.last_sign_in_at)}</td>
                  <td>
                    {row.self ? (
                      <ShieldCheck size={16} aria-label={t('هذا أنت')} />
                    ) : confirming === row.user_id ? (
                      <span className="admin-access-confirm">
                        <button
                          type="button"
                          className="button small admin-danger"
                          disabled={busy}
                          onClick={() => remove(row)}
                        >
                          {t('أكّد النزع')}
                        </button>
                        <button
                          type="button"
                          className="button outline small"
                          disabled={busy}
                          onClick={() => setConfirming(null)}
                        >
                          {t('إلغاء')}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="button outline small"
                        disabled={busy}
                        onClick={() => setConfirming(row.user_id)}
                      >
                        <UserMinus size={15} />
                        {t('نحّي الصلاحية')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
