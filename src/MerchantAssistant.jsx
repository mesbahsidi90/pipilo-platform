import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { language, locale, t } from './i18n';
import { assistantIntent, busiestHours, summarizeFeedback } from './assistantInsights';
import { loadReportOrders } from './reportOrders';
import { branchOrderFeedback } from './guestApi';
import { duration, summarize } from './reporting';
import './merchant-assistant.css';

const copy = (ar, fr) => (language === 'fr' ? fr : ar);
const suggestions = {
  qr: copy('كيفاش نطبع QR؟', 'Comment imprimer le QR ?'),
  peak: copy(
    'وقتاش كانت الزحمة آخر 7 أيام؟',
    'Quelles sont les heures de pointe des 7 derniers jours ?',
  ),
  prep: copy(
    'قدّاش متوسط التحضير آخر 7 أيام؟',
    'Quel est le temps de préparation moyen sur 7 jours ?',
  ),
  feedback: copy('واش تكرر في ملاحظات الزبائن؟', 'Quels sujets reviennent dans les commentaires ?'),
};
const topicNames = {
  wait: copy('الانتظار', 'Attente'),
  service: copy('الاستقبال والخدمة', 'Accueil et service'),
  quality: copy('الجودة والذوق', 'Qualité et goût'),
  alerts: copy('التنبيهات', 'Notifications'),
};
const algeria = 'Africa/Algiers';
const dateLabel = new Intl.DateTimeFormat(locale, {
  timeZone: algeria,
  dateStyle: 'medium',
  timeStyle: 'short',
});
const hour = (value) => String(value % 24).padStart(2, '0') + ':00';

export default function MerchantAssistant({
  shop,
  insightsEnabled,
  feedbackEnabled,
  clinic,
  navigate,
}) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function answer(intent) {
    if (intent === 'qr') {
      const instructions = clinic
        ? copy(
            'افتح «الفروع والأكواد» واضغط «طباعة ملصق الكونتوار». حطّه عند الاستقبال، والمريض يمسحو باش ياخذ رقم دور.',
            'Ouvrez « Succursales et codes » et imprimez l’affiche. Placez-la à l’accueil pour que le patient puisse prendre un numéro.',
          )
        : shop?.tracking_mode === 'counter'
          ? copy(
              'افتح «الفروع والأكواد» واطبع ملصق الكونتوار. سجّل طلب واحد، خليه يمسح QR، ومن بعد زيد الطلب التالي.',
              'Ouvrez « Succursales et codes » et imprimez l’affiche. Enregistrez une commande, faites scanner le QR fixe, puis ajoutez la suivante.',
            )
          : copy(
              'باش تطبع QR خاص بتيكي، افتح الطلب من اللوحة واضغط «طباعة التيكي». إذا حبيت ملصق واحد للفرع، فعّل QR الثابت من إعدادات الفرع.',
              'Pour imprimer le QR d’un ticket, ouvrez la commande et imprimez le ticket. Pour une affiche commune, activez le QR fixe dans les réglages de la succursale.',
            );
      return { text: instructions, action: 'codes' };
    }
    if (intent === 'feedback') {
      if (!feedbackEnabled)
        return {
          text: copy(
            'ملخّص الملاحظات متاح لصاحب الفرع الاحترافي.',
            'La synthèse des commentaires est réservée au propriétaire d’une succursale Pro.',
          ),
        };
      const notes = await branchOrderFeedback();
      if (!notes.length)
        return {
          text: copy(
            'ما كاش ملاحظات خاصة مسجّلة لهذا الفرع.',
            'Cette succursale n’a reçu aucun commentaire privé.',
          ),
          action: 'feedback',
        };
      const topics = summarizeFeedback(notes);
      const detail = topics
        .slice(0, 3)
        .map(({ topic, count }) => `${topicNames[topic]} (${count})`)
        .join(' · ');
      return {
        text: detail
          ? copy(
              `في آخر ${notes.length} ملاحظة، الكلمات المتكررة ترتبط بـ ${detail}. الملاحظة تقدر تدخل في أكثر من موضوع.`,
              `Sur les ${notes.length} derniers commentaires, les sujets repérés sont ${detail}. Un commentaire peut relever de plusieurs sujets.`,
            )
          : copy(
              `في آخر ${notes.length} ملاحظة، ما بان حتى موضوع من التصنيفات المتاحة.`,
              `Les ${notes.length} derniers commentaires ne correspondent à aucun des sujets suivis.`,
            ),
        action: 'feedback',
      };
    }
    if (intent === 'peak' || intent === 'prep') {
      if (!insightsEnabled)
        return {
          text: copy(
            'تحليل طلبات الفرع متاح في الاحترافية.',
            'L’analyse des commandes est disponible avec Pro.',
          ),
        };
      const now = Date.now();
      const period = {
        from: new Date(now - 7 * 86400000).toISOString(),
        to: new Date(now).toISOString(),
      };
      const orders = await loadReportOrders(period, {
        branch: shop?.shop_id,
        isActive: () => mounted.current,
      });
      const report = summarize(orders, algeria);
      const scope = copy(
        `من ${dateLabel.format(new Date(period.from))} إلى ${dateLabel.format(new Date(period.to))}، بتوقيت الجزائر.`,
        `Du ${dateLabel.format(new Date(period.from))} au ${dateLabel.format(new Date(period.to))}, heure d’Alger.`,
      );
      let text;
      if (intent === 'prep') {
        const { avg_prep_seconds: average, prep_samples: samples } = report.totals;
        text = samples
          ? copy(
              `المتوسط ${duration(average)}، محسوب من ${samples} تيكي فيه وقت الإنشاء والجاهزية.`,
              `Moyenne de ${duration(average)} sur ${samples} tickets ayant une heure de création et de mise à disposition.`,
            )
          : copy(
              'ما كاش تيكي فيه وقت الإنشاء والجاهزية في هاذ الفترة.',
              'Aucun ticket n’a les deux horaires nécessaires sur cette période.',
            );
      } else {
        const peak = busiestHours(report.hours);
        const slots = peak.hours.map((value) => `${hour(value)}–${hour(value + 1)}`).join(' · ');
        text = peak.count
          ? copy(
              `أكثر فترات تسجيل التيكيات كانت ${slots}، بـ ${peak.count} تيكي في كل فترة من أصل ${orders.length} في الأسبوع.`,
              `Créneaux les plus chargés : ${slots}, avec ${peak.count} tickets par créneau sur ${orders.length} au total.`,
            )
          : copy('ما تسجّل حتى تيكي في هاذ الفترة.', 'Aucun ticket enregistré sur cette période.');
      }
      return { text, scope, action: 'reports', period };
    }
    return {
      text: copy(
        'نقدر نعاونك في طباعة QR، ساعات الذروة، متوسط التحضير أو ملاحظات الزبائن. جرّب سؤال من الخيارات تحت.',
        'Je peux vous aider avec le QR, les heures de pointe, le temps moyen et les commentaires. Essayez une des questions proposées.',
      ),
    };
  }

  async function ask(value, intent = assistantIntent(value)) {
    const text = value.trim();
    if (!text || busy) return;
    setQuestion('');
    setBusy(true);
    let result;
    try {
      result = await answer(intent);
    } catch {
      result = {
        text: copy(
          'تعذّر تحميل بيانات الفرع. عاود المحاولة.',
          'Impossible de charger les données de la succursale. Réessayez.',
        ),
      };
    }
    if (!mounted.current) return;
    setMessages((current) => [...current.slice(-7), { question: text, ...result }]);
    setBusy(false);
  }

  const actionLabels = {
    codes: t('الفروع والأكواد'),
    reports: t('التحليلات'),
    feedback: t('ملاحظات الزبائن'),
  };
  return (
    <section className="panel merchant-assistant">
      <div className="assistant-intro">
        <Sparkles size={20} />
        <p>
          {copy(
            'اسقسي على إعداد الفرع أو على أرقام خدمتك.',
            'Posez une question sur la configuration ou les chiffres de votre succursale.',
          )}{' '}
          {shop?.name && <b>{shop.name}</b>}
        </p>
      </div>
      {messages.length > 0 && (
        <ol className="assistant-messages" aria-live="polite">
          {messages.map((item, index) => (
            <li key={index}>
              <p className="assistant-question" dir="auto">
                {item.question}
              </p>
              <div className="assistant-answer">
                <p>{item.text}</p>
                {item.scope && <small>{item.scope}</small>}
                {item.action && (
                  <button
                    className="button outline small"
                    type="button"
                    onClick={() => navigate(item.action, item.period)}
                  >
                    {actionLabels[item.action]}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {busy && <p role="status">{copy('نحمّل بيانات الفرع…', 'Chargement des données…')}</p>}
      <div className="assistant-suggestions">
        {Object.entries(suggestions).map(([intent, label]) => (
          <button
            key={intent}
            type="button"
            className="button outline small"
            disabled={busy || !shop}
            onClick={() => ask(label, intent)}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          dir="auto"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={250}
          aria-label={copy('سؤالك للمساعد', 'Votre question')}
          placeholder={copy('اكتب سؤالك…', 'Écrivez votre question…')}
        />
        <button
          className="button"
          disabled={busy || !shop || !question.trim()}
          type="submit"
          aria-label={copy('أرسل السؤال', 'Envoyer la question')}
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </section>
  );
}
