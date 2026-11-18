import React, { useEffect, useState } from 'react';
import { t, ticketLink } from './i18n';
import { cloud, db, createOrder, listOrders, track, transition } from './store';
import { getSettings } from './shopSettings';
import { active } from './domain';
import Brand from './Brand';

export const clinicRoute = id => 'queue/' + (id || 'local');
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function clinicAction(operation, branch, requestToken) {
  if (cloud) {
    const { data, error } = await db.rpc('clinic_queue', {
      operation, branch: branch || null, request_token: requestToken || null
    });
    if (error?.message === 'BIPILO_MONTHLY_TICKET_LIMIT' && operation === 'add') {
      throw new Error(t('وصلت للحد الشهري. تقدر تكمّل الطلبات المفتوحة أو تطلب تفعيل الاحترافية.'));
    }
    if (error) throw error;
    return data;
  }
  const shop = await getSettings();
  if (shop.kind !== 'clinic' || (branch && branch !== 'local')) return null;
  if (operation === 'info') return { name: shop.name };
  const rows = await listOrders();
  if (operation === 'next') {
    const waiting = rows.filter(row => row.status === 'preparing' && Date.parse(row.restored_at || row.created_at) > Date.now() - 86400000)
      .sort((a, b) => (a.restored_at || a.created_at).localeCompare(b.restored_at || b.created_at) || a.id.localeCompare(b.id));
    if (!waiting.length) return null;
    await transition(waiting[0], 'ready');
    return waiting[0];
  }
  if (!['join', 'add'].includes(operation)) return null;
  const used = new Set(rows.filter(active).map(row => row.number));
  const highest = Math.max(0, ...rows.filter(row => row.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).map(row => Number(row.number)));
  for (let offset = 0; offset < 9999; offset++) {
    const number = String((highest + offset) % 9999 + 1);
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
    clinicAction('info', branch).then(value => {
      if (live) { setVenue(value); setFailed(!value); }
    }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [branch]);

  async function join() {
    setBusy(true);
    setError('');
    try {
      const key = 'bippo-clinic-queue-' + branch;
      const previous = JSON.parse(sessionStorage.getItem(key) || '{}');
      const order = previous.order && await track(previous.order);
      if (order && active(order)) {
        location.assign(ticketLink('track/' + previous.order));
        return;
      }
      const request = !previous.order && previous.request || crypto.randomUUID();
      sessionStorage.setItem(key, JSON.stringify({ request }));
      const ticket = await clinicAction('join', branch, request);
      if (!ticket?.token) throw new Error();
      sessionStorage.setItem(key, JSON.stringify({ order: ticket.token }));
      location.assign(ticketLink('track/' + ticket.token));
    } catch {
      setError(t('ما قدرناش نعطوك رقم. عاود المحاولة ولا توجّه للاستقبال.'));
    } finally {
      setBusy(false);
    }
  }

  return <main className="wrap counter-guest">
    <Brand />
    <section className="panel">
      <h1>{t('خذ رقم دور')}</h1>
      {venue && <><p>{venue.name}</p><p>{t('خذ رقمك وفعّل التنبيه باش تعرف كي يجي دورك.')}</p>
        <button className="button full" type="button" disabled={busy} onClick={join}>{t('خذ رقم دور')}</button></>}
      {!venue && <p role="status">{t(failed ? 'الطابور غير متاح حاليًا.' : 'جارٍ الاتصال…')}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  </main>;
}
