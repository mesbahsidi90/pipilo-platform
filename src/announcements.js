// Announcements from the platform admins to the shops' dashboards.
import { cloud, db } from './store';
import { isLive } from './announcementRules';
export { announcementBody, cleanAnnouncement, isLive } from './announcementRules';

const demoKey = 'bipilo-demo-announcements';
const demoSeenKey = 'bipilo-demo-announcements-seen';

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Demo only.
  }
};
function check({ data, error }) {
  if (error) throw error;
  return data;
}

export async function myAnnouncements() {
  if (cloud) return check(await db.rpc('my_announcements')) || [];
  const seen = new Set(readJson(demoSeenKey, []));
  return readJson(demoKey, [])
    .filter((item) => isLive(item) && item.audience !== 'paid' && !seen.has(item.id))
    .slice(0, 3);
}

export async function dismissAnnouncement(id) {
  if (cloud) return check(await db.rpc('dismiss_announcement', { target: id }));
  writeJson(demoSeenKey, [...new Set([...readJson(demoSeenKey, []), id])]);
  return true;
}

export async function adminAnnouncements() {
  if (cloud) return check(await db.rpc('admin_announcements')) || [];
  const seen = readJson(demoSeenKey, []);
  return readJson(demoKey, []).map((item) => ({
    ...item,
    live: isLive(item),
    dismissed: seen.includes(item.id) ? 1 : 0,
  }));
}

export async function postAnnouncement(value) {
  if (cloud) return check(await db.rpc('admin_post_announcement', value));
  const item = { ...value, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  writeJson(demoKey, [item, ...readJson(demoKey, [])].slice(0, 50));
  return item.id;
}

export async function endAnnouncement(id) {
  if (cloud) return check(await db.rpc('admin_end_announcement', { target: id }));
  writeJson(
    demoKey,
    readJson(demoKey, []).map((item) =>
      item.id === id ? { ...item, ended_at: new Date().toISOString() } : item,
    ),
  );
  return true;
}
