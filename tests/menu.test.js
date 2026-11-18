import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, parsePrice, menuText, localName } from '../src/menuRules.js';

test('prices show without decimals when whole and in the chosen currency', () => {
  assert.match(formatPrice(150, 'DZD', 'fr-DZ'), /150/);
  assert.doesNotMatch(formatPrice(150, 'DZD', 'fr-DZ'), /[.,]00/);
  assert.match(formatPrice(2.5, 'EUR', 'fr-FR'), /2,50/);
  assert.equal(formatPrice(null), '');
});

test('typed prices accept Arabic digits, spaces and a comma', () => {
  assert.equal(parsePrice('150'), 150);
  assert.equal(parsePrice('١٥٠'), 150);
  assert.equal(parsePrice('1 200,50'), 1200.5);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('abc'), undefined);
  assert.equal(parsePrice('1.234'), undefined);
});

test('names are tidied, capped and localised', () => {
  assert.equal(menuText('  قهوة   كبيرة ', 60), 'قهوة كبيرة');
  assert.equal(menuText('x'.repeat(100), 80).length, 80);
  assert.equal(localName({ name: 'قهوة', name_fr: 'Café' }, 'fr'), 'Café');
  assert.equal(localName({ name: 'قهوة', name_fr: '' }, 'fr'), 'قهوة');
});
