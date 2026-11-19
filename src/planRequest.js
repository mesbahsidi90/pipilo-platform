import { cloud, db } from './store';
import { demoAdminKey } from './planConfig';

// Demo: requests are kept with the demo admin data, so /admin shows them.
function demoData() {
  try {
    return JSON.parse(localStorage.getItem(demoAdminKey) || 'null');
  } catch {
    return null;
  }
}

export async function myPlanRequest() {
  if (!cloud) {
    const request = demoData()?.requests?.[0];
    return request ? { status: 'open', created_at: request.created_at } : null;
  }
  const { data, error } = await db.rpc('my_plan_request');
  if (error) throw error;
  return data;
}

// Returns { status: 'open', created_at } or { error }.
export async function requestPlanUpgrade(note) {
  if (!cloud) {
    const data = demoData();
    if (!data?.shops?.length) return { error: 'forbidden' };
    const existing = data.requests?.[0];
    if (existing) return { status: 'open', created_at: existing.created_at };
    const request = {
      id: crypto.randomUUID(),
      shop_id: data.shops[0].id,
      note: note.trim().slice(0, 300) || null,
      created_at: new Date().toISOString(),
    };
    data.requests = [request];
    localStorage.setItem(demoAdminKey, JSON.stringify(data));
    return { status: 'open', created_at: request.created_at };
  }
  const { data, error } = await db.rpc('request_plan_upgrade', { note });
  if (error) throw error;
  return data;
}
