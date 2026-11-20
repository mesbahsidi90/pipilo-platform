// Phone typed at reception: null when empty, false when invalid, else digits (+ allowed).
export function cleanPhone(raw) {
  const value = String(raw || '').replace(/[\s().-]/g, '');
  if (!value) return null;
  return /^\+?[0-9]{6,15}$/.test(value) ? value : false;
}

// WhatsApp link; local Algerian numbers (0XXXXXXXXX) get the 213 prefix.
export function whatsappLink(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (/^0[5-7][0-9]{8}$/.test(digits)) digits = '213' + digits.slice(1);
  return 'https://wa.me/' + digits;
}

// Whole minutes a patient has been waiting since joining (or rejoining) the line.
export function waitedMinutes(order, now = Date.now()) {
  const since = Date.parse(order.restored_at || order.created_at);
  return Number.isFinite(since) ? Math.max(0, Math.floor((now - since) / 60000)) : 0;
}

// Line order: priority patients first, then time in line, then id (same as the server).
export function queueCompare(a, b) {
  const since = (row) => row.restored_at || row.created_at;
  return (
    Number(Boolean(b.priority)) - Number(Boolean(a.priority)) ||
    since(a).localeCompare(since(b)) ||
    a.id.localeCompare(b.id)
  );
}

// Rooms or doctors typed at reception: «القاعة 1، د. سعاد» → ['القاعة 1', 'د. سعاد'].
export function parseRooms(raw) {
  const rooms = [];
  for (const part of String(raw || '').split(/[,،\n]/)) {
    const room = part.replace(/\s+/g, ' ').trim().slice(0, 30);
    if (room && !rooms.includes(room)) rooms.push(room);
  }
  return rooms.slice(0, 10);
}

// «قرب دورك»: true once, when the patient moves from more than two ahead to two or fewer.
export const nearLimit = 2;
export function becameNear(previous, ahead) {
  return (
    typeof previous === 'number' &&
    typeof ahead === 'number' &&
    previous > nearLimit &&
    ahead <= nearLimit
  );
}

// Today's date in Algeria, as the server stores «وقّف الأرقام».
export function algiersToday(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(now);
}
export const queuePaused = (pausedOn, now = Date.now()) =>
  Boolean(pausedOn) && pausedOn === algiersToday(now);
