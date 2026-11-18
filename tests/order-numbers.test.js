import test from 'node:test';
import assert from 'node:assert/strict';
import { nextOrderNumber } from '../src/orderNumbers.js';

const now = new Date('2026-11-18T12:00:00');
const today = '2026-11-18T09:00:00';
const yesterday = '2026-11-17T09:00:00';

test('starts at 1 each day', () => {
  assert.equal(nextOrderNumber([], now), '1');
  assert.equal(
    nextOrderNumber([{ number: '40', status: 'collected', created_at: yesterday }], now),
    '1',
  );
});

test('continues after the highest number used today', () => {
  const orders = [
    { number: '12', status: 'collected', created_at: today },
    { number: '7', status: 'ready', created_at: today },
  ];
  assert.equal(nextOrderNumber(orders, now), '13');
});

test('skips numbers still active and wraps after 9999', () => {
  const orders = [
    { number: '9999', status: 'collected', created_at: today },
    { number: '1', status: 'ready', created_at: yesterday },
    { number: '2', status: 'preparing', created_at: yesterday },
  ];
  assert.equal(nextOrderNumber(orders, now), '3');
});
