import { cloud, db } from './store';

// Base URL of the POS API (server-to-server).
export const POS_API_URL = 'https://kdvtqlqiervznhzbpjcx.supabase.co/functions/v1/pos-api/v1';

const demoKey = 'bipilo-demo-pos-keys';
function demoRead() {
  try {
    return JSON.parse(localStorage.getItem(demoKey) || '[]');
  } catch {
    return [];
  }
}
function demoWrite(rows) {
  try {
    localStorage.setItem(demoKey, JSON.stringify(rows));
  } catch {
    // Demo only.
  }
}
function demoSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return 'bpk_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listPosKeys() {
  if (!cloud) return demoRead();
  const { data, error } = await db.rpc('pos_keys_list');
  if (error) throw error;
  return data || [];
}

// Returns { key, prefix, label } once, or { error }.
export async function createPosKey(label) {
  if (!cloud) {
    const rows = demoRead();
    if (rows.length >= 5) return { error: 'too_many' };
    const key = demoSecret();
    const name = label.trim().slice(0, 60) || 'POS';
    demoWrite([
      {
        id: crypto.randomUUID(),
        label: name,
        prefix: key.slice(0, 12),
        created_at: new Date().toISOString(),
        last_used_at: null,
      },
      ...rows,
    ]);
    return { key, prefix: key.slice(0, 12), label: name };
  }
  const { data, error } = await db.rpc('pos_key_create', { label });
  if (error) throw error;
  return data;
}

export async function revokePosKey(id) {
  if (!cloud) {
    demoWrite(demoRead().filter((row) => row.id !== id));
    return true;
  }
  const { data, error } = await db.rpc('pos_key_revoke', { target: id });
  if (error) throw error;
  return data;
}
