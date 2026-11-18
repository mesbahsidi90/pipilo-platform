import { t as bippoT } from './i18n.js';
import React, { useState, useEffect } from 'react';
import Brand from './Brand';
import { Hourglass, MoveUpRight, Printer, Tablet } from 'lucide-react';
import { shopActivity, shopTypes } from './shopActivities';
import { cloud, db } from './store';
export default function Signup({ initialKind = 'cafe' }) {
  const [shop, setShop] = useState(''),
    [kind, setKind] = useState(initialKind),
    [waitChoice, setWaitChoice] = useState(null),
    [qrChoice, setQrChoice] = useState(null),
    [city, setCity] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [session, setSession] = useState(null),
    [loading, setLoading] = useState(cloud),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const activity = shopActivity(kind);
  const flexible = activity.foodService || kind === 'other';
  const waiting = activity.clinic ? 'onsite' : waitChoice || (flexible ? 'onsite' : 'return');
  const tracking = activity.clinic
    ? 'counter'
    : qrChoice || (waiting === 'return' ? 'counter' : activity.trackingMode);

  function selectKind(value) {
    setKind(value);
    setWaitChoice(null);
    setQrChoice(null);
  }

  useEffect(() => {
    if (!db) return;
    let alive = true;
    db.auth.getSession().then(({ data, error }) => {
      if (alive) {
        setSession(data.session);
        setLoading(false);
        if (error) setError(bippoT('تعذر الاتصال. عاود تحميل الصفحة.'));
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!session && password !== confirm) {
      setError(bippoT('كلمتا المرور ماشي كيف كيف.'));
      return;
    }
    setBusy(true);
    try {
      if (!cloud) {
        localStorage.setItem(
          'bippo-shop-settings',
          JSON.stringify({
            name: shop.trim(),
            city: city.trim(),
            kind,
            tracking_mode: tracking,
            waiting_mode: waiting,
          }),
        );
        location.assign('/dashboard');
        return;
      }
      let active = session;
      if (!active) {
        const { data, error } = await db.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        active = data.session;
        setSession(active);
        if (!active)
          throw new Error(
            bippoT('الحساب تسجّل، لكن الدخول المباشر مازال غير مفعّل. تواصل مع إدارة Bipilo.'),
          );
      }
      const { error } = await db.rpc('create_my_shop', {
        shop_name: shop.trim(),
        shop_kind: kind,
        shop_city: city.trim(),
        tracking_preference: tracking,
        waiting_preference: waiting,
      });
      if (error) throw error;
      location.assign('/dashboard');
    } catch (e) {
      setError(
        e.code === 'user_already_exists'
          ? bippoT('هذا البريد عندو حساب. ادخل من صفحة الدخول.')
          : e.code === 'weak_password'
            ? bippoT('اختار كلمة مرور أقوى، 12 حرف على الأقل.')
            : e.status === 429
              ? bippoT('محاولات كثيرة. استنى شوية وعاود.')
              : e.message || bippoT('ما قدرناش نكملو التسجيل. عاود المحاولة.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="merchant-signup">
      <form className="panel login" onSubmit={submit}>
        <Brand />
        <h1>{bippoT('خلّينا نجهّزو محلك')}</h1>
        <p>{bippoT('اختار نشاطك وكيفاش زبائنك يتابعو التيكي.')}</p>
        <label>
          {bippoT('اسم المحل')}
          <input
            autoComplete="organization"
            required
            maxLength={100}
            value={shop}
            onChange={(e) => setShop(e.target.value)}
          />
        </label>
        <fieldset className="merchant-kind">
          <legend>{bippoT('نوع النشاط')}</legend>
          {Object.entries(shopTypes).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="activity"
                value={value}
                checked={kind === value}
                onChange={() => selectKind(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        {flexible && (
          <fieldset className="signup-options">
            <legend>{bippoT('زبونك يستنّى عندك ولا يروح ويرجع؟')}</legend>
            <div>
              <SetupOption
                name="waiting"
                value="onsite"
                selected={waiting}
                Icon={Hourglass}
                title={bippoT('يستنّى عندي')}
                description={bippoT('يتابع في تليفونو ويتنبّه كي يجهز طلبو.')}
                onSelect={() => {
                  setWaitChoice('onsite');
                  setQrChoice(null);
                }}
              />
              <SetupOption
                name="waiting"
                value="return"
                selected={waiting}
                Icon={MoveUpRight}
                title={bippoT('يروح ويرجع')}
                description={bippoT('يحتفظ برابط التيكي باش يتابع الخدمة حتى تجهز.')}
                onSelect={() => {
                  setWaitChoice('return');
                  setQrChoice(null);
                }}
              />
            </div>
          </fieldset>
        )}
        <fieldset className="signup-options">
          <legend>{bippoT('كيفاش زبونك يمسح الكود؟')}</legend>
          <div>
            <SetupOption
              name="tracking"
              value="counter"
              selected={tracking}
              Icon={Printer}
              title={bippoT(activity.clinic ? 'QR ثابت عند الاستقبال' : 'QR مطبوع وثابت')}
              description={
                activity.clinic
                  ? bippoT('يمسح الكود وياخذ رقم دور جديد.')
                  : bippoT('يمسح QR بعد تسجيل طلبه ويفتح المتابعة مباشرة.')
              }
              onSelect={() => setQrChoice('counter')}
            />
            {!activity.clinic && (
              <SetupOption
                name="tracking"
                value="order"
                selected={tracking}
                Icon={Tablet}
                title={bippoT('QR لكل تيكي')}
                description={bippoT(
                  'يمسح الكود من شاشة الزبون ولا من التيكي المطبوع ويفتح طلبو مباشرة.',
                )}
                onSelect={() => setQrChoice('order')}
              />
            )}
          </div>
        </fieldset>
        <label>
          {bippoT('المدينة — اختياري')}
          <input
            autoComplete="address-level2"
            maxLength={100}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </label>
        {!session && (
          <>
            <label>
              {bippoT('البريد الإلكتروني')}
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              {bippoT('كلمة المرور')}
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              {bippoT('عاود كلمة المرور')}
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <small>
              {bippoT('12 حرف على الأقل. تأكد من بريدك باش تقدر ترجع حسابك إذا نسيت كلمة المرور.')}
            </small>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button full" disabled={busy || loading}>
          {busy ? bippoT('نوجدو حسابك…') : bippoT('جهّز المحل')}
        </button>
        <small>
          {cloud
            ? bippoT('الدخول مباشرة، بلا رسالة تأكيد للبريد.')
            : bippoT('وضع تجريبي: ما يتنشأش حساب حقيقي.')}
        </small>
        <a className="recovery-back" href="/login">
          {bippoT('عندك حساب؟ ادخل من هنا')}
        </a>
        <p className="signup-legal-links">
          {bippoT('اطّلع على ')}
          <a href="#terms">{bippoT('شروط الاستعمال')}</a>
          {bippoT(' و')}
          <a href="#privacy">{bippoT('سياسة الخصوصية')}</a>
          {bippoT('، أو ')}
          <a href="#contact">{bippoT('تواصل معانا')}</a>.
        </p>
      </form>
    </div>
  );
}

function SetupOption({ name, value, selected, Icon, title, description, onSelect }) {
  return (
    <label className="signup-option">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected === value}
        onChange={onSelect}
      />
      <span>
        <strong>
          <Icon size={18} aria-hidden="true" />
          {title}
        </strong>
        <small>{description}</small>
      </span>
    </label>
  );
}
