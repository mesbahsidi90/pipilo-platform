import React, { useState } from 'react';
import {
  BarChart3,
  BellRing,
  BookOpen,
  Building2,
  CalendarClock,
  CarFront,
  Coffee,
  Gamepad2,
  Gift,
  HeartPulse,
  KeyRound,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Monitor,
  PauseCircle,
  Plug,
  QrCode,
  Receipt,
  Repeat,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  Ticket,
  TimerReset,
  Users,
  Volume2,
  Wallet,
  Zap,
} from 'lucide-react';
import { t as bippoT } from './i18n.js';
import './activity-features.css';

// What every activity gets, shown on the landing page. Keep in sync with the
// merchant dashboard when a feature is added.
const groups = [
  {
    id: 'food',
    label: 'مطاعم ومقاهي',
    icon: Coffee,
    intro: 'من الكونتوار للطاولة: الزبون يطلب، يستنّى على راحتو، ويجي كي يوجد طلبو.',
    items: [
      [
        BookOpen,
        'المنيو الإلكتروني',
        'المنيو تاعك في تليفون الزبون، بالأسعار، وتبدّلو وقتما حبيت.',
      ],
      [
        ShoppingBag,
        'الطلب من التليفون',
        'الزبون يطلب وحدو: استلام من المحل، على الطاولة، ولا في الطوموبيل.',
      ],
      [LayoutGrid, 'أكواد الطاولات', 'كود لكل طاولة، والطلب يوصلك بنمرة الطاولة.'],
      [
        Receipt,
        'مع الكاشير اللي عندك',
        'الزبون يكتب رقم الفاتورة، ولا يمسح كود الكونتوار، ولا اربط الكاشير بالـ API.',
      ],
      [Gift, 'بطاقة الولاء', 'ختم مع كل طلب، والمكافأة اللي تختارها كي تكمل البطاقة.'],
      [
        Star,
        'التقييم بالنجوم',
        'الزبون يقيّم بعد الاستلام، وتقدر تزيد رابط تقييمات Google تاع محلك.',
      ],
      [Monitor, 'شاشة الانتظار والمطبخ', 'آخر طلب واجد يبان كبير ويبرق، بالصوت وبشعار المحل.'],
      [Gamepad2, 'لعبة الانتظار', 'لعبة صغيرة يلعبها الزبون وهو يستنّى طلبو.'],
    ],
  },
  {
    id: 'clinic',
    label: 'عيادات',
    icon: Stethoscope,
    intro: 'قاعة انتظار هادية: المريض ياخذ رقمو، يقعد ولا يخرج، ويرجع كي يقرب دورو.',
    items: [
      [
        QrCode,
        'خذ رقم دور بالـ QR',
        'المريض يمسح الكود عند الباب وياخذ رقمو وحدو، بلا ما يستنّى في الاستقبال.',
      ],
      [CalendarClock, '«قرب دورك»', 'تنبيه للمريض قبل دورو باش يقرّب للعيادة في وقتو.'],
      [
        Volume2,
        'النداء بالصوت',
        'الشاشة تقول الرقم والقاعة بالصوت: «تفضّل إلى القاعة 2»، ومرتين إذا حبيت.',
      ],
      [Building2, 'القاعات', 'كل نداء يقول للمريض وين يدخل، على الشاشة وفي تليفونو.'],
      [Zap, 'الأولوية', 'حامل، شيخ ولا حالة مستعجلة: تقدّمو في الصف بضغطة.'],
      [PauseCircle, 'إيقاف الأرقام', 'كي يكمل اليوم، وقّف أخذ الأرقام الجديدة من الـ QR.'],
      [TimerReset, 'ما جاش؟', 'علّم المريض اللي ما جاش، وترجّعو للانتظار من السجل.'],
      [MessageCircle, 'واتساب المريض', 'افتح واتساب المريض بضغطة من اللوحة.'],
    ],
  },
  {
    id: 'services',
    label: 'محلات خدمات',
    icon: Store,
    intro: 'مغسلة ملابس، غسيل سيارات، خياط: الزبون يخلّي خدمتو ويروح، وتليفونو يعيطلو كي توجد.',
    items: [
      [
        Ticket,
        'تيكي لكل خدمة',
        'الزبون ياخذ تيكي بالـ QR ولا برقم الفاتورة، ويتبع خدمتو من تليفونو.',
      ],
      [CarFront, 'يروح ويرجع', 'ما يلزموش يقعد في المحل: يرجع كي يصوني تليفونو.'],
      [BellRing, 'رنة وقت الجاهزية', 'كي تعلّم الخدمة «جاهزة»، تليفون الزبون يرنّ.'],
      [Gamepad2, 'لعبة على حساب نشاطك', 'كل نشاط عندو لعبتو وكلامو وهو يستنّى.'],
    ],
  },
  {
    id: 'all',
    label: 'لكل المحلات',
    icon: Sparkles,
    intro: 'هاذو يخدمو مع كل نشاط، من أول نهار.',
    items: [
      [
        Repeat,
        'بيبيلو مرة تانية',
        'الزبون ما جاش؟ رنّ تليفونو مرة تانية بضغطة، وBipilo يعاود وحدو بعد دقيقة.',
      ],
      [
        Smartphone,
        'iPhone وAndroid',
        'بلا تطبيق. على iPhone الصفحة تقعد خدامة والشاشة شاعلة باش يسمع الرنة.',
      ],
      [Sparkles, 'المساعد', 'اسألو «شحال من طلب اليوم؟» ولا «شحال يستنّاو؟» ويجاوبك من أرقامك.'],
      [BarChart3, 'التقارير', 'الطلبات، وقت التحضير ووقت الانتظار، لليوم وللأسبوع وللشهر.'],
      [Users, 'الفريق والفروع', 'كل خدام بحسابو، وكل فرع بلوحتو وشاشتو وأكوادو.'],
      [Megaphone, 'صفحة الزبون على ذوقك', 'شعارك، ألوانك، الرنة، ونص التنبيه بالعربية والفرنسية.'],
      [KeyRound, 'دخول بالواتساب', 'كود يوصلك على واتساب، والجهاز يتفكّرك 30 يوم.'],
      [
        Wallet,
        'جيب محل، اربح',
        '2000 دج رصيد على كل محل يجي من عندك ويخلّص، و1000 دج تخفيض للمحل الجديد.',
      ],
      [Plug, 'واجهة API', 'اربط الكاشير ولا المطبخ، والتليفون يرنّ وحدو كي يوجد الطلب.'],
      [Monitor, 'اللوحة من التليفون', 'سيّر كل شي من تليفونك، بشريط أزرار تحت الشاشة.'],
    ],
  },
];

const statuses = [
  ['انرسل', 'التنبيه خرج لتليفون الزبون'],
  ['وصل', 'تليفونو استقبل التنبيه'],
  ['شافه', 'فتح الصفحة وشاف بلي طلبو واجد'],
  ['جاي', 'ضغط «راني جاي»'],
];

export default function ActivityFeatures() {
  const [tab, setTab] = useState(groups[0].id);
  const group = groups.find((g) => g.id === tab) || groups[0];
  return (
    <section id="activities" className="activity-features">
      <div className="wrap">
        <div className="section-heading">
          <span className="kicker">{bippoT('على حساب نشاطك')}</span>
          <h2>{bippoT('مزايا لكل نوع محل.')}</h2>
        </div>

        <div className="activity-status-band">
          <div className="activity-status-copy">
            <HeartPulse size={22} aria-hidden="true" />
            <div>
              <h3>{bippoT('تعرف واش صرا مع كل زبون.')}</h3>
              <p>{bippoT('من اللوحة تشوف التنبيه وين وصل، بلا ما تعيّط ولا تخرج للكونتوار.')}</p>
            </div>
          </div>
          <ol className="activity-status-steps">
            {statuses.map(([name, desc]) => (
              <li key={name}>
                <b>{bippoT(name)}</b>
                <span>{bippoT(desc)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="activity-tabs" role="tablist" aria-label={bippoT('الأنشطة')}>
          {groups.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={'activity-tab-' + id}
              aria-selected={tab === id}
              aria-controls="activity-panel"
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              <Icon size={18} aria-hidden="true" />
              {bippoT(label)}
            </button>
          ))}
        </div>

        <div
          id="activity-panel"
          className="activity-panel"
          role="tabpanel"
          aria-labelledby={'activity-tab-' + group.id}
        >
          <p className="activity-intro">{bippoT(group.intro)}</p>
          <ul className="activity-grid">
            {group.items.map(([Icon, title, desc]) => (
              <li key={title}>
                <span className="activity-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3>{bippoT(title)}</h3>
                <p>{bippoT(desc)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
