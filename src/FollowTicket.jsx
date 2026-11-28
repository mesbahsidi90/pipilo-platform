import { t as bippoT } from './i18n.js';
import React, { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { Brand } from './Landing';

// «تابع طلبك»: what the installed app shows when no order is open on this
// phone. Customers scan the code at the counter; pasting a link is kept for
// the rare iPhone case (the home-screen app does not share Safari's memory).
export default function FollowTicket() {
  const [value, setValue] = useState(''),
    [error, setError] = useState('');
  function open(e) {
    e.preventDefault();
    let ticket = value.trim(),
      kind = 'track';
    try {
      if (ticket.includes('://')) {
        const url = new URL(ticket);
        if (
          ![
            location.origin,
            'https://bipilo.app',
            'https://bippo-platform.pages.dev',
            'https://bipilo-platform.pages.dev',
          ].includes(url.origin)
        )
          throw new Error();
        kind = url.hash.startsWith('#demo/') ? 'demo' : 'track';
        ticket = url.hash.replace(/^#(?:track|demo)\//, '');
      }
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ticket)
      )
        throw new Error();
      localStorage.setItem('bippo-last-ticket', ticket);
      localStorage.setItem('bippo-last-ticket-route', kind);
      location.hash = kind + '/' + ticket;
    } catch {
      setError(bippoT('الصق رابط الطلب الخاص بـ Bipilo كاملًا.'));
    }
  }
  return (
    <>
      <header className="nav wrap">
        <Brand />
      </header>
      <section className="panel login follow-scan">
        <span className="follow-scan-icon" aria-hidden="true">
          <ScanLine size={40} />
        </span>
        <h1>{bippoT('تابع طلبك')}</h1>
        <p>{bippoT('امسح الكود اللي في الكونتوار بكاميرا تليفونك، وتابع طلبك من هنا.')}</p>
        <small>{bippoT('ما تحتاج لا تطبيق لا حساب.')}</small>
        <details className="follow-link">
          <summary>{bippoT('عندك رابط طلب؟')}</summary>
          <form onSubmit={open}>
            <label>
              {bippoT('رابط الطلب')}
              <input
                type="text"
                inputMode="url"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                dir="ltr"
                placeholder="https://bipilo.app/#track/…"
              />
            </label>
            <button className="button">{bippoT('افتح الطلب')}</button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        </details>
      </section>
      {/* Shop owners and staff who installed the app land here when signed out. */}
      <section className="panel login follow-owner">
        <h2>{bippoT('صاحب محل ولا عامل؟')}</h2>
        <p>{bippoT('ادخل لحسابك، ومن بعد التطبيق يتحل مباشرة على لوحة التحكم.')}</p>
        <a className="button outline" href="/login?next=%2Fdashboard">
          {bippoT('ادخل للوحة التحكم')}
        </a>
      </section>
    </>
  );
}
