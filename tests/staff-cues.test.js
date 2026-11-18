import test from 'node:test';
import assert from 'node:assert/strict';
import { staffCues, UNREACHED_AFTER_MS } from '../src/staffCues.js';

const now = Date.parse('2026-11-18T12:00:00Z');
const readyAgo = (ms) => new Date(now - ms).toISOString();

test('first load never rings for customers already coming', () => {
  const orders = [{ id: 'a', number: '5', status: 'ready', guest: { coming_at: 'x' } }];
  assert.deepEqual(staffCues(null, orders, now).coming, []);
});

test('rings once when a customer starts coming', () => {
  const before = [{ id: 'a', number: '5', status: 'ready', ready_at: readyAgo(1000), guest: {} }];
  const first = staffCues(null, before, now);
  const after = [{ ...before[0], guest: { coming_at: 'x' } }];
  const second = staffCues(first.state, after, now);
  assert.deepEqual(second.coming, ['5']);
  assert.deepEqual(staffCues(second.state, after, now).coming, []);
});

test('flags a ready order nobody has seen after a minute, once', () => {
  const orders = [
    {
      id: 'a',
      number: '7',
      status: 'ready',
      ready_at: readyAgo(UNREACHED_AFTER_MS + 1),
      guest: null,
    },
    { id: 'b', number: '8', status: 'ready', ready_at: readyAgo(10_000), guest: null },
    {
      id: 'c',
      number: '9',
      status: 'ready',
      ready_at: readyAgo(UNREACHED_AFTER_MS * 2),
      guest: { push_enabled_at: 'x' },
    },
  ];
  const first = staffCues(null, orders, now);
  assert.deepEqual(first.unreached, ['7']);
  assert.deepEqual(staffCues(first.state, orders, now).unreached, []);
});

test('collected and preparing orders are ignored', () => {
  const orders = [
    { id: 'a', number: '1', status: 'collected', guest: { coming_at: 'x' } },
    { id: 'b', number: '2', status: 'preparing', ready_at: readyAgo(UNREACHED_AFTER_MS * 3) },
  ];
  const result = staffCues({ coming: new Set(), unreached: new Set() }, orders, now);
  assert.deepEqual([result.coming, result.unreached], [[], []]);
});

test('rings once for a new phone order waiting to be accepted', () => {
  const before = [];
  const first = staffCues(null, before, now);
  const after = [
    { id: 'p', number: '12', status: 'preparing', order_mode: 'table', accepted_at: null },
  ];
  const second = staffCues(first.state, after, now);
  assert.deepEqual(second.incoming, ['12']);
  assert.deepEqual(staffCues(second.state, after, now).incoming, []);
  const accepted = [{ ...after[0], accepted_at: 'x' }];
  assert.deepEqual(staffCues(second.state, accepted, now).incoming, []);
});
