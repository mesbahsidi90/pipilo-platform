import { language, translate } from './i18n.js';
import React from 'react';
import { Gift, Check } from 'lucide-react';
import './loyalty-card.css';

// Customer's stamp card under the order. `card` comes from loyalty_card().
export default function LoyaltyCard({ card, lang = language }) {
  if (!card) return null;
  const t = (text, values) => translate(text, lang, values);
  const reward = (lang === 'fr' && card.reward_fr) || card.reward || t('مكافأة من المحل');
  const left = Math.max(0, card.goal - card.stamps);
  return (
    <section
      className={'loyalty-card' + (card.complete ? ' loyalty-complete' : '')}
      aria-label={t('بطاقة الولاء')}
    >
      <header>
        <Gift size={20} aria-hidden="true" />
        <h2>{t('بطاقة الولاء')}</h2>
        <span dir="ltr">
          {card.stamps}/{card.goal}
        </span>
      </header>
      <ol className="loyalty-stamps" aria-label={t('{0} أختام من {1}', [card.stamps, card.goal])}>
        {Array.from({ length: card.goal }, (_, i) => (
          <li key={i} className={i < card.stamps ? 'on' : ''}>
            {i < card.stamps ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
      {card.redeemed ? (
        <p role="status">{t('تصرفت مكافأتك على هذا الطلب. بالصحة!')}</p>
      ) : card.complete ? (
        <p role="status">
          <b>{t('مكافأتك جاهزة: {0}', [reward])}</b>
          {t('ورّي هذي البطاقة للكاشير قبل ما تخلّص.')}
        </p>
      ) : (
        <p>
          {left === 1
            ? t('باقي طلب واحد على: {0}', [reward])
            : t('باقي {0} طلبات على: {1}', [left, reward])}
          {card.stamped && <small>{t('هذا الطلب ختم بطاقتك ✓')}</small>}
        </p>
      )}
    </section>
  );
}
