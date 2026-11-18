import test from 'node:test';
import assert from 'node:assert/strict';

import { loyaltyProgress, deviceKey, GIFT_STAMPS } from '../src/loyaltyRules.js';

test('a new card starts with the two gift stamps', () => {
  assert.deepEqual(loyaltyProgress({ stamps: 0, goal: 9 }), {
    goal: 9,
    stamps: 2,
    complete: false,
  });
});

test('the card completes at the goal and never shows more than it', () => {
  assert.equal(loyaltyProgress({ stamps: 7, goal: 9 }).complete, true);
  assert.equal(loyaltyProgress({ stamps: 10, goal: 9 }).stamps, 9);
  assert.equal(loyaltyProgress({ stamps: 6, goal: 9 }).complete, false);
});

test('a redemption starts a new card with the gifts plus extra stamps', () => {
  const goal = 7;
  const after = loyaltyProgress({ stamps: 6, used: goal - GIFT_STAMPS, goal });
  assert.deepEqual(after, { goal, stamps: 3, complete: false });
});

test('the device key is created once and reused', () => {
  const storage = {
    value: null,
    getItem() {
      return this.value;
    },
    setItem(_, v) {
      this.value = v;
    },
  };
  const first = deviceKey(storage);
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.equal(deviceKey(storage), first);
});
