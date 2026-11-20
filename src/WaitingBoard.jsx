import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Repeat, Volume2, VolumeX } from 'lucide-react';
import { t, language } from './i18n';
import DotNumber from './DotNumber';
import { createOrderAudio } from './orderAudio';
import { toneSource } from './alertTones';
import { newlyReady, speakCalls } from './announce';
import { boardView } from './boardRules';
import './waiting-board.css';

const soundKey = 'bipilo-board-sound';
const repeatKey = 'bipilo-board-repeat';
const FLASH_MS = 10000;
const remember = (key, on) => {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // The TV may refuse storage; the choice lasts this page.
  }
};
const recalled = (key) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

export default function WaitingBoard({ orders, error, branding }) {
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [repeat, setRepeat] = useState(() => recalled(repeatKey));
  const [flash, setFlash] = useState({});
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const player = useRef(null);
  const previousReady = useRef(null);
  const timers = useRef([]);
  const labels = new URLSearchParams(location.search);
  const clinic = labels.get('queue') === '1' || branding?.kind === 'clinic';
  const name =
    labels.get('venue')?.trim().slice(0, 100) || branding?.name?.trim().slice(0, 100) || 'Bipilo';
  const branch = labels.get('venueBranch')?.trim().slice(0, 100);
  const tone = branding?.alert_tone || 'classic';
  const logo =
    typeof branding?.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(branding.logo)
      ? branding.logo
      : '';
  const view = boardView(orders || [], { clinic, now });

  // Clock, fullscreen state and a screen that never sleeps.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    let lock = null;
    const awake = async () => {
      if (document.visibilityState !== 'visible' || !navigator.wakeLock) return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Some TVs keep the screen on by themselves.
      }
    };
    void awake();
    document.addEventListener('visibilitychange', awake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('visibilitychange', awake);
      lock?.release?.().catch?.(() => {});
      player.current?.dispose();
      timers.current.forEach(clearTimeout);
      globalThis.speechSynthesis?.cancel();
    };
  }, []);

  // A screen that had sound on gets it back; if the TV refuses, ask for one tap.
  useEffect(() => {
    if (!recalled(soundKey)) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    let probe = null;
    try {
      probe = Context ? new Context() : null;
    } catch {
      probe = null;
    }
    if (probe?.state === 'running') setSound(true);
    else setBlocked(true);
    probe?.close?.().catch?.(() => {});
  }, []);
  useEffect(() => {
    if (!blocked) return;
    const unlock = () => void enableSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [blocked]);

  useEffect(() => {
    player.current?.dispose();
    player.current = null;
  }, [tone]);

  // New calls: flash them, ring, say the number (twice when asked).
  useEffect(() => {
    if (!orders || error) return;
    const current = new Set(
      orders.filter((order) => order.status === 'ready').map((order) => order.number),
    );
    const previous = previousReady.current;
    previousReady.current = current;
    const called = newlyReady(previous, current);
    if (!called.length) return;
    const until = Date.now() + FLASH_MS;
    setFlash((value) => ({ ...value, ...Object.fromEntries(called.map((n) => [n, until])) }));
    if (!sound) return;
    const rooms = Object.fromEntries(
      orders.filter((o) => o.status === 'ready' && o.room).map((o) => [o.number, o.room]),
    );
    const announce = () => {
      player.current ??= createOrderAudio(toneSource(tone));
      player.current.loop = false;
      return player.current
        .play()
        .then(() => {
          timers.current.push(
            setTimeout(() => speakCalls(called, { lang: language, clinic, rooms }), 1300),
          );
        })
        .catch(() => {
          setSound(false);
          setBlocked(true);
        });
    };
    void announce();
    if (repeat) timers.current.push(setTimeout(announce, 9000));
  }, [orders, error, sound, clinic, repeat, tone]);

  async function enableSound() {
    // TV browsers only allow sound and speech after a tap or a remote key.
    globalThis.speechSynthesis?.getVoices();
    player.current ??= createOrderAudio(toneSource(tone));
    player.current.loop = false;
    try {
      await player.current.play();
      setSound(true);
      setBlocked(false);
      remember(soundKey, true);
    } catch {
      setBlocked(true);
    }
  }
  function toggleSound() {
    if (!sound) return void enableSound();
    player.current?.pause();
    globalThis.speechSynthesis?.cancel();
    setSound(false);
    remember(soundKey, false);
  }
  function toggleRepeat() {
    setRepeat((value) => {
      remember(repeatKey, !value);
      return !value;
    });
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Some TV browsers only support fullscreen through their own menu.
    }
  }

  const clock = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const fullscreenLabel = t(fullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة');
  const latest = view.latest;
  const fresh = latest && flash[latest.number] > now;
  return (
    <main className={'waiting-board' + (clinic ? ' clinic' : '')}>
      <header className="waiting-board-header">
        <div className="waiting-board-identity">
          {logo ? (
            <img className="waiting-board-logo" src={logo} alt="" />
          ) : (
            <span className="waiting-board-avatar" aria-hidden="true">
              {Array.from(name)[0].toUpperCase()}
            </span>
          )}
          <div>
            <h1 dir="auto">{name}</h1>
            <p>{branch || t('شاشة الانتظار')}</p>
          </div>
        </div>
        <div className="waiting-board-actions">
          {sound && (
            <button
              type="button"
              className={'waiting-board-repeat' + (repeat ? ' enabled' : '')}
              onClick={toggleRepeat}
              aria-pressed={repeat}
              title={t('النداء مرتين')}
            >
              <Repeat size={18} />
              {t('مرتين')}
            </button>
          )}
          <button
            type="button"
            className={'waiting-board-sound' + (sound ? ' enabled' : '')}
            onClick={toggleSound}
            aria-pressed={sound}
          >
            {sound ? <VolumeX size={19} /> : <Volume2 size={19} />}
            {sound ? t('إيقاف الصوت') : t('اضغط لتشغيل الصوت')}
          </button>
          {document.fullscreenEnabled && (
            <button
              type="button"
              className="waiting-board-fullscreen"
              onClick={toggleFullscreen}
              aria-label={fullscreenLabel}
              title={fullscreenLabel}
            >
              {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          )}
          <time dateTime={clock}>
            <DotNumber value={clock} />
          </time>
        </div>
      </header>
      {error && (
        <p className="waiting-board-notice" role="alert">
          {t('تعذر تحديث الشاشة. نعيد الاتصال…')}
        </p>
      )}
      {blocked && (
        <button type="button" className="waiting-board-unlock" onClick={enableSound}>
          <Volume2 size={34} aria-hidden="true" />
          {t('الصوت راه موقف. اضغط في أي بلاصة باش يرجع.')}
        </button>
      )}
      <div className="waiting-board-grid">
        <section className="waiting-board-called" aria-live="polite">
          <h2>{t(clinic ? 'تم النداء' : 'جاهز')}</h2>
          {latest ? (
            <div className={'waiting-board-latest' + (fresh ? ' fresh' : '')}>
              <small>{t(clinic ? 'الرقم المنادى' : 'آخر طلب واجد')}</small>
              <DotNumber value={latest.number} />
              {clinic && (
                <strong>
                  {latest.room ? t('تفضّل إلى {0}', [latest.room]) : t('تفضّل للاستقبال')}
                </strong>
              )}
            </div>
          ) : (
            <p className="waiting-board-empty">
              {orders
                ? t(clinic ? 'ما كاش نداء دروك.' : 'ما كاش طلب واجد دروك.')
                : t('جارٍ الاتصال…')}
            </p>
          )}
          {view.recent.length > 0 && (
            <ul className="waiting-board-recent" aria-label={t('النداءات السابقة')}>
              {view.recent.map((order) => (
                <li key={order.number} className={flash[order.number] > now ? 'fresh' : ''}>
                  <DotNumber value={order.number} />
                  {order.room && <small>{order.room}</small>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="waiting-board-waiting">
          <h2>
            {t(clinic ? 'في الانتظار' : 'قيد التحضير')}
            {view.preparing.length > 0 && <span>{view.preparing.length}</span>}
          </h2>
          {view.preparing.length ? (
            <ul className="waiting-board-numbers">
              {view.preparing.slice(0, 24).map((order) => (
                <li key={order.number}>
                  <DotNumber value={order.number} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="waiting-board-empty">
              {orders
                ? t(clinic ? 'ما كاش مريض يستنّى.' : 'ما كاش طلبات قيد التحضير.')
                : t('جارٍ الاتصال…')}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
