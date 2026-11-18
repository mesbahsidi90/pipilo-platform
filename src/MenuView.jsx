import { language, locale as viewerLocale, translate } from './i18n.js';
import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatPrice, localName } from './menuRules';
import './menu.css';

// Customer menu: sections, items, prices, sold-out marks. With `onQty` it
// also shows − / + buttons for ordering from the phone.
export default function MenuView({ menu, lang = language, heading = true, cart, onQty }) {
  const t = (text, values) => translate(text, lang, values);
  const locale = lang === 'fr' ? 'fr-DZ' : viewerLocale;
  const sections = (menu?.sections || []).filter((s) => s.items?.length);
  if (!sections.length) return <p className="menu-empty">{t('المنيو مازال فارغ.')}</p>;
  // Scroll without touching the URL: the order page routes on the hash.
  const jump = (id) => (event) => {
    event.preventDefault();
    document.getElementById('menu-' + id)?.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <div className="menu-view" dir={lang === 'fr' ? 'ltr' : 'rtl'}>
      {heading && sections.length > 1 && (
        <nav className="menu-jump" aria-label={t('أقسام المنيو')}>
          {sections.map((section) => (
            <a key={section.id} href={'#menu-' + section.id} onClick={jump(section.id)}>
              {localName(section, lang)}
            </a>
          ))}
        </nav>
      )}
      {sections.map((section) => (
        <section key={section.id} id={'menu-' + section.id} className="menu-section">
          <h2>{localName(section, lang)}</h2>
          <ul>
            {section.items.map((item) => {
              const qty = cart?.[item.id] || 0;
              const name = localName(item, lang);
              return (
                <li key={item.id} className={item.available ? '' : 'menu-sold-out'}>
                  <div>
                    <b>{name}</b>
                    {item.description && <small>{item.description}</small>}
                    {onQty && item.available && (
                      <span className="menu-price menu-price-under">
                        {formatPrice(item.price, menu.currency, locale)}
                      </span>
                    )}
                  </div>
                  {onQty && item.available ? (
                    <span className="menu-qty">
                      {qty > 0 && (
                        <>
                          <button
                            type="button"
                            aria-label={t('نقّص {0}', [name])}
                            onClick={() => onQty(item.id, -1)}
                          >
                            <Minus size={16} />
                          </button>
                          <b aria-live="polite">{qty}</b>
                        </>
                      )}
                      <button
                        type="button"
                        className="menu-qty-add"
                        aria-label={t('زيد {0}', [name])}
                        onClick={() => onQty(item.id, 1)}
                      >
                        <Plus size={16} />
                      </button>
                    </span>
                  ) : (
                    <span className="menu-price">
                      {item.available ? formatPrice(item.price, menu.currency, locale) : t('نفد')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
