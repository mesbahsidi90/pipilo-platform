import test from 'node:test';
import assert from 'node:assert/strict';
import { cartLines, changeQty, cartSummary, checkoutProblem } from '../src/orderingRules.js';

const menu = {
  sections: [
    {
      items: [
        { id: 'a', price: 150, available: true },
        { id: 'b', price: 120, available: false },
        { id: 'c', price: null, available: true },
      ],
    },
  ],
};

test('quantities stay between 0 and 20 and empty lines disappear', () => {
  let cart = changeQty({}, 'a', 1);
  cart = changeQty(cart, 'a', 1);
  assert.deepEqual(cart, { a: 2 });
  assert.deepEqual(changeQty(cart, 'a', -5), {});
  assert.equal(changeQty({ a: 20 }, 'a', 1).a, 20);
  assert.deepEqual(cartLines({ a: 2, b: 0 }), [{ id: 'a', qty: 2 }]);
});

test('summary counts only available items and treats missing prices as 0', () => {
  assert.deepEqual(cartSummary({ a: 2, b: 1, c: 1 }, menu), { count: 3, total: 300 });
});

test('each mode asks for what it needs', () => {
  const lines = [{ id: 'a', qty: 1 }];
  assert.equal(checkoutProblem('pickup', { lines }), null);
  assert.equal(checkoutProblem('pickup', {}), 'empty');
  assert.equal(checkoutProblem('pickup', { note: '2 قهوة' }), null);
  assert.equal(checkoutProblem('table', { lines }), 'table');
  assert.equal(checkoutProblem('table', { lines, table: '5' }), null);
  assert.equal(checkoutProblem('car', { lines }), 'plate');
  assert.equal(checkoutProblem('boat', { lines }), 'mode');
});

test('table QR range and links', async () => {
  const { tableRange, tableMenuLink, MAX_TABLE_CODES } = await import('../src/orderingRules.js');
  assert.deepEqual(tableRange(1, 4), [1, 2, 3, 4]);
  assert.deepEqual(tableRange('3', '3'), [3]);
  assert.deepEqual(tableRange(5, 2), []);
  assert.deepEqual(tableRange(0, 2), [1, 2]);
  assert.equal(tableRange(1, 500).length, MAX_TABLE_CODES);
  assert.equal(
    tableMenuLink('https://bipilo.app/menu/abc', 7),
    'https://bipilo.app/menu/abc?mode=table&table=7',
  );
});
