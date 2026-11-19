import React, { useEffect, useState } from 'react';
import { Copy, Gift, MessageCircle } from 'lucide-react';
import { t } from './i18n.js';
import { myReferral } from './referral';
import { inviteLink } from './signupSourceRules';

// The owner's invite link for other shop owners, and what it brought so far.
export default function ReferralCard() {
  const [referral, setReferral] = useState(undefined);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    let alive = true;
    myReferral()
      .then((value) => alive && setReferral(value || null))
      .catch(() => alive && setReferral(null));
    return () => {
      alive = false;
    };
  }, []);
  if (!referral?.code) return null;
  const link = inviteLink(location.origin, referral.code);
  const message = t(
    'جرّب Bipilo لمحلك: الزبون ياخذ رقم ويتبّع دورو من تيليفونو. سجّل من هنا: {0}',
    [link],
  );
  return (
    <section className="panel billing-referral" aria-labelledby="referral-title">
      <h3 id="referral-title">
        <Gift size={18} />
        {t('ادعُ صاحب محل آخر')}
      </h3>
      <p>{t('ابعث رابطك لأصحاب المحلات اللي تعرفهم. كل محل يتسجّل منو يتحسب لك هنا.')}</p>
      <div className="billing-referral-link">
        <input
          dir="ltr"
          readOnly
          value={link}
          aria-label={t('رابط الدعوة')}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="button small outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(t('نُسخ'));
            } catch {
              setCopied(t('تعذر النسخ.'));
            }
          }}
        >
          <Copy size={15} />
          {t('نسخ الرابط')}
        </button>
        <a
          className="button small"
          href={'https://wa.me/?text=' + encodeURIComponent(message)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={15} />
          {t('ابعث في واتساب')}
        </a>
      </div>
      {copied && <small role="status">{copied}</small>}
      <dl className="billing-referral-stats">
        <div>
          <dt>{t('تسجّلو')}</dt>
          <dd>{referral.signups}</dd>
        </div>
        <div>
          <dt>{t('بداو يخدمو')}</dt>
          <dd>{referral.active}</dd>
        </div>
        <div>
          <dt>{t('خلّصو')}</dt>
          <dd>{referral.paid}</dd>
        </div>
      </dl>
      <p className="billing-referral-code">
        {t('كود الإحالة')} <code dir="ltr">{referral.code}</code>
      </p>
    </section>
  );
}
