import { t as bippoT } from './i18n.js';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ExternalLink, Copy } from 'lucide-react';
import {
  loadMenu,
  addSection,
  updateSection,
  deleteSection,
  addItem,
  updateItem,
  deleteItem,
  menuLink,
} from './menu';
import { MENU_CURRENCIES, parsePrice } from './menuRules';
import { cloud } from './store';
import './menu.css';

const currencyNames = {
  DZD: 'دينار جزائري (DZD)',
  EUR: 'يورو (EUR)',
  USD: 'دولار (USD)',
  MAD: 'درهم مغربي (MAD)',
  TND: 'دينار تونسي (TND)',
};

function ItemRow({ item, run }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price ?? '');
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={'menu-editor-item' + (item.available ? '' : ' sold')}>
      <input
        aria-label={bippoT('اسم الصنف')}
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== item.name && run(() => updateItem(item.id, { name }))}
      />
      <input
        aria-label={bippoT('السعر')}
        inputMode="decimal"
        dir="ltr"
        placeholder={bippoT('السعر')}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={() => {
          const value = parsePrice(price);
          if (value === undefined)
            return run(() => Promise.reject(new Error(bippoT('السعر ماشي صحيح.'))));
          if (value !== (item.price ?? null)) run(() => updateItem(item.id, { price: value }));
        }}
      />
      <label>
        <input
          type="checkbox"
          checked={!item.available}
          onChange={(e) => run(() => updateItem(item.id, { available: !e.target.checked }))}
        />
        {bippoT('نفد')}
      </label>
      <button
        type="button"
        className={confirm ? 'button small' : 'icon-button'}
        aria-label={bippoT('احذف الصنف')}
        onClick={() => (confirm ? run(() => deleteItem(item.id)) : setConfirm(true))}
        onBlur={() => setConfirm(false)}
      >
        {confirm ? bippoT('أكّد الحذف') : <Trash2 size={17} />}
      </button>
    </div>
  );
}

function SectionBlock({ section, run }) {
  const [name, setName] = useState(section.name);
  const [draft, setDraft] = useState({ name: '', price: '' });
  const [confirm, setConfirm] = useState(false);
  async function add(e) {
    e.preventDefault();
    const price = parsePrice(draft.price);
    if (price === undefined)
      return run(() => Promise.reject(new Error(bippoT('السعر ماشي صحيح.'))));
    if (await run(() => addItem(section.id, { name: draft.name, price })))
      setDraft({ name: '', price: '' });
  }
  return (
    <section className="menu-editor-section">
      <header>
        <input
          aria-label={bippoT('اسم القسم')}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== section.name && run(() => updateSection(section.id, { name }))}
        />
        <button
          type="button"
          className={confirm ? 'button small' : 'icon-button'}
          aria-label={bippoT('احذف القسم')}
          onClick={() => (confirm ? run(() => deleteSection(section.id)) : setConfirm(true))}
          onBlur={() => setConfirm(false)}
        >
          {confirm ? bippoT('احذف القسم وأصنافه') : <Trash2 size={17} />}
        </button>
      </header>
      {section.items.map((item) => (
        <ItemRow key={item.id + ':' + item.available} item={item} run={run} />
      ))}
      <form className="menu-editor-add" onSubmit={add}>
        <input
          aria-label={bippoT('صنف جديد')}
          placeholder={bippoT('صنف جديد، مثلًا كابوتشينو')}
          maxLength={80}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <input
          aria-label={bippoT('السعر')}
          placeholder={bippoT('السعر')}
          inputMode="decimal"
          dir="ltr"
          value={draft.price}
          onChange={(e) => setDraft({ ...draft, price: e.target.value })}
        />
        <button className="button small" disabled={!draft.name.trim()}>
          <Plus size={16} />
          {bippoT('زيد')}
        </button>
      </form>
    </section>
  );
}

// Staff menu editor: currency, sections, items, sold-out switches, public link.
export default function MenuEditor({ settings, onCurrency }) {
  const [sections, setSections] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [newSection, setNewSection] = useState('');
  const link = cloud && settings?.shop_id ? menuLink(settings.shop_id) : null;

  async function refresh() {
    setSections(await loadMenu());
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  // Runs one change, then reloads the menu; returns whether it worked.
  async function run(action) {
    setError('');
    setNotice('');
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      setError(e.message || bippoT('تعذر حفظ التغيير. عاود المحاولة.'));
      return false;
    }
  }

  return (
    <div className="feature-settings menu-editor">
      <div className="menu-editor-top">
        <label>
          {bippoT('العملة')}
          <select
            value={settings?.menu_currency || 'DZD'}
            onChange={(e) => onCurrency(e.target.value)}
          >
            {MENU_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {bippoT(currencyNames[code])}
              </option>
            ))}
          </select>
        </label>
        {link && (
          <div className="menu-link">
            <code>{link}</code>
            <button
              type="button"
              className="button outline small"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(link)
                  .then(() => setNotice(bippoT('نُسخ الرابط')))
                  .catch(() => setError(bippoT('تعذر نسخ الرابط.')))
              }
            >
              <Copy size={15} />
              {bippoT('نسخ الرابط')}
            </button>
            <a
              className="button outline small"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={15} />
              {bippoT('افتح المنيو')}
            </a>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!sections ? (
        <p role="status">{bippoT('نحمّلو المنيو…')}</p>
      ) : (
        sections.map((section) => (
          <SectionBlock key={section.id + ':' + section.items.length} section={section} run={run} />
        ))
      )}
      <form
        className="menu-editor-add"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => addSection(newSection))) setNewSection('');
        }}
      >
        <input
          aria-label={bippoT('قسم جديد')}
          placeholder={bippoT('قسم جديد، مثلًا المشروبات الساخنة')}
          maxLength={60}
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
        />
        <button className="button small" disabled={!newSection.trim()}>
          <Plus size={16} />
          {bippoT('زيد قسم')}
        </button>
      </form>
    </div>
  );
}
