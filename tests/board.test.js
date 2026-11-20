import test from 'node:test';
import assert from 'node:assert/strict';
import { boardView } from '../src/boardRules.js';

const now = Date.parse('2026-11-21T12:00:00Z');
const ago = (minutes) => new Date(now - minutes * 60000).toISOString();
const ready = (number, minutes, extra = {}) => ({
  number,
  status: 'ready',
  ready_at: ago(minutes),
  ...extra,
});

test('the newest call is shown big, then the recent ones', () => {
  const view = boardView(
    [ready('12', 3), ready('15', 0.2), ready('14', 1), { number: '16', status: 'preparing' }],
    { now },
  );
  assert.equal(view.latest.number, '15');
  assert.deepEqual(
    view.recent.map((o) => o.number),
    ['14', '12'],
  );
  assert.deepEqual(
    view.preparing.map((o) => o.number),
    ['16'],
  );
});

test('cafés: calls older than 10 minutes and beyond 6 leave the screen', () => {
  const orders = [
    ready('1', 30),
    ...['2', '3', '4', '5', '6', '7', '8'].map((n, i) => ready(n, i + 1)),
  ];
  const view = boardView(orders, { now });
  assert.equal(view.latest.number, '2');
  assert.equal(view.recent.length, 5);
  assert.ok(!view.recent.some((o) => o.number === '1'));
  assert.equal(view.hidden, 2);
});

test('clinics keep their last 4 calls whatever their age', () => {
  const view = boardView(
    [ready('1', 60), ready('2', 50), ready('3', 40), ready('4', 30), ready('5', 20)],
    { clinic: true, now },
  );
  assert.equal(view.latest.number, '5');
  assert.deepEqual(
    view.recent.map((o) => o.number),
    ['4', '3', '2'],
  );
});

test('an empty screen has no latest call', () => {
  assert.equal(boardView([], { now }).latest, null);
});
