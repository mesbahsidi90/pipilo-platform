import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPhone, waitedMinutes, whatsappLink } from '../src/clinicRules.js';
import { validTransition } from '../src/domain.js';

test('reception phone cleanup', () => {
  assert.equal(cleanPhone(''), null);
  assert.equal(cleanPhone(' 0550 12-34.56 '), '0550123456');
  assert.equal(cleanPhone('+213 550 00 00 00'), '+213550000000');
  assert.equal(cleanPhone('12ab'), false);
  assert.equal(cleanPhone('123'), false);
});

test('WhatsApp link adds the Algerian prefix to local mobiles', () => {
  assert.equal(whatsappLink('0550123456'), 'https://wa.me/213550123456');
  assert.equal(whatsappLink('+213550123456'), 'https://wa.me/213550123456');
  assert.equal(whatsappLink('+966557036919'), 'https://wa.me/966557036919');
  assert.equal(whatsappLink(''), null);
});

test('waiting minutes count from rejoining the line', () => {
  const now = Date.parse('2026-11-19T10:30:00Z');
  assert.equal(waitedMinutes({ created_at: '2026-11-19T10:00:00Z' }, now), 30);
  assert.equal(
    waitedMinutes({ created_at: '2026-11-19T09:00:00Z', restored_at: '2026-11-19T10:25:30Z' }, now),
    4,
  );
});

test('only clinics can mark a called patient absent', () => {
  assert.equal(validTransition('ready', 'cancelled'), false);
  assert.ok(validTransition('ready', 'cancelled', { clinic: true }));
  assert.equal(validTransition('collected', 'cancelled', { clinic: true }), false);
});
