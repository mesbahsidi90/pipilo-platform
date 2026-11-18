import { t as bippoT, locale as bippoLocale } from "./i18n.js";
import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, CalendarDays, ChevronRight, ChevronLeft } from 'lucide-react';
import { transition } from './store';
import { loadReportOrders } from './reportOrders';
import { statuses } from './domain';
import { summarize, secondsBetween, duration, orderCSV } from './reporting';
import ReportCharts from './ReportCharts';
function rollingPeriod(days) {
  const now = Date.now();
  return { from: new Date(now - days * 86400000).toISOString(), to: new Date(now).toISOString() };
}

export default function Reports({ clinic = false, initialPeriod = null }) {
  const [custom, setCustom] = useState({
      from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10)
    }),
    [customError, setCustomError] = useState('');
  const [days, setDays] = useState(initialPeriod ? 7 : 30),
    [zone, setZone] = useState('Africa/Algiers'),
    [page, setPage] = useState(0),
    [orders, setOrders] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const [period, setPeriod] = useState(() => initialPeriod || rollingPeriod(30));

  function selectPeriod(value) {
    setDays(value);
    if (value > 0) {
      setPage(0);
      setPeriod(rollingPeriod(value));
    }
  }

  function refresh() {
    setPage(0);
    if (days > 0) setPeriod(rollingPeriod(days));
    else setRevision(value => value + 1);
  }
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        const all = await loadReportOrders(period, { isActive: () => live });
        if (live) setOrders(all);
      } catch (e) {
        if (live) {
          setError(e.message || bippoT("تعذر تحميل التقارير"));
          setOrders(null);
        }
      } finally {
        if (live) setLoading(false);
      }
    }
    load();
    return () => {
      live = false;
    };
  }, [period, revision]);

  const [restoring, setRestoring] = useState(false);
  async function restoreOrder(order) {
    setRestoring(true);
    setError('');
    try {
      await transition(order, 'preparing');
      setOrders(current => current?.map(row => row.id === order.id ? { ...row, status: 'preparing' } : row));
    } catch (error) {
      setError(error.message);
    } finally {
      setRestoring(false);
    }
  }

  const report = React.useMemo(() => orders && summarize(orders, zone), [orders, zone]);
  const stats = report?.totals;
  const total = orders?.length ?? 0;
  const rows = orders?.slice(page * 50, page * 50 + 50) ?? [];

  function exportReport() {
    const url = URL.createObjectURL(new Blob([orderCSV(orders)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bippo-orders.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="reports analytics">
    <header className="report-controls">
      <h1>{bippoT("التحليلات")}</h1>
      <div className="report-actions">
        <label className="analytics-period"><CalendarDays size={15} /><select aria-label={bippoT("فترة التقرير")} value={days} onChange={e => selectPeriod(Number(e.target.value))}><option value={1}>{bippoT("آخر 24 ساعة")}</option><option value={7}>{bippoT("آخر 7 أيام")}</option><option value={30}>{bippoT("آخر 30 يوم")}</option><option value={90}>{bippoT("آخر 90 يوم")}</option><option value={365}>{bippoT("آخر سنة")}</option><option value={0}>{bippoT("فترة محددة / أرشيف قديم")}</option></select></label><button className="button outline small" disabled={!total || loading} onClick={exportReport}><Download size={15} />{bippoT("تصدير CSV")}</button></div></header><div className="report-actions analytics-secondary"><select aria-label={bippoT("توقيت التقرير")} value={zone} onChange={e => setZone(e.target.value)}><option value="Africa/Algiers">{bippoT("توقيت الجزائر")}</option><option value="Europe/Istanbul">{bippoT("توقيت إسطنبول")}</option><option value="UTC">UTC</option></select><button className="button outline small" onClick={refresh} disabled={loading}><RefreshCw size={15} />{bippoT(" تحديث")}</button></div>{days === 0 && <form className="custom-report-range" onSubmit={e => {
      e.preventDefault();
      const from = new Date(custom.from + 'T00:00:00Z'),
        to = new Date(Date.parse(custom.to + 'T00:00:00Z') + 86400000);
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to - from > 366 * 86400000) {
        setCustomError(bippoT("اختار فترة صحيحة، بحد أقصى 366 يوم."));
        return;
      }
      setCustomError('');
      setPage(0);
      setPeriod({
        from: from.toISOString(),
        to: to.toISOString()
      });
    }}><label>{bippoT("من تاريخ (UTC)")}<input type="date" required value={custom.from} onChange={e => setCustom({
          ...custom,
          from: e.target.value
        })} /></label><label>{bippoT("إلى تاريخ (UTC، شامل)")}<input type="date" required value={custom.to} onChange={e => setCustom({
          ...custom,
          to: e.target.value
        })} /></label><button className="button small" disabled={loading}>{bippoT("عرض الفترة")}</button>{customError && <p className="error" role="alert">{customError}</p>}</form>}{error && <p className="error" role="alert">{error}</p>}{loading && <p className="muted" role="status">{bippoT("نحمّلو التقرير…")}</p>}{stats && !loading && <><div className="report-metrics">{[
  [bippoT("الطلبات"), stats.total],
  [bippoT(clinic ? "متوسط الانتظار قبل النداء" : "متوسط التحضير"), duration(stats.avg_prep_seconds)],
  [bippoT("وقت الاستلام بعد الجاهزية"), duration(stats.avg_wait_seconds)],
  [bippoT("وصل التنبيه"), '—'],
  [bippoT("متوسط التقييم"), '—'],
  [bippoT("حوّلناهم لغوغل"), '—']
].map(([title, value]) => <article className="panel" key={title}><small>{title}</small><strong>{value}</strong></article>)}</div>
<ReportCharts report={report} period={period} zone={zone} clinic={clinic} /><p className="report-coverage">{bippoT("أوقات الجاهزية والاستلام تتسجّل من بعد التحديث فقط. الطلبات القديمة اللي ما عندهاش هاذ الأوقات تبقى في السجل، وما تدخلش في متوسط التحضير والانتظار. ما نقدّروش نخمّنولها أوقات.")}</p><article className="panel report-history"><header><div><h3>{bippoT("السجل الكامل للفترة")}</h3><p>{total}{bippoT(" طلب · الصفحة ")}{page + 1}{bippoT(" من ")}{Math.max(1, Math.ceil(total / 50))}</p></div></header><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>{bippoT("الطلب")}</th><th>{bippoT("الحالة")}</th><th>{bippoT("الإنشاء")}</th><th>{bippoT("الجاهزية")}</th><th>{bippoT("الاستلام")}</th><th>{bippoT("التحضير")}</th><th>{bippoT("انتظار الاستلام")}</th></tr></thead><tbody>{rows.map(o => <tr key={o.id}><td><b>{o.number}</b></td><td>{clinic ? ({ preparing: bippoT("في الانتظار"), ready: bippoT("تم النداء"), collected: bippoT("دخل المريض") })[o.status] || statuses[o.status] : statuses[o.status]}{o.status === 'cancelled' && <button type="button" className="button outline small report-restore"
  disabled={restoring} onClick={() => restoreOrder(o)}>{bippoT(clinic ? 'رجّع للانتظار' : 'رجّع للتحضير')}</button>}</td>{['created_at', 'ready_at', 'collected_at'].map(k => <td key={k}>{o[k] ? new Date(o[k]).toLocaleString(bippoLocale, {
                    timeZone: zone
                  }) : bippoT("غير معروف")}</td>)}<td>{duration(secondsBetween(o.created_at, o.ready_at))}</td><td>{duration(secondsBetween(o.ready_at, o.collected_at))}</td></tr>)}</tbody></table></div>{!rows.length && <p className="empty">{bippoT("ما كاش طلبات في هاذ الفترة.")}</p>}<footer className="report-pagination"><button className="button outline small" disabled={page === 0 || loading} onClick={() => setPage(v => v - 1)}><ChevronRight size={15} />{bippoT(" السابقة")}</button><span>{page + 1} / {Math.max(1, Math.ceil(total / 50))}</span><button className="button outline small" disabled={(page + 1) * 50 >= total || loading} onClick={() => setPage(v => v + 1)}>{bippoT("التالية ")}<ChevronLeft size={15} /></button></footer></article></>}</section>;
}



