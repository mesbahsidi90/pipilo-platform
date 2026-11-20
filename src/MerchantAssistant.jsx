import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Copy, MessageCircle, Sparkles } from 'lucide-react';
import { locale, t, ticketLink } from './i18n';
import {
  busiestHours,
  change,
  parseMenuText,
  readQuestion,
  summarizeFeedback,
  todaySummary,
} from './assistantInsights';
import { loadReportOrders } from './reportOrders';
import { branchOrderFeedback } from './guestApi';
import { duration, summarize } from './reporting';
import { getSettings, saveSettings } from './shopSettings';
import { shopActivity } from './shopActivities';
import { gameFor } from './gameThemes';
import { LOYALTY_GOALS } from './loyaltyRules';
import { reviewUrl } from './guestExperience';
import { addItem, addSection } from './menu';
import { workspaceAction } from './MerchantTeam';
import { setQueuePaused } from './ClinicQueue';
import { cloud } from './store';
import './merchant-assistant.css';

const algeria = 'Africa/Algiers';
const dayMs = 86400000;
const hour = (value) => String(value % 24).padStart(2, '0') + ':00';
const weekday = new Intl.DateTimeFormat(locale, { timeZone: algeria, weekday: 'long' });

// Words shown for each feature (Arabic keys, translated with t()).
const featureNames = {
  menu: 'المنيو الإلكتروني',
  ordering: 'الطلب من التليفون',
  loyalty: 'بطاقة الولاء',
  game: 'لعبة الانتظار',
  feedback: 'الملاحظات الخاصة',
};
const proFeatures = new Set(['ordering', 'loyalty', 'feedback']);
const featureOn = (settings, feature) =>
  ({
    menu: settings.menu_enabled,
    ordering: settings.ordering_enabled,
    loyalty: settings.loyalty_enabled,
    game: settings.customer_options?.game !== false,
    feedback: settings.private_feedback_enabled,
  })[feature];
function featurePatch(settings, feature, on) {
  if (feature === 'menu')
    return on ? { menu_enabled: true } : { menu_enabled: false, ordering_enabled: false };
  if (feature === 'ordering')
    return on ? { ordering_enabled: true, menu_enabled: true } : { ordering_enabled: false };
  if (feature === 'loyalty') return { loyalty_enabled: on };
  if (feature === 'game')
    return { customer_options: { ...(settings.customer_options || {}), game: on } };
  return { private_feedback_enabled: on };
}

const pct = (value) => (value > 0 ? '+' + value + '%' : value + '%');
function compareText(now, before, label) {
  const delta = change(now, before);
  return delta === null ? null : t('{0} مقارنة بـ{1}', [pct(delta), t(label)]);
}

export default function MerchantAssistant({
  shop,
  insightsEnabled,
  feedbackEnabled,
  clinic,
  navigate,
  canManage = true,
  paid = true,
  onSaved,
}) {
  const [settings, setSettings] = useState(shop || null);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const end = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (shop) setSettings((current) => ({ ...current, ...shop }));
  }, [shop]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [messages.length]);

  const activity = shopActivity(settings?.kind);
  const hasGame = Boolean(gameFor(settings?.kind));
  const available = (feature) =>
    feature === 'menu' || feature === 'ordering'
      ? activity.menu
      : feature === 'loyalty'
        ? activity.loyalty
        : feature === 'game'
          ? hasGame
          : true;

  async function saveShop(patch) {
    const current = settings?.shop_id ? settings : await getSettings();
    const saved = await saveSettings({ ...current, ...patch });
    const next = { ...current, ...saved };
    if (mounted.current) setSettings(next);
    onSaved?.(next);
    return next;
  }

  async function ordersSince(days) {
    const now = Date.now();
    return loadReportOrders(
      { from: new Date(now - days * dayMs).toISOString(), to: new Date(now + 60000).toISOString() },
      { branch: settings?.shop_id, isActive: () => mounted.current },
    );
  }

  async function answer({ intent, feature, on }) {
    if (intent === 'today') {
      const rows = await ordersSince(8);
      const s = todaySummary(rows);
      const lines = [
        [
          t(clinic ? 'المرضى اليوم' : 'التيكيات اليوم'),
          String(s.today.count),
          compareText(s.today.count, s.yesterday.count, 'البارح في نفس الوقت'),
        ],
        [t(clinic ? 'يستنّاو دروك' : 'يتحضّرو دروك'), String(s.waiting)],
        ...(s.ready
          ? [[t(clinic ? 'تنادو وما دخلوش' : 'واجدين وما تسلّموش'), String(s.ready)]]
          : []),
        ...(s.today.avgPrep != null
          ? [[t(clinic ? 'متوسط الانتظار قبل النداء' : 'متوسط التحضير'), duration(s.today.avgPrep)]]
          : []),
        ...(s.peak
          ? [
              [
                t('أكثر ساعة'),
                `${hour(s.peak.hour)}–${hour(s.peak.hour + 1)}`,
                t('{0} تيكي', [s.peak.count]),
              ],
            ]
          : []),
      ];
      const week = compareText(s.today.count, s.lastWeek.count, 'نفس النهار الأسبوع اللي فات');
      return {
        text: s.today.count
          ? t('هذا واش صرا اليوم لحدّ دروك:')
          : t('مازال ما تسجّل حتى تيكي اليوم.'),
        lines: s.today.count ? lines : [],
        scope: week,
        action: insightsEnabled ? { tab: 'reports', label: t('التحليلات') } : null,
      };
    }
    if (intent === 'week') {
      const rows = await ordersSince(insightsEnabled ? 14 : 7);
      const cut = Date.now() - 7 * dayMs;
      const thisWeek = rows.filter((row) => Date.parse(row.created_at) >= cut);
      const lastWeek = rows.filter((row) => Date.parse(row.created_at) < cut);
      const report = summarize(thisWeek, algeria);
      const best = [...report.days].sort((a, b) => b.count - a.count)[0];
      const lines = [
        [
          t('تيكيات آخر 7 أيام'),
          String(thisWeek.length),
          insightsEnabled
            ? compareText(thisWeek.length, lastWeek.length, 'الأسبوع اللي قبلو')
            : null,
        ],
        ...(best
          ? [
              [
                t('أحسن نهار'),
                weekday.format(new Date(best.day + 'T12:00:00Z')),
                t('{0} تيكي', [best.count]),
              ],
            ]
          : []),
        ...(report.totals.avg_prep_seconds != null
          ? [
              [
                t(clinic ? 'متوسط الانتظار قبل النداء' : 'متوسط التحضير'),
                duration(report.totals.avg_prep_seconds),
              ],
            ]
          : []),
      ];
      return {
        text: thisWeek.length ? t('آخر 7 أيام:') : t('ما تسجّل حتى تيكي في آخر 7 أيام.'),
        lines: thisWeek.length ? lines : [],
        action: insightsEnabled ? { tab: 'reports', label: t('التحليلات') } : null,
      };
    }
    if (intent === 'peak' || intent === 'prep') {
      if (!insightsEnabled)
        return {
          text: t('تحليل الساعات والمدة متاح في الاحترافية. «كيف اليوم؟» متاحة للكل.'),
          action: canManage ? { tab: 'billing', label: t('الاشتراك') } : null,
        };
      const rows = await ordersSince(7);
      const report = summarize(rows, algeria);
      if (intent === 'prep') {
        const { avg_prep_seconds: average, prep_samples: samples } = report.totals;
        return {
          text: samples
            ? t('المتوسط آخر 7 أيام {0}، محسوب من {1} تيكي.', [duration(average), samples])
            : t('ما كاش تيكي فيه وقت الإنشاء والجاهزية في آخر 7 أيام.'),
          action: { tab: 'reports', label: t('التحليلات') },
        };
      }
      const peak = busiestHours(report.hours);
      const slots = peak.hours.map((value) => `${hour(value)}–${hour(value + 1)}`).join(' · ');
      return {
        text: peak.count
          ? t('أكثر ساعات الزحمة آخر 7 أيام: {0}، بـ {1} تيكي في الساعة.', [slots, peak.count])
          : t('ما تسجّل حتى تيكي في آخر 7 أيام.'),
        action: { tab: 'reports', label: t('التحليلات') },
      };
    }
    if (intent === 'feedback') {
      if (!feedbackEnabled) return { text: t('ملخّص الملاحظات متاح لصاحب الفرع الاحترافي.') };
      const notes = await branchOrderFeedback();
      if (!notes.length)
        return {
          text: t('ما كاش ملاحظات خاصة مسجّلة لهذا الفرع.'),
          action: { tab: 'feedback', label: t('ملاحظات الزبائن') },
        };
      const topics = summarizeFeedback(notes);
      const names = {
        wait: 'الانتظار',
        service: 'الاستقبال والخدمة',
        quality: 'الجودة والذوق',
        alerts: 'التنبيهات',
      };
      return {
        text: topics.length
          ? t('في آخر {0} ملاحظة، المواضيع اللي تتعاود:', [notes.length])
          : t('في آخر {0} ملاحظة، ما بان حتى موضوع يتعاود.', [notes.length]),
        lines: topics.slice(0, 4).map(({ topic, count }) => [t(names[topic]), String(count)]),
        action: { tab: 'feedback', label: t('ملاحظات الزبائن') },
      };
    }
    if (intent === 'qr')
      return {
        text: clinic
          ? t('افتح «الفروع والأكواد» واطبع ملصق الاستقبال. المريض يسكانيه ياخذ رقم دور.')
          : settings?.tracking_mode === 'counter'
            ? t(
                'افتح «الفروع والأكواد» واطبع ملصق الكونتوار. سجّل طلب، خليه يسكاني، ومن بعد زيد اللي بعدو.',
              )
            : t(
                'كل تيكي عندو QR تاعو: افتح الطلب واطبعو. إذا تحب ملصق واحد للفرع، بدّل طريقة المتابعة في «الإعدادات».',
              ),
        action: { tab: 'codes', label: t('الفروع والأكواد') },
      };

    // Everything below changes the shop: owners and managers only.
    const actions = ['toggle', 'menu_text', 'staff', 'google', 'pause', 'resume', 'loyalty_setup'];
    if (actions.includes(intent) && !canManage)
      return { text: t('هذا التبديل يديرو صاحب المحل ولا المسيّر.') };
    if (intent === 'loyalty_setup')
      return answer({ intent: 'toggle', feature: 'loyalty', on: true });
    if (intent === 'toggle') {
      if (!available(feature))
        return { text: t('{0} ما يخصّش نشاط محلك.', [t(featureNames[feature])]) };
      if (on && proFeatures.has(feature) && !paid)
        return {
          text: t('{0} في الباقة الاحترافية.', [t(featureNames[feature])]),
          action: { tab: 'billing', label: t('الاشتراك') },
        };
      if (feature === 'loyalty' && on)
        return { text: t('ضبط بطاقة الولاء:'), card: { type: 'loyalty' } };
      if (Boolean(featureOn(settings || {}, feature)) === on)
        return {
          text: t(on ? '{0} مشعول من قبل.' : '{0} موقف من قبل.', [t(featureNames[feature])]),
        };
      return {
        text: t(on ? 'نشعّل {0}؟' : 'نوقّف {0}؟', [t(featureNames[feature])]),
        card: { type: 'toggle', feature, on },
      };
    }
    if (intent === 'menu_text') {
      if (!activity.menu) return { text: t('المنيو ما يخصّش نشاط محلك.') };
      return {
        text: t('الصق المنيو تاعك، صنف في كل سطر مع السعر. السطر بلا سعر يولّي اسم قسم.'),
        card: { type: 'menu' },
      };
    }
    if (intent === 'staff') {
      if (!cloud)
        return {
          text: t('دعوة الخدّام تخدم في الحساب الحقيقي برك.'),
          action: { tab: 'team', label: t('الفريق') },
        };
      return { text: t('واش اسم الخدّام؟ نعطيك رابط يدخل بيه.'), card: { type: 'staff' } };
    }
    if (intent === 'google')
      return { text: t('الصق رابط تقييم محلك في Google:'), card: { type: 'google' } };
    if (intent === 'pause' || intent === 'resume') {
      if (!clinic) return { text: t('توقيف الأرقام خاص بالعيادات.') };
      return {
        text: t(intent === 'pause' ? 'نوقّف أرقام QR لليوم؟' : 'نعاود نفتح أرقام QR؟'),
        card: { type: 'pause', on: intent === 'pause' },
      };
    }
    return {
      text: t('ما فهمتش مليح. هذا واش نقدر نديرلك:'),
      suggest: true,
    };
  }

  async function ask(value, parsed = readQuestion(value)) {
    const text = value.trim();
    if (!text || busy) return;
    setQuestion('');
    setBusy(true);
    let result;
    try {
      result = await answer(parsed);
    } catch {
      result = { text: t('تعذّر تحميل بيانات الفرع. عاود المحاولة.') };
    }
    if (!mounted.current) return;
    setMessages((current) => [...current.slice(-9), { id: Date.now(), question: text, ...result }]);
    setBusy(false);
  }

  const chips = [
    { label: t('كيف اليوم؟'), parsed: { intent: 'today' } },
    { label: t('هذا الأسبوع'), parsed: { intent: 'week' } },
    ...(canManage && activity.menu
      ? [{ label: t('ركّب المنيو'), parsed: { intent: 'menu_text' } }]
      : []),
    ...(canManage && activity.loyalty
      ? [
          settings?.loyalty_enabled
            ? {
                label: t('بدّل مكافأة الولاء'),
                parsed: { intent: 'toggle', feature: 'loyalty', on: true },
              }
            : {
                label: t('شغّل بطاقة الولاء'),
                parsed: { intent: 'toggle', feature: 'loyalty', on: true },
              },
        ]
      : []),
    ...(canManage ? [{ label: t('زيد خدّام'), parsed: { intent: 'staff' } }] : []),
    ...(canManage && clinic ? [{ label: t('وقّف الأرقام'), parsed: { intent: 'pause' } }] : []),
    ...(insightsEnabled ? [{ label: t('ساعات الزحمة'), parsed: { intent: 'peak' } }] : []),
    ...(feedbackEnabled ? [{ label: t('ملاحظات الزبائن'), parsed: { intent: 'feedback' } }] : []),
    ...(canManage && !settings?.google_review_url
      ? [{ label: t('رابط تقييم Google'), parsed: { intent: 'google' } }]
      : []),
    { label: t('كيفاش نطبع QR؟'), parsed: { intent: 'qr' } },
  ];
  const chipRow = (
    <div className="assistant-suggestions">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          className="button outline small"
          disabled={busy || !settings}
          onClick={() => ask(chip.label, chip.parsed)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
  const cardProps = { settings, saveShop, navigate, shopId: settings?.shop_id };

  return (
    <section className="panel merchant-assistant">
      <div className="assistant-intro">
        <Sparkles size={20} />
        <p>
          {t('أهلا! قولّي واش تحب نشوفلك ولا نديرلك في المحل.')}{' '}
          {settings?.name && <b>{settings.name}</b>}
        </p>
      </div>
      {messages.length > 0 && (
        <ol className="assistant-messages" aria-live="polite">
          {messages.map((item) => (
            <li key={item.id}>
              <p className="assistant-question" dir="auto">
                {item.question}
              </p>
              <div className="assistant-answer">
                <p>{item.text}</p>
                {item.lines?.length > 0 && (
                  <dl className="assistant-lines">
                    {item.lines.map(([label, value, note]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>
                          <b>{value}</b>
                          {note && <small>{note}</small>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {item.scope && <small>{item.scope}</small>}
                {item.card && <ActionCard card={item.card} {...cardProps} />}
                {item.suggest && chipRow}
                {item.action && (
                  <button
                    className="button outline small"
                    type="button"
                    onClick={() => navigate(item.action.tab, item.action.period)}
                  >
                    {item.action.label}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div ref={end} />
      {busy && <p role="status">{t('نقرا بيانات المحل…')}</p>}
      {chipRow}
      <form
        className="assistant-ask"
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
          aria-label={t('سؤالك للمساعد')}
          placeholder={t('اكتب واش تحب…')}
        />
        <button
          className="button"
          disabled={busy || !settings || !question.trim()}
          type="submit"
          aria-label={t('أرسل')}
        >
          <ArrowUp size={18} />
        </button>
      </form>
      <small className="assistant-note">
        {t('المساعد يقرا مباشرة من بيانات محلك، وما يبدّل والو قبل ما تأكّد.')}
      </small>
    </section>
  );
}

// One action, confirmed by the owner, then done for real.
function ActionCard({ card, settings, saveShop, navigate, shopId }) {
  const [state, setState] = useState('idle'); // idle | busy | done | error
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(() => ({
    goal: LOYALTY_GOALS.includes(Number(settings?.loyalty_goal))
      ? Number(settings.loyalty_goal)
      : 9,
    reward: settings?.loyalty_reward || '',
    text: '',
    name: '',
    url: settings?.google_review_url || '',
    enableMenu: true,
    link: '',
  }));
  const set = (key) => (event) =>
    setForm((value) => ({
      ...value,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));
  async function run(task, success) {
    setState('busy');
    setMessage('');
    try {
      const extra = await task();
      setState('done');
      setMessage(typeof extra === 'string' ? extra : success);
    } catch (e) {
      setState('error');
      setMessage(e?.message || t('تعذر التبديل. عاود المحاولة.'));
    }
  }
  const busy = state === 'busy';
  const done = state === 'done';
  const result = message && (
    <p
      role={state === 'error' ? 'alert' : 'status'}
      className={state === 'error' ? 'error' : 'assistant-done'}
    >
      {done && <Check size={15} />} {message}
    </p>
  );

  if (card.type === 'toggle')
    return (
      <div className="assistant-card">
        {!done && (
          <div className="assistant-card-actions">
            <button
              type="button"
              className="button small"
              disabled={busy}
              onClick={() =>
                run(
                  () => saveShop(featurePatch(settings || {}, card.feature, card.on)),
                  t(card.on ? 'تشعل {0} ✓' : 'توقف {0} ✓', [t(featureNames[card.feature])]),
                )
              }
            >
              {t(card.on ? 'شعّل' : 'وقّف')}
            </button>
          </div>
        )}
        {result}
      </div>
    );

  if (card.type === 'loyalty')
    return (
      <form
        className="assistant-card"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            () =>
              saveShop({
                loyalty_enabled: true,
                loyalty_goal: Number(form.goal),
                loyalty_reward: form.reward.trim(),
              }),
            t('بطاقة الولاء مشعولة: {0} أختام، والمكافأة «{1}» ✓', [form.goal, form.reward.trim()]),
          );
        }}
      >
        <label>
          {t('عدد الأختام')}
          <select value={form.goal} onChange={set('goal')} disabled={busy || done}>
            {LOYALTY_GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('المكافأة')}
          <input
            required
            maxLength={60}
            placeholder={t('مثلًا قهوة علينا')}
            value={form.reward}
            onChange={set('reward')}
            disabled={busy || done}
          />
        </label>
        {!done && (
          <button className="button small" disabled={busy || !form.reward.trim()}>
            {t('شغّل البطاقة')}
          </button>
        )}
        {result}
      </form>
    );

  if (card.type === 'menu') {
    const parsed = parseMenuText(form.text, t('المنيو'));
    const count = parsed.sections.reduce((total, section) => total + section.items.length, 0);
    return (
      <form
        className="assistant-card"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            for (const section of parsed.sections) {
              const id = await addSection(section.name);
              for (const item of section.items) await addItem(id, item);
            }
            if (form.enableMenu && !settings?.menu_enabled) await saveShop({ menu_enabled: true });
            return t('تزادو {0} صنف في {1} قسم ✓', [count, parsed.sections.length]);
          });
        }}
      >
        <textarea
          rows={6}
          dir="auto"
          maxLength={6000}
          placeholder={t('مشروبات:\nقهوة 80\nكابتشينو 150')}
          value={form.text}
          onChange={set('text')}
          disabled={busy || done}
        />
        {count > 0 && (
          <div className="assistant-menu-preview">
            {parsed.sections.map((section) => (
              <div key={section.name}>
                <b>{section.name}</b>
                <ul>
                  {section.items.map((item, index) => (
                    <li key={index}>
                      <span>{item.name}</span>
                      <span dir="ltr">{item.price}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {parsed.skipped.length > 0 && (
          <small>{t('{0} سطر ما فهمناهش وما يتزادش.', [parsed.skipped.length])}</small>
        )}
        {!settings?.menu_enabled && (
          <label className="assistant-check">
            <input
              type="checkbox"
              checked={form.enableMenu}
              onChange={set('enableMenu')}
              disabled={busy || done}
            />
            {t('شعّل المنيو للزبائن')}
          </label>
        )}
        {!done && (
          <button className="button small" disabled={busy || !count}>
            {count ? t('زيد {0} صنف للمنيو', [count]) : t('زيد للمنيو')}
          </button>
        )}
        {result}
        {done && (
          <button
            type="button"
            className="button outline small"
            onClick={() => navigate('features')}
          >
            {t('شوف المنيو')}
          </button>
        )}
      </form>
    );
  }

  if (card.type === 'staff')
    return (
      <form
        className="assistant-card"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            const data = await workspaceAction('invite', {
              name: form.name.trim(),
              target: shopId,
            });
            const link = ticketLink('invite/' + data.token);
            setForm((value) => ({ ...value, link }));
            return t('ابعث هذا الرابط لـ{0}، يدخل بيه للفرع.', [form.name.trim()]);
          });
        }}
      >
        <label>
          {t('اسم الخدّام')}
          <input
            required
            maxLength={60}
            value={form.name}
            onChange={set('name')}
            disabled={busy || done}
          />
        </label>
        {!done && (
          <button className="button small" disabled={busy || !form.name.trim()}>
            {t('اعطيني الرابط')}
          </button>
        )}
        {result}
        {form.link && (
          <div className="assistant-card-actions">
            <input dir="ltr" readOnly value={form.link} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="button outline small"
              onClick={() => navigator.clipboard?.writeText(form.link).catch(() => {})}
            >
              <Copy size={14} /> {t('نسخ')}
            </button>
            <a
              className="button small"
              target="_blank"
              rel="noopener noreferrer"
              href={'https://wa.me/?text=' + encodeURIComponent(form.link)}
            >
              <MessageCircle size={14} /> {t('واتساب')}
            </a>
          </div>
        )}
      </form>
    );

  if (card.type === 'google')
    return (
      <form
        className="assistant-card"
        onSubmit={(event) => {
          event.preventDefault();
          run(async () => {
            const url = reviewUrl(form.url);
            if (!url) throw new Error(t('الصق رابط Google يبدا بـ https.'));
            await saveShop({ google_review_url: url });
          }, t('تسجّل الرابط. الزبون يشوفو بعد ما يستلم ✓'));
        }}
      >
        <input
          dir="ltr"
          type="url"
          required
          placeholder="https://g.page/r/…"
          value={form.url}
          onChange={set('url')}
          disabled={busy || done}
        />
        {!done && (
          <button className="button small" disabled={busy || !form.url.trim()}>
            {t('حفظ')}
          </button>
        )}
        {result}
      </form>
    );

  if (card.type === 'pause')
    return (
      <div className="assistant-card">
        {!done && (
          <button
            type="button"
            className="button small"
            disabled={busy}
            onClick={() =>
              run(
                () => setQueuePaused(card.on),
                t(
                  card.on
                    ? 'وقّفنا الأرقام لليوم ✓ اللي عندهم رقم يكمّلو.'
                    : 'رمز QR رجع يعطي أرقام ✓',
                ),
              )
            }
          >
            {t(card.on ? 'وقّف الأرقام' : 'عاود افتح الأرقام')}
          </button>
        )}
        {result}
      </div>
    );
  return null;
}
