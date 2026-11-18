import { language, locale as viewerLocale, translate } from './i18n.js';
import React from 'react';
import { formatPrice, localName } from './menuRules';
import './menu.css';

// Read-only menu for customers: sections, items, prices, sold-out marks.
export default function MenuView({ menu, lang = language, heading = true }) {
  const t = (text, values) => translate(text, lang, values);
  const locale = lang === 'fr' ? 'fr-DZ' : viewerLocale;
  const sections = (menu?.sections || []).filter((s) => s.items?.length);
  if (!sections.length) return <p className="menu-empty">{t('المنيو مازال فارغ.')}</p>;
  return (
    <div className="menu-view" dir={lang === 'fr' ? 'ltr' : 'rtl'}>
      {heading && sections.length > 1 && (
        <nav className="menu-jump" aria-label={t('أقسام المنيو')}>
          {sections.map((section) => (
            <a key={section.id} href={'#menu-' + section.id}>
              {localName(section, lang)}
            </a>
          ))}
        </nav>
      )}
      {sections.map((section) => (
        <section key={section.id} id={'menu-' + section.id} className="menu-section">
          <h2>{localName(section, lang)}</h2>
          <ul>
            {section.items.map((item) => (
              <li key={item.id} className={item.available ? '' : 'menu-sold-out'}>
                <div>
                  <b>{localName(item, lang)}</b>
                  {item.description && <small>{item.description}</small>}
                </div>
                <span className="menu-price">
                  {item.available ? formatPrice(item.price, menu.currency, locale) : t('نفد')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
