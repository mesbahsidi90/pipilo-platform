import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import { t } from './i18n';
import DotNumber from './DotNumber';
import { createOrderAudio } from './orderAudio';
import { toneSource } from './alertTones';
import './waiting-board.css';

function BoardColumn({ title, orders, ready, empty }) {
  return <section className={'waiting-board-column' + (ready ? ' waiting-board-ready' : '')}>
    <h2>{title}</h2>
    {orders.length ? <ul className="waiting-board-numbers" aria-label={title}>
      {orders.map(order => <li key={order.number}><DotNumber value={order.number} /></li>)}
    </ul> : <p>{empty}</p>}
  </section>;
}

export default function WaitingBoard({ orders, error }) {
  const [now, setNow] = useState(() => new Date());
  const [sound, setSound] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const player = useRef(null);
  const previousReady = useRef(null);
  const labels = new URLSearchParams(location.search);
  const clinic = labels.get('queue') === '1';
  const name = labels.get('venue')?.trim().slice(0, 100) || 'Bipilo';
  const branch = labels.get('venueBranch')?.trim().slice(0, 100);
  const ready = orders?.filter(order => order.status === 'ready') ?? [];
  const preparing = orders?.filter(order => order.status === 'preparing') ?? [];

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => {
      clearInterval(timer);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      player.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!orders || error) return;
    const current = new Set(orders.filter(order => order.status === 'ready').map(order => order.number));
    const previous = previousReady.current;
    previousReady.current = current;
    if (sound && previous && [...current].some(number => !previous.has(number))) {
      player.current?.play().catch(() => {
        setSound(false);
        setSoundError(true);
      });
    }
  }, [orders, error, sound]);

  async function toggleSound() {
    if (sound) {
      player.current?.pause();
      setSound(false);
      return;
    }
    setSoundError(false);
    player.current ??= createOrderAudio(toneSource('classic'));
    player.current.loop = false;
    try {
      await player.current.play();
      setSound(true);
    } catch {
      setSoundError(true);
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Some TV browsers only support fullscreen through their own menu.
    }
  }

  const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const fullscreenLabel = t(fullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة');
  return <main className="waiting-board">
    <header className="waiting-board-header">
      <div className="waiting-board-identity">
        <span className="waiting-board-avatar" aria-hidden="true">{Array.from(name)[0].toUpperCase()}</span>
        <div><h1 dir="auto">{name}</h1><p>{branch || t('شاشة الانتظار')}</p></div>
      </div>
      <div className="waiting-board-actions">
        <button type="button" className={'waiting-board-sound' + (sound ? ' enabled' : '')} onClick={toggleSound} aria-pressed={sound}>
          {sound ? <VolumeX size={19} /> : <Volume2 size={19} />}
          {sound ? t('إيقاف الصوت') : t('اضغط لتشغيل الصوت')}
        </button>
        {document.fullscreenEnabled && <button type="button" className="waiting-board-fullscreen" onClick={toggleFullscreen}
          aria-label={fullscreenLabel} title={fullscreenLabel}>{fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>}
        <time dateTime={clock}><DotNumber value={clock} /></time>
      </div>
    </header>
    {error && <p className="waiting-board-notice" role="alert">{t('تعذر تحديث الشاشة. نعيد الاتصال…')}</p>}
    {soundError && <p className="waiting-board-notice" role="status">{t('تعذر تشغيل الصوت. عاود المحاولة.')}</p>}
    <div className="waiting-board-grid">
      <BoardColumn title={t(clinic ? 'في الانتظار' : 'قيد التحضير')} orders={preparing} empty={orders ? t(clinic ? 'ما كاش مريض يستنّى.' : 'ما كاش طلبات قيد التحضير.') : t('جارٍ الاتصال…')} />
      <BoardColumn title={t(clinic ? 'تم النداء' : 'جاهز')} orders={ready} ready empty={orders ? t(clinic ? 'أول رقم يتم نداؤه يبان هنا.' : 'أول طلب جاهز يبان هنا.') : t('جارٍ الاتصال…')} />
    </div>
  </main>;
}
