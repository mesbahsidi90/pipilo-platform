import React, { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Plus } from 'lucide-react';
import { t, ticketLink } from './i18n.js';
import { db } from './store';
import { rememberBranch } from './merchantBranches';

export async function workspaceAction(operation, fields = {}) {
  const { data, error } = await db.rpc('merchant_workspace', { operation, ...fields });
  if (error) throw error;
  return data;
}

export function BranchSelector({ workspace, shop, activity, onAdd, demo }) {
  const menu = useRef(null);
  const branches = workspace?.manager && workspace.branches?.length ? workspace.branches : [];
  const name = shop?.name || t('محلي');

  useEffect(() => {
    function dismiss(event) {
      const details = menu.current;
      if (!details?.open) return;
      if (event.type === 'pointerdown' && !details.contains(event.target)) details.open = false;
      if (event.type === 'keydown' && event.key === 'Escape' && details.contains(event.target)) {
        details.open = false;
        details.querySelector('summary').focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, []);

  function select(id) {
    menu.current.open = false;
    if (id === workspace.active) return;
    rememberBranch(id);
    const url = new URL(location.href);
    if (url.searchParams.has('branch')) {
      url.searchParams.delete('branch');
      location.replace(url.href);
    } else location.reload();
  }

  return (
    <details className="merchant-shop-menu" ref={menu}>
      <summary className="merchant-identity">
        {shop?.logo ? (
          <img src={shop.logo} alt="" />
        ) : (
          <span className="merchant-shop-avatar" aria-hidden="true">
            {Array.from(name)[0].toUpperCase()}
          </span>
        )}
        <span className="merchant-shop-label">
          <strong dir="auto">{name}</strong>
          <small>{activity}</small>
        </span>
        <ChevronDown className="merchant-shop-chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="merchant-shop-dropdown">
        {branches.length ? (
          branches.map((branch) => (
            <button
              type="button"
              key={branch.id}
              aria-current={branch.id === workspace.active ? 'true' : undefined}
              onClick={() => select(branch.id)}
            >
              <Building2 size={15} aria-hidden="true" />
              <span dir="auto">{branch.name}</span>
              {branch.id === workspace.active && (
                <Check className="merchant-shop-check" size={15} aria-hidden="true" />
              )}
            </button>
          ))
        ) : (
          <div className="merchant-shop-current">
            <Building2 size={15} aria-hidden="true" />
            <span dir="auto">{name}</span>
          </div>
        )}
        {(workspace?.manager || demo) && (
          <div className="merchant-shop-add">
            <button
              type="button"
              disabled={demo}
              onClick={() => {
                menu.current.open = false;
                onAdd();
              }}
            >
              <Plus size={16} aria-hidden="true" />
              <span>{t('محل جديد')}</span>
            </button>
            <small>
              {t(
                demo ? 'إضافة المحلات متاحة في الوضع السحابي.' : 'يتسجّل كفرع جديد تحت نفس الحساب.',
              )}
            </small>
          </div>
        )}
      </div>
    </details>
  );
}
export default function MerchantTeam({ workspace, refresh, branchesOnly = false }) {
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function run(operation, fields) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const data = await workspaceAction(operation, fields);
      if (operation === 'invite') setLink(ticketLink('invite/' + data.token));
      if (operation !== 'revoke') setLabel('');
      await refresh();
    } catch {
      setError(t('تعذر حفظ التغيير. عاود المحاولة.'));
    } finally {
      setBusy(false);
    }
  }

  if (!workspace?.manager) return null;
  return (
    <section className="panel merchant-team">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setLink('');
          void run(branchesOnly ? 'create_branch' : 'invite', {
            name: label.trim(),
            ...(branchesOnly ? {} : { target: target || workspace.active || workspace.home }),
          });
        }}
      >
        <label>
          {branchesOnly ? t('اسم الفرع') : t('اسم الموظف')}
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            maxLength={branchesOnly ? 100 : 80}
          />
        </label>
        {!branchesOnly && (
          <label>
            {t('الفرع')}
            <select
              value={target || workspace.active || workspace.home}
              onChange={(event) => setTarget(event.target.value)}
            >
              {workspace.branches
                .filter((branch) => branch.status === 'active')
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <button className="button" disabled={busy || !label.trim()}>
          {branchesOnly ? t('زيد فرع') : t('أنشئ دعوة')}
        </button>
      </form>
      {link && (
        <div className="merchant-invite">
          <p>{t('شارك رابط الدعوة مع الموظف. صالح لمدة 48 ساعة ويُستعمل لحساب واحد.')}</p>
          <input
            readOnly
            dir="ltr"
            aria-label={t('رابط الدعوة')}
            value={link}
            onFocus={(event) => event.target.select()}
          />
          <button
            type="button"
            className="button outline small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage(t('نُسخ الرابط'));
              } catch {
                setMessage(t('انسخ الرابط من الحقل.'));
              }
            }}
          >
            {t('نسخ الرابط')}
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <ul>
        {(branchesOnly ? workspace.branches : workspace.team).map((item) => (
          <li key={item.id}>
            <div>
              <strong>{branchesOnly ? item.name : item.label}</strong>
              <small>
                {branchesOnly
                  ? item.city
                  : workspace.branches.find((branch) => branch.id === item.shop_id)?.name}
              </small>
            </div>
            {branchesOnly ? (
              <span>{item.id === workspace.home ? t('الفرع الرئيسي') : ''}</span>
            ) : (
              <>
                <span>
                  {item.accepted
                    ? t('قبل الدعوة')
                    : Date.parse(item.expires_at) <= Date.now()
                      ? t('انتهت الدعوة')
                      : t('ينتظر القبول')}
                </span>
                <button
                  type="button"
                  className="button outline small"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(t('تلغي الدعوة أو دخول هذا الموظف للفرع؟'))) return;
                    setLink('');
                    void run('revoke', { target: item.id });
                  }}
                >
                  {t('إلغاء الوصول')}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
