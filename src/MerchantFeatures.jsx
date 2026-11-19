import { t as bippoT } from './i18n.js';
import React, { useEffect, useState } from 'react';
import {
  Gift,
  MessageSquareText,
  Star,
  ExternalLink,
  Gamepad2,
  Monitor,
  BookOpen,
  Smartphone,
  QrCode,
  Plug,
} from 'lucide-react';
import { getSettings, saveSettings } from './shopSettings';
import { reviewUrl } from './guestExperience';
import LoyaltyCard from './LoyaltyCard';
import MenuEditor from './MenuEditor';
import { shopActivity } from './shopActivities';
import TableCodes from './TableCodes';
import PosKeys from './PosKeys';
import { LOYALTY_GOALS } from './loyaltyRules';
import './merchant-features.css';

function Status({ on, label }) {
  return (
    <span className={'feature-status' + (on ? ' on' : '')}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

function Switch({ checked, disabled, onChange, label }) {
  return (
    <input
      type="checkbox"
      role="switch"
      className="feature-switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function FeatureCard({ icon: Icon, title, status, control, pro, children }) {
  return (
    <article className="feature-card">
      <header>
        <span className="feature-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
        <h2>{title}</h2>
        <div className="feature-state">
          {status}
          {control}
        </div>
      </header>
      {children}
      {pro && <small className="feature-plan">{bippoT('في الباقة الاحترافية')}</small>}
    </article>
  );
}

// «المزايا»: every customer-facing feature with its switch and settings.
export default function MerchantFeatures({ paid = null, onOpen, onSaved }) {
  const [settings, setSettings] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [editing, setEditing] = useState(''),
    [draft, setDraft] = useState({});
  const locked = paid === false;

  useEffect(() => {
    let alive = true;
    getSettings()
      .then((value) => alive && setSettings(value))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function save(key, patch) {
    setBusy(key);
    setError('');
    try {
      const saved = await saveSettings({ ...settings, ...patch });
      const next = { ...settings, ...saved };
      setSettings(next);
      onSaved?.(next);
      return true;
    } catch (e) {
      setError(e.message || bippoT('تعذر حفظ التغيير. عاود المحاولة.'));
      return false;
    } finally {
      setBusy('');
    }
  }

  function edit(key, values) {
    setEditing(editing === key ? '' : key);
    setDraft(values);
  }

  if (!settings)
    return (
      <section className="merchant-features">
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : (
          <p role="status">{bippoT('نحمّلو الإعدادات…')}</p>
        )}
      </section>
    );

  const activity = shopActivity(settings.kind);
  const options = settings.customer_options || {};
  const review = settings.google_review_url || '';
  const goal = draft.loyalty_goal || settings.loyalty_goal || 9;
  const upgrade = locked && (
    <button type="button" className="button outline small" onClick={() => onOpen?.('billing')}>
      {bippoT('فعّل الاحترافية')}
    </button>
  );

  return (
    <section className="merchant-features">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {activity.menu && (
        <>
          <FeatureCard
            icon={BookOpen}
            title={bippoT('المنيو الإلكتروني')}
            status={
              <Status
                on={settings.menu_enabled}
                label={settings.menu_enabled ? bippoT('مفعّل') : bippoT('موقف')}
              />
            }
            control={
              <Switch
                label={bippoT('فعّل المنيو الإلكتروني')}
                checked={Boolean(settings.menu_enabled)}
                disabled={busy === 'menu'}
                onChange={(on) => save('menu', { menu_enabled: on })}
              />
            }
          >
            <p>
              {bippoT(
                'أصنافك وأسعارك على تليفون الزبون: يشوفها من صفحة طلبو وهو يستنّى، ولا من رابط المنيو تاعك.',
              )}
            </p>
            <div className="feature-actions">
              <button
                type="button"
                className="button outline small"
                aria-expanded={editing === 'menu'}
                onClick={() => edit('menu', {})}
              >
                {bippoT('ضبط المنيو')}
              </button>
            </div>
            {editing === 'menu' && (
              <MenuEditor
                settings={settings}
                onCurrency={(code) => save('menu', { menu_currency: code })}
              />
            )}
          </FeatureCard>

          <FeatureCard
            icon={Smartphone}
            title={bippoT('الطلب من التليفون')}
            pro
            status={
              <Status
                on={settings.ordering_enabled}
                label={settings.ordering_enabled ? bippoT('مفعّل') : bippoT('موقف')}
              />
            }
            control={
              <Switch
                label={bippoT('فعّل الطلب من التليفون')}
                checked={Boolean(settings.ordering_enabled)}
                disabled={
                  locked ||
                  busy === 'ordering' ||
                  (!settings.menu_enabled && !settings.ordering_enabled)
                }
                onChange={(on) => save('ordering', { ordering_enabled: on })}
              />
            }
          >
            <p>
              {bippoT(
                'الزبون يختار من المنيو ولا يكتب طلبو ويبعثو من تليفونو. توصلك في «الطلبات»، تقبلها، وتخلّصو كي يستلم.',
              )}
            </p>
            {!settings.menu_enabled && (
              <small className="feature-plan">{bippoT('فعّل المنيو الإلكتروني أولًا.')}</small>
            )}
            <fieldset className="feature-modes">
              <legend>{bippoT('طرق الاستلام')}</legend>
              {[
                ['pickup', 'استلام من المحل'],
                ['table', 'على الطاولة'],
                ['car', 'في الطوموبيل'],
              ].map(([key, label]) => {
                const modes = settings.ordering_modes?.length
                  ? settings.ordering_modes
                  : ['pickup'];
                const on = modes.includes(key);
                return (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={locked || busy === 'ordering' || (on && modes.length === 1)}
                      onChange={(e) =>
                        save('ordering', {
                          ordering_modes: e.target.checked
                            ? [...modes, key]
                            : modes.filter((m) => m !== key),
                        })
                      }
                    />
                    {bippoT(label)}
                  </label>
                );
              })}
            </fieldset>
            {!settings.ordering_enabled ? null : settings.ordering_modes?.includes('table') ? (
              <>
                <div className="feature-actions">
                  <button
                    type="button"
                    className="button outline small"
                    aria-expanded={editing === 'tables'}
                    onClick={() => edit('tables', {})}
                  >
                    <QrCode size={16} aria-hidden="true" />
                    {bippoT('أكواد الطاولات')}
                  </button>
                </div>
                {editing === 'tables' && <TableCodes settings={settings} />}
              </>
            ) : (
              <small className="hint">{bippoT('فعّل «على الطاولة» باش تطبع كود لكل طاولة.')}</small>
            )}
            {upgrade && <div className="feature-actions">{upgrade}</div>}
          </FeatureCard>
        </>
      )}

      {activity.loyalty && (
        <FeatureCard
          icon={Gift}
          title={bippoT('بطاقة الولاء')}
          pro
          status={
            <Status
              on={settings.loyalty_enabled}
              label={settings.loyalty_enabled ? bippoT('مفعّلة') : bippoT('موقفة')}
            />
          }
          control={
            <Switch
              label={bippoT('فعّل بطاقة الولاء')}
              checked={Boolean(settings.loyalty_enabled)}
              disabled={locked || busy === 'loyalty'}
              onChange={(on) => save('loyalty', { loyalty_enabled: on })}
            />
          }
        >
          <p>{bippoT('كل طلب يختم بطاقة زبونك في تليفونو، وكي تكمل المكافأة عليك.')}</p>
          <div className="feature-actions">
            <button
              type="button"
              className="button outline small"
              aria-expanded={editing === 'loyalty'}
              onClick={() =>
                edit('loyalty', {
                  loyalty_goal: settings.loyalty_goal || 9,
                  loyalty_reward: settings.loyalty_reward || '',
                  loyalty_reward_fr: settings.loyalty_reward_fr || '',
                })
              }
            >
              {bippoT('إعدادات البطاقة')}
            </button>
            {upgrade}
          </div>
          {editing === 'loyalty' && (
            <form
              className="feature-settings loyalty-settings"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await save('loyalty', draft)) setEditing('');
              }}
            >
              <div className="loyalty-settings-fields">
                <fieldset>
                  <legend>{bippoT('عدد الأختام')}</legend>
                  <div className="feature-chips">
                    {LOYALTY_GOALS.map((n) => (
                      <label key={n} className={goal === n ? 'on' : ''}>
                        <input
                          type="radio"
                          name="loyalty-goal"
                          value={n}
                          checked={goal === n}
                          onChange={() => setDraft({ ...draft, loyalty_goal: n })}
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  {bippoT('المكافأة بالعربية')}
                  <input
                    maxLength={60}
                    placeholder={bippoT('مثلًا قهوة علينا')}
                    value={draft.loyalty_reward}
                    onChange={(e) => setDraft({ ...draft, loyalty_reward: e.target.value })}
                  />
                </label>
                <label>
                  {bippoT('المكافأة بالفرنسية')}
                  <input
                    dir="ltr"
                    maxLength={60}
                    placeholder="Un café offert"
                    value={draft.loyalty_reward_fr}
                    onChange={(e) => setDraft({ ...draft, loyalty_reward_fr: e.target.value })}
                  />
                </label>
                <ol className="loyalty-how">
                  <li>{bippoT('زبونك يمسح الكود، والطلب يتربط ببطاقتو.')}</li>
                  <li>
                    {bippoT(
                      'أول ختمين هدية، وكل طلب «جاهز» يزيد ختم (حتى 3 في النهار). مكافأتو بعد {0} طلبات.',
                      [goal - 2],
                    )}
                  </li>
                  <li>{bippoT('كي تكمل، المكافأة تبان على طلبو في اللوحة وتضغط «صرفتها».')}</li>
                </ol>
                <button className="button small" disabled={busy === 'loyalty'}>
                  {busy === 'loyalty' ? bippoT('نحفظو…') : bippoT('حفظ')}
                </button>
              </div>
              <div className="loyalty-settings-preview" aria-label={bippoT('معاينة البطاقة')}>
                <small>{bippoT('معاينة عند الزبون')}</small>
                <LoyaltyCard
                  card={{
                    goal,
                    stamps: Math.min(goal, 4),
                    complete: false,
                    reward: draft.loyalty_reward,
                    reward_fr: draft.loyalty_reward_fr,
                  }}
                />
              </div>
            </form>
          )}
        </FeatureCard>
      )}

      <FeatureCard
        icon={MessageSquareText}
        title={bippoT('ملاحظات خاصة بعد الاستلام')}
        pro
        status={
          <Status
            on={settings.private_feedback_enabled}
            label={settings.private_feedback_enabled ? bippoT('مفعّلة') : bippoT('موقفة')}
          />
        }
        control={
          <Switch
            label={bippoT('ملاحظات خاصة بعد الاستلام')}
            checked={Boolean(settings.private_feedback_enabled)}
            disabled={locked || busy === 'feedback'}
            onChange={(on) => save('feedback', { private_feedback_enabled: on })}
          />
        }
      >
        <p>{bippoT('الزبون يكتبلك ملاحظة بعد الاستلام، توصلك وحدك في «ملاحظات الزبائن».')}</p>
        {upgrade && <div className="feature-actions">{upgrade}</div>}
      </FeatureCard>

      <FeatureCard
        icon={Star}
        title={bippoT('التقييم بالنجوم')}
        status={<Status on label={bippoT('مفعّل دائمًا')} />}
      >
        <p>{bippoT('بعد الاستلام الزبون يقيّم الخدمة من 1 إلى 5، والمتوسط يبان في التحليلات.')}</p>
        <div className="feature-actions">
          <button
            type="button"
            className="button outline small"
            onClick={() => onOpen?.('reports')}
          >
            {bippoT('شوف التقييمات')}
          </button>
        </div>
      </FeatureCard>

      <FeatureCard
        icon={ExternalLink}
        title={bippoT('تقييمات Google')}
        status={<Status on={Boolean(review)} label={review ? bippoT('مفعّل') : bippoT('فاضي')} />}
      >
        <p>{bippoT('بعد الاستلام نعرضو على كل زبون رابط تقييم محلك في Google.')}</p>
        <div className="feature-actions">
          <button
            type="button"
            className="button outline small"
            aria-expanded={editing === 'review'}
            onClick={() => edit('review', { google_review_url: review })}
          >
            {review ? bippoT('بدّل الرابط') : bippoT('أضف الرابط')}
          </button>
        </div>
        {editing === 'review' && (
          <form
            className="feature-settings"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                reviewUrl(draft.google_review_url || '');
              } catch {
                setError(bippoT('استعمل روابط تبدأ بـ HTTPS.'));
                return;
              }
              if (await save('review', { google_review_url: draft.google_review_url }))
                setEditing('');
            }}
          >
            <label>
              {bippoT('رابط تقييم محلك على Google')}
              <input
                type="url"
                dir="ltr"
                maxLength={2048}
                placeholder="https://g.page/r/…/review"
                value={draft.google_review_url}
                onChange={(e) => setDraft({ google_review_url: e.target.value })}
              />
            </label>
            <button className="button small" disabled={busy === 'review'}>
              {busy === 'review' ? bippoT('نحفظو…') : bippoT('حفظ')}
            </button>
          </form>
        )}
      </FeatureCard>

      <FeatureCard
        icon={Gamepad2}
        title={bippoT('لعبة الانتظار')}
        status={
          <Status
            on={options.game !== false}
            label={options.game !== false ? bippoT('مفعّلة') : bippoT('موقفة')}
          />
        }
        control={
          <Switch
            label={bippoT('لعبة الانتظار')}
            checked={options.game !== false}
            disabled={busy === 'game'}
            onChange={(on) => save('game', { customer_options: { ...options, game: on } })}
          />
        }
      >
        <p>{bippoT('«طلّع قهوتك»: لعبة صغيرة يلعبها الزبون وهو يستنّى طلبو.')}</p>
      </FeatureCard>

      <FeatureCard
        icon={Monitor}
        title={activity.foodService ? bippoT('شاشة الانتظار والمطبخ') : bippoT('شاشة الانتظار')}
        status={<Status on label={bippoT('من المتصفح')} />}
      >
        <p>
          {bippoT(
            activity.foodService
              ? 'تلفاز يعرض الأرقام الجاهزة وينادي عليها بالصوت، وتابلت في المطبخ تعلّم منه الطلبات «جاهز».'
              : 'تلفاز يعرض الأرقام المنادى عليها وينادي عليها بالصوت.',
          )}
        </p>
        <div className="feature-actions">
          <button type="button" className="button outline small" onClick={() => onOpen?.('codes')}>
            {bippoT('افتح الفروع والأكواد')}
          </button>
        </div>
      </FeatureCard>

      <FeatureCard
        icon={Plug}
        title={bippoT('الربط مع الكاشير')}
        pro
        status={<Status label={bippoT('واجهة API')} />}
      >
        <p>
          {bippoT(
            'نظام الكاشير يبعث الطلب إلى Bipilo ويطبع كود التتبّع على التيكي، ومن بعد يعلّمو «جاهز» وحدو. يلزم مبرمج الكاشير يزيد الربط بمفتاح الفرع.',
          )}
        </p>
        <div className="feature-actions">
          <button
            type="button"
            className="button outline small"
            aria-expanded={editing === 'pos'}
            onClick={() => edit('pos', {})}
          >
            {bippoT('مفاتيح الربط')}
          </button>
          {upgrade}
        </div>
        {editing === 'pos' && <PosKeys locked={locked} />}
      </FeatureCard>
    </section>
  );
}
