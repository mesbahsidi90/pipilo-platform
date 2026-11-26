import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { t } from './i18n.js';
import DotNumber from './DotNumber';
import {
  BRAND_SWATCHES,
  SCREEN_THEMES,
  brandPalette,
  screenStyle,
  themeVars,
} from './screenThemes';
import { saveScreenStyle } from './shopSettings';

// «شكل الشاشة»: number style + colour set, with a small preview of the TV.
export default function ScreenStylePicker({ value, canManage, onSaved }) {
  const [style, setStyle] = useState(() => screenStyle(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const later = useRef(null);
  useEffect(() => () => clearTimeout(later.current), []);

  async function choose(next) {
    const previous = style;
    const chosen = screenStyle({ ...style, ...next });
    if (chosen.theme !== 'custom') delete chosen.palette;
    setStyle(chosen);
    setBusy(true);
    setError('');
    try {
      await saveScreenStyle(chosen);
      onSaved?.(chosen);
    } catch (e) {
      setStyle(previous);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const number = (value, className) =>
    style.digits === 'bold' ? (
      <b className={'screen-preview-bold ' + className}>{value}</b>
    ) : (
      <DotNumber value={value} className={className} />
    );

  return (
    <div className="screen-style">
      <div
        className="screen-preview"
        style={themeVars(style.theme, style.palette)}
        aria-hidden="true"
      >
        <div className="screen-preview-latest">{number('57', 'big')}</div>
        <div className="screen-preview-tiles">
          <span>{number('56', 'small')}</span>
          <span>{number('55', 'small')}</span>
        </div>
      </div>
      <fieldset disabled={!canManage || busy}>
        <legend>{t('شكل الأرقام')}</legend>
        <div className="screen-style-options">
          {[
            ['dots', t('نقاط')],
            ['bold', t('أرقام عادية')],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={style.digits === key ? 'active' : ''}
              aria-pressed={style.digits === key}
              onClick={() => choose({ digits: key })}
            >
              {key === 'dots' ? <DotNumber value="12" /> : <b>12</b>}
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={!canManage || busy}>
        <legend>{t('ألوان الشاشة')}</legend>
        <div className="screen-style-swatches">
          {Object.entries(SCREEN_THEMES).map(([key, theme]) => (
            <button
              key={key}
              type="button"
              className={style.theme === key ? 'active' : ''}
              aria-pressed={style.theme === key}
              onClick={() => choose({ theme: key })}
              title={t(theme.label)}
            >
              <span className="swatch" style={{ background: theme.bg }}>
                <i style={{ background: theme.latest, color: theme.digit }}>
                  {style.theme === key && <Check size={14} />}
                </i>
              </span>
              {t(theme.label)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={!canManage || busy}>
        <legend>{t('لون البراند تاعك')}</legend>
        <div className="screen-style-brand">
          {BRAND_SWATCHES.map((colour) => {
            const active = style.theme === 'custom' && style.palette?.color === colour;
            return (
              <button
                key={colour}
                type="button"
                className={active ? 'active' : ''}
                aria-pressed={active}
                aria-label={colour}
                title={colour}
                style={{ background: colour }}
                onClick={() => choose({ theme: 'custom', palette: brandPalette(colour) })}
              >
                {active && <Check size={14} />}
              </button>
            );
          })}
          <label className="screen-style-picker">
            <input
              type="color"
              value={style.theme === 'custom' ? style.palette.color : '#0c3e38'}
              onChange={(event) => {
                // Preview at once; save when the colour has settled.
                const next = {
                  ...style,
                  theme: 'custom',
                  palette: brandPalette(event.target.value),
                };
                setStyle(next);
                clearTimeout(later.current);
                later.current = setTimeout(() => choose(next), 600);
              }}
            />
            {t('لون آخر')}
          </label>
        </div>
        <small className="screen-style-note">
          {t('نحسبو من لونك ألوان الشاشة باش الرقم يبان مليح من بعيد.')}
        </small>
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
