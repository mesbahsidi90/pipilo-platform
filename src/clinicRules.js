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
