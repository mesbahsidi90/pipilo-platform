import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTrialTickets } from '../src/trialRules.js';

const local = [
  { id: 'a', token: 't-own', number: '5', status: 'preparing', counter_pending: true },
  { id: 'b', token: 't-new', number: '6', status: 'preparing' },
  { id: 'c', token: 't-old', number: '1', status: 'collected' },
];

test('a phone-made ticket joins the trial board, owner tickets are not duplicated', () => {
  const remote = {
    't-own': {
      token: 't-own',
      origin: 'owner',
      counter_pending: true,
      number: '5',
      status: 'preparing',
    },
    't-join': {
      token: 't-join',
      origin: 'join',
      number: '7',
      status: 'preparing',
      created_at: 'x',
    },
  };
  const { orders, changed, missing } = mergeTrialTickets(local, remote);
  assert.equal(changed, true);
  assert.equal(orders.length, 4);
  assert.equal(orders[0].token, 't-join');
  assert.equal(orders[0].number, '7');
  // Local active orders the server never saw are copied once; finished ones are not.
  assert.deepEqual(
    missing.map((o) => o.token),
    ['t-new'],
  );
});

test('a counter order claimed by a phone stops waiting on the board', () => {
  const remote = { 't-own': { token: 't-own', origin: 'counter', counter_pending: false } };
  const { orders, changed } = mergeTrialTickets(local, remote);
  assert.equal(changed, true);
  assert.equal(orders.find((o) => o.token === 't-own').counter_pending, false);
});

test('nothing new, nothing changes', () => {
  const remote = { 't-own': { token: 't-own', origin: 'owner', counter_pending: true } };
  assert.equal(mergeTrialTickets(local, remote).changed, false);
});
