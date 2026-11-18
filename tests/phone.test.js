import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, validCode } from '../src/phone.js';

test('local Algerian mobiles become +213 numbers', () => {
  assert.equal(normalizePhone('0551 62 10 70'), '+213551621070');
  assert.equal(normalizePhone('0661-23-45-67'), '+213661234567');
  assert.equal(normalizePhone('771234567'), '+213771234567');
  assert.equal(normalizePhone('213551621070'), '+213551621070');
  assert.equal(normalizePhone('00213 551621070'), '+213551621070');
  assert.equal(normalizePhone('+213 551 62 10 70'), '+213551621070');
});

test('foreign numbers need their country code', () => {
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhone('0612345678'), '+213612345678');
});

test('invalid numbers are rejected', () => {
  for (const value of [
    '',
    'abc',
    '0212345678',
    '+2130551621070',
    '05516210',
    '+213 21 12 34 56',
    '+1',
  ])
    assert.equal(normalizePhone(value), null, value);
});

test('codes are six digits', () => {
  assert.equal(validCode('123456'), true);
  assert.equal(validCode(' 123456 '), true);
  assert.equal(validCode('12345'), false);
  assert.equal(validCode('12a456'), false);
});
