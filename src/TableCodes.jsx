import { t as bippoT } from './i18n.js';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import Brand from './Brand';
import { cloud } from './store';
import { menuLink } from './menu';
import { MAX_TABLE_CODES, tableMenuLink, tableRange } from './orderingRules';
import { printWithTitle } from './pageTitle';

const storageKey = 'bipilo-table-codes';

function savedRange() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return { from: value.from || 1, to: value.to || 10 };
  } catch {
    return { from: 1, to: 10 };
  }
}

function TableCard({ name, table, link }) {
  return (
    <article className="table-code">
      <strong>{name}</strong>
      <span className="table-code-number">{bippoT('طاولة {0}', [table])}</span>
      <QRCodeSVG value={link} size={150} level="M" marginSize={3} />
      <p>{bippoT('امسح الكود واطلب من تليفونك')}</p>
      <Brand linked={false} />
    </article>
  );
}

// Printable sheet: one QR per table that opens the menu with the table chosen.
export default function TableCodes({ settings }) {
  const [range, setRange] = useState(savedRange);
  const branch = cloud ? settings.shop_id : 'demo';
  if (!branch) return null;
  const base = menuLink(branch);
  const tables = tableRange(range.from, range.to);
  const name = settings.name || bippoT('المحل');
  function update(key, value) {
    const next = { ...range, [key]: value };
    setRange(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Remembering the range is only a convenience.
    }
  }
  const cards = tables.map((table) => (
    <TableCard key={table} name={name} table={table} link={tableMenuLink(base, table)} />
  ));
  return (
    <div className="table-codes">
      <div className="table-codes-range">
        <label>
          {bippoT('من طاولة')}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            value={range.from}
            onChange={(e) => update('from', e.target.value)}
          />
        </label>
        <label>
          {bippoT('حتى طاولة')}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            value={range.to}
            onChange={(e) => update('to', e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button small"
          disabled={!tables.length}
          onClick={() => printWithTitle(bippoT('أكواد الطاولات'))}
        >
          <Printer size={16} aria-hidden="true" />
          {bippoT('اطبع {0} كود', [tables.length])}
        </button>
      </div>
      <small className="hint">
        {tables.length
          ? bippoT(
              'كل كود يفتح المنيو والطاولة مختارة. حطّو على الطاولة باش الزبون يطلب ويستلم في بلاصتو.',
            )
          : bippoT('اكتب أرقام طاولات صحيحة.')}
        {Number(range.to) - Number(range.from) + 1 > MAX_TABLE_CODES &&
          ' ' + bippoT('الحد {0} طاولة في المرة.', [MAX_TABLE_CODES])}
      </small>
      {tables.length > 0 && <div className="table-codes-preview">{cards.slice(0, 3)}</div>}
      {tables.length > 0 &&
        createPortal(
          <div className="receipt-print-root table-codes-print">{cards}</div>,
          document.body,
        )}
    </div>
  );
}
