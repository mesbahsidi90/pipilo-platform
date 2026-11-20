import React, { useCallback, useEffect, useState } from 'react';
import { t } from './i18n.js';
import CustomerPager from './CustomerPager';
import OrderAlerts from './OrderAlerts';
import { trialRequest } from './trialSync';

// A /jarreb trial ticket opened on any phone: same page, alert and «راني جاي»
// as a real order, read from the server copy (6 hours).
export default function TrialCustomer({ token }) {
  const [ticket, setTicket] = useState(null),
    [missing, setMissing] = useState(false),
    [offline, setOffline] = useState(false),
    [ack, setAck] = useState(() => {
      try {
        return sessionStorage.getItem('bippo-alert-ack-' + token) === '1';
      } catch {
        return false;
      }
    });

  const load = useCallback(async () => {
    try {
      setTicket(await trialRequest('trial-track', { ticket: token }));
      setMissing(false);
      setOffline(false);
    } catch (e) {
      if (e.status === 404) setMissing(true);
      else setOffline(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 3000);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  // «شافه» on the owner's board: the ready ticket was on screen.
  useEffect(() => {
    if (ticket?.status !== 'ready') return;
    const seen = () => {
      if (document.visibilityState === 'visible')
        trialRequest('trial-signal', { ticket: token, event: 'ready_seen' }).catch(() => {});
    };
    seen();
    document.addEventListener('visibilitychange', seen);
    return () => document.removeEventListener('visibilitychange', seen);
  }, [ticket?.status, token]);

  const acknowledge = () => {
    setAck(true);
    trialRequest('trial-signal', { ticket: token, event: 'coming' }).catch(() => {});
  };

  return (
    <CustomerPager
      branding={ticket ? { name: ticket.name, kind: ticket.kind } : null}
      number={ticket?.number}
      status={ticket?.status}
      acknowledged={ack || Boolean(ticket?.coming_at)}
      loading={!ticket && !missing}
      error={missing ? t('انتهت هذي التجربة. اطلب من صاحب المحل تيكي جديد.') : ''}
      extra={<p className="trial-ticket-note">{t('تيكي تجربة Bipilo · يتمسح بعد 6 ساعات.')}</p>}
    >
      {ticket && ['preparing', 'ready'].includes(ticket.status) && (
        <OrderAlerts
          ticket={token}
          status={ticket.status}
          trial
          tone="pager"
          offline={offline}
          onAcknowledge={acknowledge}
          onRefresh={load}
        />
      )}
    </CustomerPager>
  );
}
