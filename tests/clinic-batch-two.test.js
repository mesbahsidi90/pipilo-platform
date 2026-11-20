import test from 'node:test';
import assert from 'node:assert/strict';
import {
  algiersToday,
  becameNear,
  parseRooms,
  queueCompare,
  queuePaused,
} from '../src/clinicRules.js';
import { announcementText } from '../src/announce.js';
import { nearPayload, orderPayload } from '../supabase/functions/order-alerts/payload.js';

const row = (id, created_at, extra = {}) => ({ id, created_at, ...extra });

test('priority patients go first, then time in line', () => {
  const line = [
    row('a', '2026-11-20T09:00:00Z'),
    row('b', '2026-11-20T09:05:00Z', { priority: true }),
    row('c', '2026-11-20T08:00:00Z', { restored_at: '2026-11-20T09:10:00Z' }),
    row('d', '2026-11-20T09:01:00Z'),
  ].sort(queueCompare);
  assert.deepEqual(
    line.map((r) => r.id),
    ['b', 'a', 'd', 'c'],
  );
});

test('rooms typed at reception are cleaned and deduplicated', () => {
  assert.deepEqual(parseRooms(' القاعة 1، د.  سعاد , القاعة 1\n'), ['القاعة 1', 'د. سعاد']);
  assert.deepEqual(parseRooms(''), []);
  assert.equal(parseRooms(Array.from({ length: 12 }, (_, i) => 'R' + i).join(',')).length, 10);
  assert.equal(parseRooms('x'.repeat(40))[0].length, 30);
});

test('«قرب دورك» fires once, when crossing to two or fewer ahead', () => {
  assert.equal(becameNear(null, 1), false);
  assert.equal(becameNear(3, 2), true);
  assert.equal(becameNear(5, 0), true);
  assert.equal(becameNear(2, 1), false);
  assert.equal(becameNear(4, 3), false);
});

test('the pause lasts until midnight in Algeria', () => {
  const evening = Date.parse('2026-11-20T22:30:00Z'); // 23:30 in Algiers
  const after = Date.parse('2026-11-20T23:30:00Z'); // 00:30 the next day
  assert.equal(algiersToday(evening), '2026-11-20');
  assert.equal(queuePaused('2026-11-20', evening), true);
  assert.equal(queuePaused('2026-11-20', after), false);
  assert.equal(queuePaused(null, evening), false);
});

test('called patients hear and read their room', () => {
  assert.equal(
    announcementText('12', { clinic: true, room: 'القاعة 2' }),
    'الرقم 12، تفضّل لـ القاعة 2.',
  );
  assert.equal(announcementText('12', { clinic: true }), 'الرقم 12، تفضّل للاستقبال.');
  const order = { number: '7', token: 't', room: 'د. سعاد', shops: { kind: 'clinic' } };
  assert.match(orderPayload(order).body, /توجّه لـ د\. سعاد/);
  assert.match(orderPayload({ ...order, room: null }).body, /للاستقبال/);
});

test('the near push is a separate, softer notification', () => {
  const near = nearPayload({ number: '7', token: 't', shops: { kind: 'clinic' } });
  assert.equal(near.type, 'QUEUE_NEAR');
  assert.equal(near.title, 'قرب دورك!');
  assert.equal(near.notification.tag, 'near-t');
  assert.equal(near.notification.requireInteraction, false);
  assert.equal(nearPayload({ number: '7', token: 't' }, 'fr').title, 'Votre tour approche !');
});
