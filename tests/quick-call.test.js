import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callAction, calledOrders, cleanCallNumber } from '../src/quickCallRules.js';

test('the invoice number keeps digits only, Arabic digits included, no leading zeros', () => {
  assert.equal(cleanCallNumber('0057'), '57');
  assert.equal(cleanCallNumber('٥٧'), '57');
  assert.equal(cleanCallNumber('N° 1 2 3'), '123');
  assert.equal(cleanCallNumber('0'), '0');
  assert.equal(cleanCallNumber('123456789'), '12345678');
  assert.equal(cleanCallNumber(''), '');
});

test('«نادي» adds a new number, calls a waiting one, and knows one already called', () => {
  const rows = [
    { id: 'a', number: '57', status: 'ready' },
    { id: 'b', number: '58', status: 'preparing' },
    { id: 'c', number: '59', status: 'collected' },
  ];
  assert.deepEqual(callAction(rows, '60'), { type: 'create' });
  assert.deepEqual(callAction(rows, '59'), { type: 'create' }, 'a collected number can be reused');
  assert.equal(callAction(rows, '58').type, 'ready');
  assert.equal(callAction(rows, '58').order.id, 'b');
  assert.equal(callAction(rows, '57').type, 'already');
});

test('the called list shows ready numbers, newest call first', () => {
  const rows = [
    { id: 'a', number: '1', status: 'ready', ready_at: '2026-11-23T10:00:00Z' },
    { id: 'b', number: '2', status: 'ready', ready_at: '2026-11-23T10:05:00Z' },
    { id: 'c', number: '3', status: 'preparing' },
    { id: 'd', number: '4', status: 'collected', ready_at: '2026-11-23T10:06:00Z' },
  ];
  assert.deepEqual(
    calledOrders(rows).map((o) => o.number),
    ['2', '1'],
  );
  assert.equal(calledOrders(rows, 1).length, 1);
});
