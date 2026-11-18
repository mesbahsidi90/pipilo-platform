import { cloud, db, track } from './store';
import { getSettings } from './shopSettings';
import { menuText } from './menuRules';
import { t } from './i18n.js';

// ---- Browser-only demo (no database) ----
const demoKey = 'bipilo-demo-menu';
const readDemo = () => {
  try {
    return { sections: [], items: [], ...JSON.parse(localStorage.getItem(demoKey) || '{}') };
  } catch {
    return { sections: [], items: [] };
  }
};
const writeDemo = (value) => localStorage.setItem(demoKey, JSON.stringify(value));

function nest(sections, items) {
  return sections.map((section) => ({
    ...section,
    items: items.filter((item) => item.section_id === section.id),
  }));
}

function menuError(error) {
  if (error?.message?.includes('BIPILO_MENU_LIMIT'))
    return new Error(t('وصلت للحد: 40 قسم و400 صنف في الفرع.'));
  return error;
}

async function branchId() {
  const { data, error } = await db.rpc('current_shop_id');
  if (error) throw error;
  if (!data) throw new Error(t('حسابك ما راهوش مربوط بمحل.'));
  return data;
}

// Staff: the branch's whole menu, sections with their items.
export async function loadMenu() {
  if (!cloud) {
    const state = readDemo();
    return nest(state.sections, state.items);
  }
  const shop = await branchId();
  const [sections, items] = await Promise.all([
    db.from('menu_sections').select('*').eq('shop_id', shop).order('position').order('created_at'),
    db.from('menu_items').select('*').eq('shop_id', shop).order('position').order('created_at'),
  ]);
  if (sections.error) throw sections.error;
  if (items.error) throw items.error;
  return nest(sections.data, items.data);
}

export async function addSection(name) {
  const row = { name: menuText(name, 60) };
  if (!row.name) throw new Error(t('اكتب اسم القسم.'));
  if (!cloud) {
    const state = readDemo();
    state.sections.push({ id: crypto.randomUUID(), name_fr: '', ...row });
    writeDemo(state);
    return;
  }
  const { error } = await db.from('menu_sections').insert({ ...row, shop_id: await branchId() });
  if (error) throw menuError(error);
}

export async function updateSection(id, patch) {
  const row = {};
  if ('name' in patch) row.name = menuText(patch.name, 60);
  if ('name_fr' in patch) row.name_fr = menuText(patch.name_fr, 60);
  if (row.name === '') throw new Error(t('اكتب اسم القسم.'));
  if (!cloud) {
    const state = readDemo();
    state.sections = state.sections.map((s) => (s.id === id ? { ...s, ...row } : s));
    writeDemo(state);
    return;
  }
  const { error } = await db.from('menu_sections').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteSection(id) {
  if (!cloud) {
    const state = readDemo();
    state.sections = state.sections.filter((s) => s.id !== id);
    state.items = state.items.filter((i) => i.section_id !== id);
    writeDemo(state);
    return;
  }
  const { error } = await db.from('menu_sections').delete().eq('id', id);
  if (error) throw error;
}

function itemRow(patch) {
  const row = {};
  if ('name' in patch) row.name = menuText(patch.name, 80);
  if ('name_fr' in patch) row.name_fr = menuText(patch.name_fr, 80);
  if ('description' in patch) row.description = menuText(patch.description, 200);
  if ('price' in patch) row.price = patch.price;
  if ('available' in patch) row.available = Boolean(patch.available);
  if (row.name === '') throw new Error(t('اكتب اسم الصنف.'));
  return row;
}

export async function addItem(sectionId, item) {
  const row = itemRow({ name_fr: '', description: '', available: true, ...item });
  if (!cloud) {
    const state = readDemo();
    state.items.push({ id: crypto.randomUUID(), section_id: sectionId, ...row });
    writeDemo(state);
    return;
  }
  const { error } = await db
    .from('menu_items')
    .insert({ ...row, section_id: sectionId, shop_id: await branchId() });
  if (error) throw menuError(error);
}

export async function updateItem(id, patch) {
  const row = itemRow(patch);
  if (!cloud) {
    const state = readDemo();
    state.items = state.items.map((i) => (i.id === id ? { ...i, ...row } : i));
    writeDemo(state);
    return;
  }
  const { error } = await db.from('menu_items').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteItem(id) {
  if (!cloud) {
    const state = readDemo();
    state.items = state.items.filter((i) => i.id !== id);
    writeDemo(state);
    return;
  }
  const { error } = await db.from('menu_items').delete().eq('id', id);
  if (error) throw error;
}

async function demoPublicMenu(extra = {}) {
  const settings = await getSettings();
  if (!settings.menu_enabled) return null;
  const state = readDemo();
  return {
    name: settings.name,
    currency: settings.menu_currency || 'DZD',
    ordering: settings.ordering_enabled
      ? { modes: settings.ordering_modes?.length ? settings.ordering_modes : ['pickup'] }
      : null,
    sections: nest(state.sections, state.items),
    ...extra,
  };
}

// Public: a branch's menu (null when the branch has it turned off).
export async function branchMenu(branch) {
  if (!cloud) return demoPublicMenu({ branch: 'demo' });
  const { data, error } = await db.rpc('branch_menu', { branch });
  if (error) throw error;
  return data;
}

// Public: the menu of the branch that issued this ticket.
export async function ticketMenu(ticket) {
  if (!cloud) return (await track(ticket)) ? demoPublicMenu({ branch: 'demo' }) : null;
  const { data, error } = await db.rpc('ticket_menu', { ticket });
  if (error) throw error;
  return data;
}

export const menuLink = (branch) => `${location.origin}/menu/${branch}`;
