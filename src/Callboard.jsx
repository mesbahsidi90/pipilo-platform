import { t as bippoT } from './i18n.js';
import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import DotNumber from './DotNumber';
import './callboard.css';

// 9×9 dot pictograms in Bipilo's dot-matrix style.
const glyphs = {
  scan: [
    '111000111',
    '101000101',
    '111000111',
    '000010000',
    '001111100',
    '000010000',
    '111000101',
    '101000010',
    '111000101',
  ],
  bell: [
    '000010000',
    '000111000',
    '001111100',
    '001111100',
    '001111100',
    '011111110',
    '111111111',
    '000000000',
    '000111000',
  ],
  board: [
    '111111111',
    '100000001',
    '101101101',
    '101101101',
    '100000001',
    '101101101',
    '111111111',
    '000010000',
    '001111100',
  ],
  queue: [
    '110111111',
    '000000000',
    '110111110',
    '000000000',
    '110111100',
    '000000000',
    '110111111',
    '000000000',
    '110111000',
  ],
};

export function DotGlyph({ name, className = '' }) {
  const rows = glyphs[name];
  return (
    <svg className={'dot-glyph ' + className} viewBox="0 0 9 9" aria-hidden="true">
      {rows.flatMap((row, y) =>
        row
          .split('')
          .map((on, x) => (
            <circle
              key={`${x}-${y}`}
              cx={x + 0.5}
              cy={y + 0.5}
              r=".38"
              fill="currentColor"
              opacity={on === '1' ? 1 : 0.13}
            />
          )),
      )}
    </svg>
  );
}

const queue = ['58', '61', '63', '64', '66', '70', '71', '73'];
const prefersStill = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Illustrative pickup board: every few seconds the oldest "preparing" number is called.
function Board() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (prefersStill()) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % queue.length), 2600);
    return () => clearInterval(timer);
  }, []);
  const loop = ['57', ...queue, '57', ...queue];
  const ready = loop.slice(step, step + 3).reverse();
  const preparing = loop.slice(step + 3, step + 7);
  const calling = ready[0];
  return (
    <div className="callboard" role="img" aria-label={bippoT('شاشة نداء توضيحية في المحل')}>
      <div className="callboard-head">
        <span className="callboard-live" aria-hidden="true" />
        {bippoT('شاشة المحل')}
        <span className="callboard-shop">{bippoT('البسطة')}</span>
      </div>
      <div className="callboard-cols">
        <section className="callboard-ready">
          <h3>{bippoT('جاهز · تفضّل')}</h3>
          <div key={calling} className="callboard-call">
            <DotNumber value={calling} />
          </div>
          <div className="callboard-list">
            {ready.slice(1).map((n) => (
              <DotNumber key={n} value={n} />
            ))}
          </div>
        </section>
        <section className="callboard-prep">
          <h3>{bippoT('راه يتحضّر')}</h3>
          <div className="callboard-list">
            {preparing.map((n, i) => (
              <DotNumber key={n + i} value={n} />
            ))}
          </div>
        </section>
      </div>
      <p className="callboard-note">{bippoT('أرقام توضيحية')}</p>
    </div>
  );
}

export function CallboardHero({ onTry }) {
  return (
    <section className="callboard-hero wrap">
      <div className="callboard-hero-panel">
        <div className="callboard-copy">
          <span className="callboard-kicker">
            {bippoT('للمطاعم، المقاهي، والمحلات اللي فيها طابور')}
          </span>
          <h1>
            {bippoT('تليفون زبونك')}
            <br />
            <em>{bippoT('هو الـ bipeur.')}</em>
          </h1>
          <p>
            {bippoT(
              'يمسح الكود، يقعد على راحتو، وتليفونو يصوني كي يوجد طلبو. بلا تطبيق، بلا حساب، وبلا bipeur.',
            )}
          </p>
          <div className="callboard-actions">
            <a className="button callboard-primary" href="/signup">
              {bippoT('ابدا مجانًا')}
            </a>
            <a className="callboard-secondary" href="#try" onClick={onTry}>
              {bippoT('جرّب كيفاش يصوني تليفونك ')}
              <ArrowLeft size={17} />
            </a>
          </div>
          <ul className="callboard-facts">
            <li>
              <b>0</b>
              {bippoT('تطبيق للتحميل')}
            </li>
            <li>
              <b>2</b>
              {bippoT('دقايق للإعداد')}
            </li>
            <li>
              <b>0</b>
              {bippoT('bipeur')}
            </li>
          </ul>
        </div>
        <Board />
      </div>
      <p className="callboard-footnote">
        {bippoT(
          '* باش يصوني والشاشة مقفولة، يلزم جهاز يدعمها وإذن الإشعارات. على iPhone زيد الصفحة للشاشة الرئيسية.',
        )}
      </p>
    </section>
  );
}

const moments = [
  {
    glyph: 'scan',
    tone: 'teal',
    title: bippoT('يمسح ويتابع'),
    text: bippoT('QR لكل تيكي ولا QR ثابت في الكونتوار. صفحة الطلب تتحلّ في المتصفح مباشرة.'),
    tag: bippoT('بلا تطبيق'),
  },
  {
    glyph: 'bell',
    tone: 'apricot',
    title: bippoT('يصوني كي يوجد'),
    text: bippoT(
      'تضغط «جاهز» وتليفون الزبون يصوني ويهتز، حتى والشاشة مقفولة على الأجهزة المدعومة.',
    ),
    tag: bippoT('في كل الباقات'),
  },
  {
    glyph: 'board',
    tone: 'mint',
    title: bippoT('شاشة النداء'),
    text: bippoT('اعرض النمرات الجاهزة في تلفاز المحل، كبار وواضحين حتى من بعيد.'),
    tag: bippoT('من المتصفح'),
  },
  {
    glyph: 'queue',
    tone: 'ink',
    title: bippoT('لكل خدمة طابورها'),
    text: bippoT('مطاعم، مغاسل، خياطين وعيادات: كل نشاط يتبع الانتظار بالطريقة اللي تناسبو.'),
    tag: bippoT('8 أنشطة'),
  },
];

export function Moments() {
  return (
    <section className="moments wrap" aria-label={bippoT('واش يدير Bipilo')}>
      {moments.map((m) => (
        <article key={m.glyph} className={'moment moment-' + m.tone}>
          <div className="moment-leds" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <DotGlyph name={m.glyph} />
          <h3>{m.title}</h3>
          <p>{m.text}</p>
          <span className="moment-tag">{m.tag}</span>
        </article>
      ))}
    </section>
  );
}
