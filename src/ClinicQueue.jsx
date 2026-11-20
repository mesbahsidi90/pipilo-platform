import React, { useEffect, useRef, useState } from 'react';
import { t, ticketLink } from './i18n';
import { cloud, db, createOrder, listOrders, sandbox, track, transition } from './store';
import { getSettings } from './shopSettings';
import { active } from './domain';
import Brand from './Brand';
import { becameNear, queueCompare, queuePaused, algiersToday } from './clinicRules';
const vibrate = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not every phone vibrates.
  }
};

export const clinicRoute = (id) => 'queue/' + (id || 'local');
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

const demoPauseKey = 'bipilo-demo-clinic-pause';
const readDemoPause = () => {
  try {
    return localStorage.getItem(demoPauseKey);
  } catch {
    return null;
  }
};
function patchDemoRow(id, patch) {
  try {
    const rows = JSON.parse(localStorage.getItem('nawba-demo-v1') || '[]');
    localStorage.setItem(
      'nawba-demo-v1',
      JSON.stringify(rows.map((row) => (row.id === id ? { ...row, ...patch } : row))),
    );
    window.dispatchEvent(new Event('nawba-change'));
  } catch {
    // Demo only.
  }
}

export async function clinicAction(operation, branch, requestToken, room) {
  if (cloud) {
    const { data, error } = await db.rpc('clinic_queue', {
      operation,
      branch: branch || null,
      request_token: requestToken || null,
      room: room || null,
    });
    if (error?.message === 'BIPILO_MONTHLY_TICKET_LIMIT' && operation === 'add') {
      throw new Error(t('وصلت للحد الشهري. تقدر تكمّل الطلبات المفتوحة أو تطلب تفعيل الاحترافية.'));
    }
    if (error) throw error;
    return data;
  }
  const shop = await getSettings();
  if (shop.kind !== 'clinic' || (branch && branch !== 'local')) return null;
  const paused = queuePaused(readDemoPause());
  if (operation === 'info') return { name: shop.name, paused };
  if (operation === 'join' && paused) return { paused: true };
  const rows = await listOrders();
  if (operation === 'next') {
    const waiting = rows
      .filter(
        (row) =>
          row.status === 'preparing' &&
          Date.parse(row.restored_at || row.created_at) > Date.now() - 86400000,
      )
      .sort(queueCompare);
    if (!waiting.length) return null;
    await transition(waiting[0], 'ready');
    patchDemoRow(waiting[0].id, { room: room || null });
    return { ...waiting[0], room: room || null };
  }
  if (!['join', 'add'].includes(operation)) return null;
  const used = new Set(rows.filter(active).map((row) => row.number));
  const highest = Math.max(
    0,
    ...rows
      .filter((row) => row.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10))
      .map((row) => Number(row.number)),
  );
  for (let offset = 0; offset < 9999; offset++) {
    const number = String(((highest + offset) % 9999) + 1);
    if (!used.has(number)) return createOrder(number);
  }
  return null;
}

export default function ClinicQueue({ branch }) {
  const [venue, setVenue] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    if (branch !== 'local' && !uuid.test(branch)) {
      setFailed(true);
      return;
    }
    clinicAction('info', branch)
      .then((value) => {
        if (live) {
          setVenue(value);
          setFailed(!value);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [branch]);

  async function join() {
    if (venue?.paused) return;
    setBusy(true);
    setError('');
    try {
      const key = 'bippo-clinic-queue-' + branch;
      const previous = JSON.parse(sessionStorage.getItem(key) || '{}');
      const order = previous.order && (await track(previous.order));
      if (order && active(order)) {
        location.assign(ticketLink('track/' + previous.order));
        return;
      }
      const request = (!previous.order && previous.request) || crypto.randomUUID();
      sessionStorage.setItem(key, JSON.stringify({ request }));
      const ticket = await clinicAction('join', branch, request);
      if (ticket?.paused) {
        sessionStorage.removeItem(key);
        setVenue((value) => ({ ...value, paused: true }));
        return;
      }
      if (!ticket?.token) throw new Error();
      sessionStorage.setItem(key, JSON.stringify({ order: ticket.token }));
      location.assign(ticketLink('track/' + ticket.token));
    } catch {
      setError(t('ما قدرناش نعطوك رقم. عاود المحاولة ولا توجّه للاستقبال.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap counter-guest">
      <Brand />
      <section className="panel">
        <h1>{t('خذ رقم دور')}</h1>
        {venue && (
          <>
            <p>{venue.name}</p>
            {venue.paused ? (
              <p role="status" className="queue-closed">
                {t('الأرقام وقفت لليوم. توجّه للاستقبال.')}
              </p>
            ) : (
              <>
                <p>{t('خذ رقمك وفعّل التنبيه باش تعرف كي يجي دورك.')}</p>
                <button className="button full" type="button" disabled={busy} onClick={join}>
                  {t('خذ رقم دور')}
                </button>
              </>
            )}
          </>
        )}
        {!venue && <p role="status">{t(failed ? 'الطابور غير متاح حاليًا.' : 'جارٍ الاتصال…')}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

// Reception: add a patient with an optional name and phone. Returns the ticket,
// { error: 'phone' } for a bad number, or null when the queue is full.
export async function addPatient(name, phone) {
  if (cloud) {
    const { data, error } = await db.rpc('clinic_add_patient', {
      guest: name || null,
      phone: phone || null,
    });
    if (error?.message === 'BIPILO_MONTHLY_TICKET_LIMIT')
      throw new Error(t('وصلت للحد الشهري. تقدر تكمّل الطلبات المفتوحة أو تطلب تفعيل الاحترافية.'));
    if (error) throw error;
    return data;
  }
  const ticket = await clinicAction('add');
  if (!ticket) return null;
  const guest_name = (name || '').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
  const guest_phone = phone || null;
  try {
    const rows = JSON.parse(localStorage.getItem('nawba-demo-v1') || '[]');
    localStorage.setItem(
      'nawba-demo-v1',
      JSON.stringify(
        rows.map((row) => (row.id === ticket.id ? { ...row, guest_name, guest_phone } : row)),
      ),
    );
  } catch {
    // Demo only.
  }
  return { ...ticket, guest_name, guest_phone };
}

// Reception: put a waiting patient first (pregnant, elderly, urgent) or back in order.
export async function setPriority(order, urgent) {
  if (cloud) {
    const { data, error } = await db.rpc('clinic_set_priority', {
      ticket: order.id,
      urgent: Boolean(urgent),
    });
    if (error) throw error;
    return data;
  }
  if (order.status !== 'preparing') return false;
  patchDemoRow(order.id, { priority: Boolean(urgent) });
  return true;
}

// Reception: «وقّف الأرقام» stops the QR from giving numbers until tomorrow.
export async function setQueuePaused(paused) {
  if (cloud) {
    const { error } = await db.rpc('clinic_pause', { paused: Boolean(paused) });
    if (error) throw error;
  } else {
    try {
      if (paused) localStorage.setItem(demoPauseKey, algiersToday());
      else localStorage.removeItem(demoPauseKey);
    } catch {
      // Demo only.
    }
    if (sandbox) void import('./trialSync').then((m) => m.saveTrialPlace(true));
  }
  return paused ? algiersToday() : null;
}
export const demoQueuePausedOn = () => (cloud ? null : readDemoPause());

// Patient's page while waiting: people ahead and a rough estimate.
export function QueuePlace({ queue }) {
  const previous = useRef(null);
  const ahead = typeof queue?.ahead === 'number' ? queue.ahead : null;
  useEffect(() => {
    if (becameNear(previous.current, ahead)) vibrate([200, 100, 200]);
    previous.current = ahead;
  }, [ahead]);
  if (ahead === null) return null;
  const minutes = queue.minutes_each > 0 ? Math.max(1, queue.ahead * queue.minutes_each) : null;
  const near = ahead > 0 && ahead <= 2;
  return (
    <section className={'queue-place' + (near ? ' queue-near' : '')} aria-live="polite">
      {queue.priority && <small className="queue-priority">{t('عندك أولوية في الدور')}</small>}
      {near && <strong className="queue-near-title">{t('قرب دورك!')}</strong>}
      {queue.ahead === 0 ? (
        <>
          <strong>{t('دورك الجاي')}</strong>
          <span>{t('قرّب للاستقبال، راهم ينادوك دروك.')}</span>
        </>
      ) : (
        <>
          <strong>{t('قدّامك {0}', [queue.ahead])}</strong>
          <span>
            {near
              ? t('ما تبعدش، رجع قريب من الاستقبال.')
              : minutes
                ? t('حوالي {0} دقيقة حسب وتيرة اليوم.', [minutes])
                : t('نحدّثو العدد وحدو كي ينادو على اللي قبلك.')}
          </span>
        </>
      )}
    </section>
  );
}
