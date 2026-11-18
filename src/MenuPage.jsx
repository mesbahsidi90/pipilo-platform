import { t as bippoT } from './i18n.js';
import React, { useEffect, useState } from 'react';
import Brand from './Brand';
import MenuView from './MenuView';
import { branchMenu } from './menu';
import { usePanelTitle } from './pageTitle';
import './menu.css';

// Public menu page: /menu/<branch id>, e.g. from a QR code on the tables.
export default function MenuPage({ branch }) {
  const [menu, setMenu] = useState(undefined);
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
      ) : (
        <MenuView menu={menu} />
      )}
      <footer>
        {bippoT('ساهلة مع ')}
        <Brand />
      </footer>
    </main>
  );
}
