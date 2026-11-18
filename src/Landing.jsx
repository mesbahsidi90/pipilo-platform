import { PlanCards } from './PlanCards';
import { t as bippoT } from './i18n.js';
import PublicFooter from './PublicFooter';
import Brand from './Brand';
import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Plus,
  ArrowLeft,
  ScanLine,
  ChefHat,
  Coffee,
  Monitor,
  Clock,
  ShieldCheck,
  Keyboard,
  Plug,
  Smartphone,
  CheckCheck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import DotNumber from './DotNumber';
import LiveDemo from './LiveDemo';
import { CallboardHero, Moments } from './Callboard';
import './landing-scan.css';
export { default as Brand } from './Brand';
const jump = (id) => (e) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
  });
};
function Phone({ ready = false, compact = false }) {
  return (
    <div
      className={'reference-phone ' + (compact ? 'compact' : '')}
      aria-label={bippoT('معاينة صفحة الزبون')}
    >
      <div className="island" />
      <div className="mock-shop">
        <span>
          <ChefHat size={16} />
        </span>
        {bippoT('البسطة')}
      </div>
      <div className={'mock-ticket ' + (ready ? 'ready' : '')}>
        <small>{bippoT('طلبك رقم')}</small>
        <DotNumber value="57" />
        <h4>{ready ? bippoT('طلبك راه واجد ✓') : bippoT('رانا نحضّرولك طلبك')}</h4>
        <p>
          {ready ? bippoT('طلبك واجد، تقدر تجي تديه') : bippoT('كي يوجد طلبك، الحالة تتبدّل هنا')}
        </p>
        {ready ? (
          <span className="mock-success">
            <Check size={13} />
            {bippoT(' رانا نستناوك في الكونتوار')}
          </span>
        ) : (
          <div className="waiting-dots">•••••</div>
        )}
      </div>
      <div className="mock-powered">{bippoT('ساهلة مع Bipilo')}</div>
      <div className="home-indicator" />
    </div>
  );
}
function ScanPhone() {
  return (
    <div
      className="reference-phone scan-phone"
      role="img"
      aria-label={bippoT('كاميرا الهاتف تقرأ رمز QR وتعرض رابط متابعة الطلب')}
    >
      <div className="island" />
      <div className="scan-poster" aria-hidden="true">
        <Brand linked={false} />
        <span>{bippoT('امسح بكاميرا تليفونك')}</span>
        <div className="scan-target">
          <QRCodeSVG
            value="https://bipilo-platform.pages.dev/#try"
            size={112}
            level="M"
            marginSize={4}
          />
          <div className="scan-corners">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
      <div className="scan-result" aria-hidden="true">
        <div className="scan-result-shop">
          <span className="scan-shop-icon">
            <Coffee size={16} />
          </span>
          <div>
            <b>{bippoT('البسطة')}</b>
            <small>{bippoT('تابع طلبك')}</small>
          </div>
        </div>
        <span className="scan-open">{bippoT('فتح')}</span>
      </div>
      <div className="home-indicator" />
    </div>
  );
}
function MiniOrder({ ready = false, onClick }) {
  return (
    <div className="mini-order">
      <div className="mini-title">
        <b>{bippoT('لوحة الطلبات')}</b>
        <span>{bippoT('البسطة')}</span>
      </div>
      <div className="mini-body">
        <DotNumber value="57" />
        <div>
          <b>{ready ? bippoT('واجد للاستلام') : bippoT('راه يتحضّر')}</b>
          <small>
            <Smartphone size={13} />
            {bippoT(' متابعة من صفحة الطلب')}
          </small>
        </div>
      </div>
      {onClick ? (
        <button className="button full" onClick={onClick}>
          {bippoT('الطلب راه واجد ')}
          <Check size={16} />
        </button>
      ) : !ready ? (
        <a className="button full" href="#try" onClick={jump('try')}>
          {bippoT('جرّب زر «جاهز»')}
        </a>
      ) : (
        <div className="mini-badges">
          <span>
            <Check />
            {bippoT(' جاهز')}
          </span>
          <span>
            <CheckCheck />
            {bippoT(' تحديث الصفحة')}
          </span>
          <span className="green">
            <Monitor />
            {bippoT(' شاشة العرض')}
          </span>
        </div>
      )}
    </div>
  );
}
const howSteps = [
  [
    bippoT('يمسح الكود بكاميرا تليفونو.'),
    bippoT(
      'زيد التيكي من لوحة المحل. الزبون يمسح QR تاع طلبو، ولا يمسح QR ثابت ويدخل رمز المتابعة اللي عطاهولو المحل.',
    ),
  ],
  [
    bippoT('يفعّل التنبيه ويستنى على راحتو.'),
    bippoT(
      'يضغط «فعّل التنبيه» ويسمح بالإشعارات. يقدر يقعد ولا يبعد على الكونتوار وهو يتابع التيكي في تليفونو.',
    ),
  ],
  [
    bippoT('كي يجي دورو، بيبيلو!'),
    bippoT(
      'كي يجي دور الزبون ولا تجهز خدمتو، علّم التيكي «جاهز». تليفونو ينبّهو إذا فعّل الإشعارات، حتى كي تكون الشاشة مقفولة على الأجهزة المدعومة.',
    ),
  ],
  [
    bippoT('يشوف النمرة ويجي في وقتو.'),
    bippoT(
      'الزبون يجي كي يحين دورو، والفريق يكمّل التيكي من اللوحة. تقدر تعرض النمرات الجاهزة في شاشة الانتظار تاع المحل.',
    ),
  ],
];
function HowItWorks() {
  const [step, setStep] = useState(0);
  const nodes = useRef([]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const target = innerHeight * (innerWidth <= 700 ? 0.78 : 0.5);
      let best = 0,
        dist = Infinity;
      nodes.current.forEach((node, i) => {
        if (!node) return;
        const r = node.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - target);
        if (d < dist) {
          best = i;
          dist = d;
        }
      });
      setStep(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener('scroll', onScroll, {
      passive: true,
    });
    addEventListener('resize', onScroll);
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <section id="how" className="reference-how wrap">
      <div className="section-heading">
        <span className="kicker">{bippoT('امسح. فعّل التنبيه. استنّى على راحتك.')}</span>
        <h2>{bippoT('كيفاش تخدم Bipilo؟')}</h2>
      </div>
      <div className="sticky-story">
        <div className="story-track">
          {howSteps.map(([title, desc], i) => (
            <article
              ref={(el) => (nodes.current[i] = el)}
              className={'scroll-step ' + (step === i ? 'current' : '')}
              key={title}
            >
              <DotNumber value={i + 1} className="step-digit" />
              <h3>{title}</h3>
              <p>{desc}</p>
              {i === 2 && <MiniOrder />}
              {i === 3 && (
                <div className="story-finish">
                  <CheckCheck size={18} />
                  {bippoT(' النمرة باينة في التليفون وفي الشاشة.')}
                </div>
              )}
            </article>
          ))}
        </div>
        <div className="sticky-stage">
          <div className={'story-visual sticky-phone scene-' + (step + 1)} data-step={step + 1}>
            <div className="stage-meta">
              <span>{bippoT('رحلة الطلب')}</span>
              <b>0{step + 1} / 04</b>
            </div>
            <div className="phone-state" key={step}>
              {step === 0 ? <ScanPhone /> : <Phone ready={step >= 2} />}
            </div>
            <div className="stage-dots" aria-label={bippoT('الخطوة ') + (step + 1)}>
              {howSteps.map((_, i) => (
                <span className={step === i ? 'active' : ''} key={i} />
              ))}
            </div>
            {step === 1 && (
              <div className="quiet-label">
                <Clock size={15} />
                {bippoT(' خلّي الصفحة محلولة وتبع الحالة')}
              </div>
            )}
            {step === 3 && (
              <div className="pickup-banner">
                <CheckCheck size={17} />
                {bippoT(' روح للكونتوار، طلبك يستنّاك')}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
export default function Landing() {
  useEffect(() => {
    const target = location.hash.slice(1);
    if (['try', 'how', 'features', 'faq', 'plans'].includes(target)) {
      const id = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView());
      return () => cancelAnimationFrame(id);
    }
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="marketing">
      <header className="site-header">
        <div className="nav wrap">
          <Brand />
          <nav aria-label={bippoT('روابط الصفحة')}>
            <a href="#how" onClick={jump('how')}>
              {bippoT('كيفاش تخدم؟')}
            </a>
            <a href="#features" onClick={jump('features')}>
              {bippoT('المزايا')}
            </a>
            <a href="#try" onClick={jump('try')}>
              {bippoT('جرّبها')}
            </a>
            <a href="#plans" onClick={jump('plans')}>
              {bippoT('الباقات')}
            </a>
            <a href="#faq" onClick={jump('faq')}>
              {bippoT('الأسئلة الشائعة')}
            </a>
          </nav>
          <div className="nav-end">
            <a href="/login">{bippoT('دخول')}</a>
            <a className="button small" href="/signup">
              {bippoT('إنشاء حساب')}
            </a>
          </div>
        </div>
      </header>
      <main>
        <CallboardHero onTry={jump('try')} />
        <Moments />
        <HowItWorks />
        <section id="features" className="feature-area">
          <div className="wrap">
            <div className="section-heading">
              <span className="kicker">{bippoT('كل واش تحتاج باش تبدا')}</span>
              <h2>{bippoT('خدمة منظّمة. وزبون مرتاح.')}</h2>
            </div>
            <div className="bento">
              <article className="bento-card wide">
                <div className="bento-text">
                  <ScanLine />
                  <h3>{bippoT('QR على حساب خدمتك.')}</h3>
                  <p>
                    {bippoT(
                      'استعمل QR لكل تيكي، ولا اطبع QR ثابت للمحل وخلي الزبون يدخل رمز المتابعة. المتابعة تتحلّ مباشرة في المتصفح.',
                    )}
                  </p>
                </div>
                <div className="black-widget qr-widget">
                  <ScanLine size={72} />
                  <span>{bippoT('امسح. تابع. استلم.')}</span>
                  <div className="widget-link">
                    {bippoT('Bipilo / طلبك ')}
                    <ArrowLeft size={14} />
                  </div>
                </div>
              </article>
              <article className="bento-card">
                <div className="black-widget number-widget">
                  <div>
                    <small>{bippoT('راه يتحضّر')}</small>
                    <DotNumber value="03" />
                  </div>
                  <div>
                    <small>{bippoT('واجد للاستلام')}</small>
                    <DotNumber value="02" />
                  </div>
                  <div className="widget-bars">
                    {[35, 54, 88, 67, 45, 60, 79, 52, 39, 47].map((h, i) => (
                      <i
                        style={{
                          height: h,
                        }}
                        key={i}
                      />
                    ))}
                  </div>
                  <small>{bippoT('أرقام توضيحية · الشاشة تتحدث تلقائيًا')}</small>
                </div>
                <h3>{bippoT('طابور منظّم من لوحة وحدة.')}</h3>
                <p>
                  {bippoT(
                    'زيد التيكيات، شوف شكون يستنّى، وعلّم الخدمة كي توجد. التيكيات اللي تسلّمت ولا تلغات تبقى في السجل.',
                  )}
                </p>
              </article>
              <article className="bento-card">
                <div className="black-widget counter-widget">
                  <small>{bippoT('بانتظار الاستلام')}</small>
                  <DotNumber value="57" />
                  <div className="widget-dots">● ● ● ● ● ● ● ● ●</div>
                </div>
                <h3>{bippoT('الرقم باين للكل.')}</h3>
                <p>
                  {bippoT('بيّن نمرات الطلبات اللي وجدو في شاشة المحل، كبار وواضحين حتى من بعيد.')}
                </p>
              </article>
              <article className="bento-card wide">
                <div className="bento-text">
                  <ShieldCheck />
                  <h3>{bippoT('تليفون الزبون يعوّض البيجر.')}</h3>
                  <p>
                    {bippoT(
                      'الزبون يتابع التيكي ويفعّل التنبيه من متصفحو، بلا حساب وبلا تطبيق. فريقك يسيّر الانتظار من لوحة المحل.',
                    )}
                  </p>
                </div>
                <div className="black-widget privacy-widget">
                  <DotNumber value="0" />
                  <span>{bippoT('تطبيقات للتحميل')}</span>
                  <div>
                    <Check />
                    {bippoT(' رابط خاص بالطلب')}
                  </div>
                  <div>
                    <Check />
                    {bippoT(' دخول آمن للفريق')}
                  </div>
                  <div>
                    <Check />
                    {bippoT(' تجربة من المتصفح')}
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
        <LiveDemo />
        <section className="setup-section">
          <div className="wrap setup-grid">
            <div>
              <span className="kicker">{bippoT('على حساب خدمة محلّك')}</span>
              <h2>
                {bippoT('ابدا بالساهل.')}
                <br />
                {bippoT('وكبّر على راحتك.')}
              </h2>
              <p>
                {bippoT('ما تحتاجش تبدّل طريقة خدمتك. دخل نمرة التيكي، واعطي للزبون كود المتابعة.')}
              </p>
              <div className="setup-point">
                <Keyboard />
                <div>
                  <h3>{bippoT('إدخال يدوي سريع')}</h3>
                  <p>{bippoT('دخل نمرة الطلب واضغط. تقدر تجرّب Bipilo في محلّك من نهار اللول.')}</p>
                </div>
              </div>
              <div className="setup-point">
                <Plug />
                <div>
                  <h3>{bippoT('يناسب خدمات مختلفة')}</h3>
                  <p>
                    {bippoT(
                      'من المطاعم والمقاهي لمغاسل الملابس والسيارات والخياطين، كل محل ينظّم الانتظار بالطريقة اللي تناسب خدمتو.',
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="setup-tiles">
              <div>
                <Keyboard />
                <b>{bippoT('لوحة الموظف')}</b>
                <span>{bippoT('زيد ونظّم طلباتك')}</span>
              </div>
              <div>
                <Smartphone />
                <b>{bippoT('صفحة الزبون')}</b>
                <span>{bippoT('تبع بلا حساب')}</span>
              </div>
              <div>
                <Monitor />
                <b>{bippoT('شاشة المحل')}</b>
                <span>{bippoT('اعرض الأرقام بوضوح')}</span>
              </div>
              <div>
                <ScanLine />
                <b>{bippoT('رابط وQR')}</b>
                <span>{bippoT('خاص بكل طلب')}</span>
              </div>
            </div>
          </div>
        </section>
        <section className="access-section wrap">
          <div className="section-heading">
            <span className="kicker">{bippoT('شوفها من جهة الزبون ومن جهة المحل')}</span>
            <h2>{bippoT('جرّب الخدمة بنفسك.')}</h2>
            <p>{bippoT('اختار واش يناسبك باش تبدا.')}</p>
          </div>
          <div className="access-cards">
            <article className="access-card">
              <h3>{bippoT('جرّب التنبيه على تليفونك')}</h3>
              <p>{bippoT('امسح كود التجربة وفعّل التنبيه، ومن بعد جرّب ترنّ على تليفونك.')}</p>
              <div className="access-price">{bippoT('بلا إعداد')}</div>
              <ul>
                <li>
                  <Check />
                  {bippoT(' مسح QR بكاميرا الهاتف')}
                </li>
                <li>
                  <Check />
                  {bippoT(' صفحة متابعة في المتصفح')}
                </li>
                <li>
                  <Check />
                  {bippoT(' تنبيه وقت الجاهزية')}
                </li>
                <li>
                  <Check />
                  {bippoT(' بلا تسجيل')}
                </li>
              </ul>
              <a href="#try" onClick={jump('try')} className="button outline full">
                {bippoT('افتح التجربة')}
              </a>
            </article>
            <article className="access-card featured">
              <span className="access-badge">{bippoT('للعمل بين الأجهزة')}</span>
              <h3>{bippoT('جهّز محلك مع Bipilo')}</h3>
              <p>{bippoT('افتح حساب لفريقك وابدأ تنظّم التيكيات وشاشة الانتظار.')}</p>
              <div className="access-price">{bippoT('محلك، متصل')}</div>
              <ul>
                <li>
                  <Check />
                  {bippoT(' دخول خاص بالفريق')}
                </li>
                <li>
                  <Check />
                  {bippoT(' متابعة من هاتف الزبون')}
                </li>
                <li>
                  <Check />
                  {bippoT(' فصل بيانات المحلات')}
                </li>
                <li>
                  <Check />
                  {bippoT(' قاعدة بيانات وتحديث تلقائي')}
                </li>
              </ul>
              <a href="/signup" className="button full">
                {bippoT('إنشاء حساب مجاني')}
              </a>
            </article>
          </div>
          <p className="access-footnote">
            {bippoT('حساب المحل للفريق. الزبون يتابع التيكي بلا حساب.')}
          </p>
        </section>
        <section id="faq" className="faq-section">
          <div className="wrap faq-grid">
            <h2>{bippoT('عندك سؤال؟')}</h2>
            <div>
              {[
                [
                  bippoT('لازم الزبون يحمّل تطبيق؟'),
                  bippoT(
                    'لا، غير يحلّ الرابط ولا يمسح QR بكاميرا تليفونو. صفحة الطلب تتحلّ مباشرة، بلا تحميل وبلا حساب.',
                  ),
                ],
                [
                  bippoT('يوصل التنبيه والتليفون مغلوق؟'),
                  bippoT(
                    'الرنة المخصصة تخدم كي تفعّل الصوت وتخلّي الصفحة محلولة. إشعارات الخلفية تحتاج دعم الجهاز وإذن الزبون وخدمة إشعارات مفعّلة؛ على iPhone يلزم إضافة الصفحة للشاشة الرئيسية. صوت الإشعار يرجع لإعدادات الهاتف.',
                  ),
                ],
                [
                  bippoT('تخدم مع نظام الكاشير؟'),
                  bippoT('تقدر تدخل نمرة التيكي يدويًا. الربط الآلي مع الكاشير نخلوه لمرحلة جاية.'),
                ],
                [
                  bippoT('نحتاج أجهزة خاصة؟'),
                  bippoT(
                    'يكفي جهاز فيه متصفح لفريق المحل، وتليفون للزبون. وتقدر تفتح شاشة النمرات في تلفاز يدعم المتصفح.',
                  ),
                ],
                [
                  bippoT('التجربة تخدم بين أجهزة مختلفة؟'),
                  bippoT(
                    'نعم، تجربة الهاتف في الموقع المنشور تخدم بين الكمبيوتر والهاتف بلا حساب. امسح QR وفعّل التنبيه. إذا تشغّل المشروع محليًا بلا قاعدة بيانات، المعاينة تكون في نفس المتصفح فقط.',
                  ),
                ],
                [
                  bippoT('كيفاش تحميو بيانات المحل؟'),
                  bippoT(
                    'في الوضع المتصل، كل موظف عندو حساب وبيانات كل محل مفصولين. الزبون يشوف غير حالة طلبو بالكود الخاص بيه.',
                  ),
                ],
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span>
                      <Plus size={17} />
                    </span>
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <PlanCards />
        <section className="final-cta wrap">
          <span className="kicker">{bippoT('كونتوار بلا زحمة. وخدمة منظّمة.')}</span>
          <h2>
            {bippoT('كي يجي دور زبونك…')}
            <br />
            {bippoT('بيبيلو.')}
          </h2>
          <a className="button" href="/signup">
            {bippoT('افتح حساب محلك ')}
            <ArrowLeft size={18} />
          </a>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
