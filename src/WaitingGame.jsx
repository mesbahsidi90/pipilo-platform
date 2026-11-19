import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Trophy, X, ArrowUpRight, Pause, Play, RotateCcw } from 'lucide-react';
import { t as bippoT, direction } from './i18n';
import {
  newCupGame,
  startCupGame,
  moveCup,
  dropCup,
  pauseCup,
  resumeCup,
  readCupBest,
  saveCupBest,
  bestKey,
} from './cupGame';
import { gameFor, gameThemes } from './gameThemes';
import './waiting-game.css';

const readBest = (key) => {
  try {
    return readCupBest(localStorage, key);
  } catch {
    return 0;
  }
};
export default function WaitingGame({ kind }) {
  const name = gameFor(kind) || 'coffee';
  const theme = gameThemes[name];
  const key = bestKey(name);
  const [open, setOpen] = useState(false),
    [best, setBest] = useState(() => readBest(key));
  return (
    <>
      <button type="button" className="waiting-game-card" onClick={() => setOpen(true)}>
        <span className="waiting-game-icon">
          <Layers size={25} />
        </span>
        <span>
          <b>{bippoT(theme.title)}</b>
          <small>{bippoT('راك تستنّى؟ جرّب تلعب.')}</small>
        </span>
        <span className="waiting-game-best">
          <Trophy size={14} />
          {best}
        </span>
        <ArrowUpRight size={19} />
      </button>
      {open && (
        <CupGameModal
          theme={theme}
          storeKey={key}
          best={best}
          onBest={setBest}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CupGameModal({ theme, storeKey, best, onBest, onClose }) {
  const dialog = useRef(null),
    canvas = useRef(null),
    game = useRef(newCupGame()),
    lastFrame = useRef(null),
    lastDrop = useRef(0),
    reduced = useRef(false);
  const [view, setView] = useState({ phase: 'intro', score: 0, perfect: false }),
    [canvasUnavailable, setCanvasUnavailable] = useState(false);
  function sync(next) {
    game.current = next;
    setView({ phase: next.phase, score: next.score, perfect: next.perfect });
  }
  function start() {
    lastFrame.current = null;
    lastDrop.current = 0;
    sync(startCupGame(reduced.current));
  }
  function drop() {
    if (game.current.phase !== 'playing') return;
    const now = performance.now();
    if (now - lastDrop.current < 180) return;
    lastDrop.current = now;
    const next = dropCup(game.current);
    sync(next);
    if (next.score > best) {
      let score = next.score;
      try {
        score = saveCupBest(localStorage, score, storeKey);
      } catch {}
      onBest(score);
    }
  }
  function pause() {
    sync(pauseCup(game.current));
    lastFrame.current = null;
  }
  function resume() {
    lastFrame.current = null;
    sync(resumeCup(game.current));
  }
  useEffect(() => {
    const el = dialog.current,
      oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.showModal();
    const hide = () => {
      if (document.visibilityState !== 'visible') {
        game.current = pauseCup(game.current);
        lastFrame.current = null;
        setView((v) => ({ ...v, phase: game.current.phase }));
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      document.body.style.overflow = oldOverflow;
      if (el.open) el.close();
    };
  }, []);
  useEffect(() => {
    const el = canvas.current,
      ctx = el.getContext('2d');
    if (!ctx) {
      setCanvasUnavailable(true);
      return;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    el.width = 360 * ratio;
    el.height = 390 * ratio;
    ctx.scale(ratio, ratio);
    let frame = 0,
      alive = true;
    const paint = (now) => {
      if (!alive) return;
      if (document.visibilityState === 'visible') {
        const dt = lastFrame.current === null ? 0 : (now - lastFrame.current) / 1000;
        lastFrame.current = now;
        game.current = moveCup(game.current, dt);
        drawCup(ctx, game.current, theme);
        if (game.current.phase === 'playing') frame = requestAnimationFrame(paint);
      }
    };
    drawCup(ctx, game.current, theme);
    if (view.phase === 'playing') frame = requestAnimationFrame(paint);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      lastFrame.current = null;
    };
  }, [view.phase, view.score]);
  const playing = view.phase === 'playing',
    paused = view.phase === 'paused',
    over = view.phase === 'over';
  return createPortal(
    <dialog
      ref={dialog}
      className="cup-game-dialog"
      dir={direction}
      aria-labelledby="cup-game-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="cup-game-panel">
        <header className="cup-game-header">
          <span className="cup-game-brand">
            Bipilo <i /> {bippoT(theme.brand)}
          </span>
          <button
            type="button"
            className="cup-game-close"
            aria-label={bippoT('إغلاق اللعبة')}
            onClick={onClose}
            autoFocus
          >
            <X size={20} />
          </button>
        </header>
        <div className="cup-game-title">
          <span className="cup-game-kicker">{bippoT(theme.kicker)}</span>
          <h2 id="cup-game-title">{bippoT(theme.title)}</h2>
          <p>{bippoT(theme.intro)}</p>
        </div>
        <div className="cup-game-stats">
          <div>
            <span>{bippoT(theme.unit)}</span>
            <strong aria-live="polite" aria-atomic="true">
              {view.score}
            </strong>
          </div>
          <span className="cup-game-stats-line" />
          <div>
            <span>
              <Trophy size={13} /> {bippoT('أحسن نتيجة عندك')}
            </span>
            <strong>{best}</strong>
          </div>
        </div>
        <div className={'cup-game-scene ' + (playing ? 'is-playing' : '')}>
          <canvas
            ref={canvas}
            onPointerDown={(e) => {
              if (playing) {
                e.preventDefault();
                drop();
              }
            }}
            aria-hidden="true"
          />
          {playing && (
            <div className="cup-game-perfect" aria-live="polite">
              {view.perfect ? bippoT('في بلاصتها! ✨') : bippoT('اضغط كي يتقابلو')}
            </div>
          )}
          {!playing && (
            <div className="cup-game-overlay">
              <div>
                {canvasUnavailable ? (
                  <>
                    <h3>{bippoT('اللعبة غير متاحة في هذا المتصفح')}</h3>
                    <p>{bippoT('متابعة طلبك والتنبيه يبقاو يخدمو.')}</p>
                    <button className="button" onClick={onClose}>
                      {bippoT('ارجع لطلبك')}
                    </button>
                  </>
                ) : paused ? (
                  <>
                    <Pause size={27} />
                    <h3>{bippoT('نكمّلوا؟')}</h3>
                    <p>{bippoT('اللعبة موقوفة. كمّل كي تحب.')}</p>
                    <button className="button" onClick={resume}>
                      <Play size={17} />
                      {bippoT('كمّل اللعب')}
                    </button>
                  </>
                ) : over ? (
                  <>
                    <Trophy size={29} />
                    <h3>{bippoT('يعطيك الصحة!')}</h3>
                    <p>{bippoT(theme.over, [view.score])}</p>
                    <button className="button" onClick={start}>
                      <RotateCcw size={16} />
                      {bippoT('عاود العب')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="cup-game-start-badge">
                      <Layers size={20} />
                    </span>
                    <h3>{bippoT('قدّاه تقدر تطلّع؟')}</h3>
                    <p>{bippoT('الجزء اللي يخرج يتقصّ. إذا ما تلاقاوش، تنتهي الجولة.')}</p>
                    <button className="button" onClick={start}>
                      <Play size={17} />
                      {bippoT('ابدا اللعبة')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {playing && (
          <div className="cup-game-controls">
            <button type="button" className="cup-game-drop" onClick={drop}>
              {bippoT(theme.drop)}
              <Layers size={18} />
            </button>
            <button
              type="button"
              className="cup-game-pause"
              onClick={pause}
              aria-label={bippoT('وقّف اللعبة مؤقتًا')}
            >
              <Pause size={20} />
            </button>
          </div>
        )}
        <p className="cup-game-order-note">
          <span />
          {bippoT('كي يجي دورك، اللعبة تحبس وننبّهوك.')}
        </p>
        <footer className="cup-game-footer">
          {bippoT('أحسن نتيجة محفوظة في هذا الجهاز فقط. بلا حساب.')}
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}

function drawCup(ctx, g, theme) {
  const W = 360,
    H = 390,
    round = (...args) =>
      typeof ctx.roundRect === 'function' ? ctx.roundRect(...args) : ctx.rect(...args.slice(0, 4));
  ctx.clearRect(0, 0, W, H);
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, theme.sky[0]);
  gradient.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c8daca';
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 5; j++) {
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(27 + i * 61, 27 + j * 75, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.globalAlpha = 1;
  const count = g.layers.length,
    offset = Math.max(0, count - 8) * 17,
    base = (g.phase === 'intro' || g.phase === 'over' ? 175 : 315) + offset;
  drawBase(ctx, theme.base, base, round);
  const colors = theme.colors;
  function layer(x, y, width, index, moving = false) {
    const c = colors[index % colors.length];
    ctx.save();
    if (moving) {
      ctx.shadowColor = '#345b3a22';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 8;
    }
    ctx.fillStyle = c[0];
    ctx.beginPath();
    round(x, y, Math.max(3, width), 17, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (theme.layer === 'tire') {
      // A lighter sidewall stripe and tread marks.
      ctx.fillStyle = c[1];
      ctx.fillRect(x + 4, y + 7, Math.max(0, width - 8), 3);
      ctx.strokeStyle = '#1b1e21';
      ctx.lineWidth = 1;
      for (let tx = x + 8; tx < x + width - 4; tx += 9) {
        ctx.beginPath();
        ctx.moveTo(tx, y + 1);
        ctx.lineTo(tx - 3, y + 6);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = c[1];
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + 2, Math.max(1, width / 2), 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // Retain only visible geometry in the draw loop; full score remains in the model.
  for (let i = Math.max(0, count - 17); i < count; i++) {
    const l = g.layers[i];
    layer(l.x, base - 49 - i * 17, l.width, i);
  }
  if (g.phase === 'playing' || g.phase === 'paused') {
    const prev = g.layers.at(-1),
      y = base - 49 - count * 17 - 40;
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = '#6d9d7b66';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(prev.x, y + 20);
    ctx.lineTo(prev.x, base - 49 - (count - 1) * 17);
    ctx.moveTo(prev.x + prev.width, y + 20);
    ctx.lineTo(prev.x + prev.width, base - 49 - (count - 1) * 17);
    ctx.stroke();
    ctx.restore();
    layer(g.moving.x, y, g.moving.width, count, true);
  }
}

// What the pile stands on: a cup, a plate, a basket, a table or the floor.
function drawBase(ctx, kind, base, round) {
  ctx.fillStyle = '#00000014';
  ctx.beginPath();
  ctx.ellipse(181, base + 30, 118, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'cup') {
    ctx.fillStyle = '#fffdf5';
    ctx.beginPath();
    ctx.ellipse(178, base + 23, 110, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#175248';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.ellipse(269, base - 17, 22, 23, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = '#125e51';
    ctx.beginPath();
    round(87, base - 47, 186, 67, [4, 4, 24, 24]);
    ctx.fill();
    label(ctx, base, '#d9edcf');
  } else if (kind === 'plate') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(180, base - 25, 140, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e6d9c6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(180, base - 27, 110, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'basket') {
    ctx.fillStyle = '#c99a5b';
    ctx.beginPath();
    ctx.moveTo(70, base - 47);
    ctx.lineTo(290, base - 47);
    ctx.lineTo(270, base + 20);
    ctx.lineTo(90, base + 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a97a40';
    ctx.lineWidth = 2;
    for (let y = base - 35; y < base + 18; y += 11) {
      ctx.beginPath();
      ctx.moveTo(78, y);
      ctx.lineTo(282, y);
      ctx.stroke();
    }
    label(ctx, base, '#fff4e0');
  } else if (kind === 'table') {
    ctx.fillStyle = '#8b5e3c';
    ctx.beginPath();
    round(40, base - 47, 280, 16, 4);
    ctx.fill();
    ctx.fillRect(70, base - 31, 12, 55);
    ctx.fillRect(278, base - 31, 12, 55);
  } else {
    ctx.fillStyle = '#9aa7b1';
    ctx.beginPath();
    round(60, base - 47, 240, 60, [6, 6, 14, 14]);
    ctx.fill();
    ctx.fillStyle = '#b8c3cb';
    ctx.fillRect(60, base - 47, 240, 8);
    label(ctx, base, '#eef2f5');
  }
}

function label(ctx, base, color) {
  ctx.fillStyle = color;
  ctx.font = 'bold 17px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Bipilo', 180, base - 5);
}
