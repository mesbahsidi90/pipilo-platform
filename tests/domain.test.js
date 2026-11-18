import { test } from 'node:test';
import assert from 'node:assert/strict';
import { active, normalizeNumber, validTransition } from '../src/domain.js';
test('Arabic numerals and leading zeroes normalize to the same active identifier', () => {
  assert.equal(normalizeNumber(' ٠١٠٢ '), '102');
  assert.equal(normalizeNumber('0102'), '102');
});
test('reject unsafe or invalid order identifiers', () => {
  for (const n of ['0', '-1', '1.5', '10000', '<script>', '', '1e2'])
    assert.throws(() => normalizeNumber(n));
});
test('invalid lifecycle jumps are rejected', () => {
  assert.ok(validTransition('preparing', 'ready'));
  assert.ok(validTransition('ready', 'collected'));
  assert.equal(validTransition('preparing', 'collected'), false);
  assert.equal(validTransition('collected', 'ready'), false);
  assert.equal(validTransition('ready', 'ready'), false);
});

test('cancelled orders leave the active queue and can return only to preparation', () => {
  assert.ok(validTransition('preparing', 'cancelled'));
  assert.ok(validTransition('cancelled', 'preparing'));
  assert.equal(validTransition('cancelled', 'ready'), false);
  assert.equal(validTransition('ready', 'cancelled'), false);
  assert.equal(active({ status: 'cancelled' }), false);
  assert.equal(active({ status: 'collected' }), false);
  assert.equal(active({ status: 'preparing' }), true);
  assert.equal(active({ status: 'ready' }), true);
});
