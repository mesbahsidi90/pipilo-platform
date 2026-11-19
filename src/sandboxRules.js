// «جرّب لوحة التحكم» at /jarreb: the real merchant screens running on sample
// data kept in this browser tab only, without an account.

export const sandboxPath = '/jarreb';
export const sandboxFlag = 'bipilo-sandbox';

// Pages that always use the real platform; opening one ends the trial.
const realPages = /^\/(?:signup|login|account|admin|reset-password|forgot-password|invite)(?:\/|$)/;

// Whether this page load runs in the trial: started at /jarreb, kept while
// moving around the dashboard and customer pages of the same tab.
export function sandboxActive({ pathname, hash }, flagged) {
  if (pathname === sandboxPath || pathname.startsWith(sandboxPath + '/')) return true;
  if (!flagged) return false;
  if (realPages.test(pathname)) return false;
  if (pathname === '/' && !hash) return false;
  return true;
}

export const sampleShops = {
  cafe: { name: 'مقهى الياسمين', guests: ['سمير', 'أمينة', 'كريم', 'ياسين', 'سارة'] },
  restaurant: { name: 'مطعم البهجة', guests: ['نسيم', 'ليلى', 'وليد', 'هدى', 'رياض'] },
  clinic: { name: 'عيادة الشفاء', guests: ['فاطمة', 'محمد', 'خديجة', 'عمر', 'نوال'] },
  laundry: { name: 'مصبنة النقاء', guests: ['زينب', 'علي', 'مريم', 'حمزة', 'إيمان'] },
  car_wash: { name: 'لافاج الأمل', guests: ['أنيس', 'بلال', 'سليم', 'منير', 'رضا'] },
  tailor: { name: 'خياطة الأناقة', guests: ['نادية', 'سعاد', 'جميلة', 'فريدة', 'وردة'] },
};

const minute = 60000;

// Today's live board (waiting + one ready) plus a week of finished orders
// for the reports. `random` is injectable for tests.
export function sampleOrders(kind, now = Date.now(), random = Math.random) {
  const shop = sampleShops[kind] || sampleShops.cafe;
  const clinic = kind === 'clinic';
  const rows = [];
  const add = (fields) =>
    rows.push({ id: crypto.randomUUID(), token: crypto.randomUUID(), ...fields });
  const iso = (time) => new Date(time).toISOString();
  const first = clinic ? 1 : 40;
  let number = first;

  for (let day = 6; day >= 0; day--) {
    number = first; // numbers restart every day
    const count = day === 0 ? 6 : 8 + Math.floor(random() * 10);
    for (let i = 0; i < count; i++) {
      const created = now - day * 86400000 - (9 - i * 0.4) * 3600000 - random() * 20 * minute;
      if (created > now - 40 * minute) continue;
      const ready = created + (clinic ? 12 : 4 + random() * 9) * minute;
      const collected = ready + (1 + random() * 5) * minute;
      add({
        number: String(number++),
        status: random() < 0.04 ? 'cancelled' : 'collected',
        created_at: iso(created),
        ready_at: iso(ready),
        collected_at: iso(collected),
      });
    }
  }
  shop.guests.forEach((guest, i) => {
    add({
      number: String(number++),
      status: i === 0 ? 'ready' : 'preparing',
      guest_name: guest,
      guest_phone: clinic && i % 2 ? '05501234' + String(10 + i) : undefined,
      created_at: iso(now - (25 - i * 5) * minute),
      ready_at: i === 0 ? iso(now - 3 * minute) : undefined,
    });
  });
  return rows;
}
