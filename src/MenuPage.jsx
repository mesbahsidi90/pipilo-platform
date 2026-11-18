import { t as bippoT, locale } from './i18n.js';
import React, { useEffect, useState } from 'react';
import Brand from './Brand';
import MenuView from './MenuView';
import OrderCheckout from './OrderCheckout';
import { branchMenu } from './menu';
import { formatPrice } from './menuRules';
import { cartSummary, changeQty } from './orderingRules';
import { usePanelTitle } from './pageTitle';
import './menu.css';

// Public menu page: /menu/<branch id>, e.g. from a QR code on the tables.
// With ordering on: /menu/<branch>?mode=table&table=5 preselects the table.
export default function MenuPage({ branch }) {
  const [menu, setMenu] = useState(undefined),
    [cart, setCart] = useState({}),
    [checkout, setCheckout] = useState(false);
  const params = new URLSearchParams(location.search);
  usePanelTitle(menu?.name ? bippoT('منيو {0}', [menu.name]) : bippoT('المنيو'));
  useEffect(() => {
    let alive = true;
    const valid = /^[0-9a-f-]{36}$/i.test(branch || '') || branch === 'demo';
    if (!valid) {
      setMenu(null);
      return;
    }
    branchMenu(branch)
      .then((value) => alive && setMenu(value || null))
      .catch(() => alive && setMenu(null));
    return () => {
      alive = false;
    };
  }, [branch]);
  const ordering = Boolean(menu?.ordering);
  const { count, total } = cartSummary(cart, menu);
  return (
    <main className="menu-page">
      <header>
        <div>
          <h1>{menu?.name || bippoT('المنيو')}</h1>
          {menu?.name && <small>{bippoT('المنيو')}</small>}
        </div>
      </header>
      {menu === undefined ? (
        <p role="status">{bippoT('نحمّلو المنيو…')}</p>
      ) : menu === null ? (
        <p className="menu-empty">{bippoT('هذا المنيو غير متاح حاليًا.')}</p>
      ) : checkout ? (
        <OrderCheckout
          branch={branch}
          menu={menu}
          cart={cart}
          initialMode={params.get('mode')}
          initialTable={(params.get('table') || '').slice(0, 10)}
          onBack={() => setCheckout(false)}
        />
      ) : (
        <>
          <MenuView
            menu={menu}
            cart={ordering ? cart : undefined}
            onQty={ordering ? (id, delta) => setCart((c) => changeQty(c, id, delta)) : undefined}
          />
          {ordering && (
            <button type="button" className="cart-bar" onClick={() => setCheckout(true)}>
              <span>
                {count ? bippoT('كمّل الطلب ({0})', [count]) : bippoT('اطلب من التليفون')}
              </span>
              {count > 0 && <span>{formatPrice(total, menu.currency, locale)}</span>}
            </button>
          )}
        </>
      )}
      <footer>
        {bippoT('ساهلة مع ')}
        <Brand />
      </footer>
    </main>
  );
}
