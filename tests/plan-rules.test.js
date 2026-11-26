import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultEnd, extendEnd, planLines, planRow, subscriptionState } from '../src/planRules.js';

test('the end date follows the billing type, month ends included', () => {
  assert.equal(defaultEnd('monthly', '2026-11-26'), '2026-12-26');
  assert.equal(defaultEnd('monthly', '2027-01-31'), '2027-02-28');
  assert.equal(defaultEnd('yearly', '2026-11-26'), '2027-11-26');
  assert.equal(defaultEnd('once', '2026-11-26'), '');
  assert.equal(defaultEnd('free', '2026-11-26'), '');
  assert.equal(defaultEnd('monthly', ''), '');
});

test('extending adds to the end date, or from today once it has passed', () => {
  assert.equal(extendEnd('2026-12-26', 1, '2026-11-26'), '2027-01-26');
  assert.equal(extendEnd('2026-10-01', 12, '2026-11-26'), '2027-11-26');
  assert.equal(extendEnd('', 1, '2026-11-26'), '2026-12-26');
});

test('a subscription is upcoming, active, ending, in grace, then expired', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const sub = (started_at, period_end, status = 'active') => ({ status, started_at, period_end });
  assert.deepEqual(subscriptionState(sub('2026-11-28T00:00:00Z', null), now), {
    state: 'upcoming',
    days: 2,
  });
  assert.deepEqual(subscriptionState(sub('2026-01-01T00:00:00Z', null), now), {
    state: 'active',
    days: null,
  });
  assert.equal(
    subscriptionState(sub('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'), now).state,
    'active',
  );
  assert.deepEqual(subscriptionState(sub('2026-01-01T00:00:00Z', '2026-11-30T12:00:00Z'), now), {
    state: 'ending',
    days: 4,
  });
  assert.deepEqual(subscriptionState(sub('2026-01-01T00:00:00Z', '2026-11-23T12:00:00Z'), now), {
    state: 'grace',
    days: 4,
  });
  assert.equal(
    subscriptionState(sub('2026-01-01T00:00:00Z', '2026-11-10T12:00:00Z'), now).state,
    'expired',
  );
  assert.equal(subscriptionState(sub(null, null, 'cancelled'), now).state, 'off');
  assert.equal(subscriptionState(null, now).state, 'none');
});

test('the plan form is checked and cleaned before saving', () => {
  const row = planRow({
    name: ' Pro mensuel ',
    billing: 'monthly',
    price: '2500',
    ticket_limit: '',
    features: ['pos', 'reports', 'unknown'],
    notes_ar: ' دعم \n',
    is_public: true,
    active: true,
  });
  assert.equal(row.name, 'Pro mensuel');
  assert.equal(row.price, 2500);
  assert.equal(row.monthly_price, 2500);
  assert.equal(row.ticket_limit, null);
  assert.deepEqual(row.features, ['reports', 'pos']);
  assert.equal(row.notes_ar, 'دعم');
  assert.equal(planRow({ name: 'x', billing: 'free', price: '999' }).price, 0);
  assert.throws(() => planRow({ name: '', billing: 'free' }), /اسم/);
  assert.throws(() => planRow({ name: 'x', billing: 'monthly', price: '-1' }), /السعر/);
  assert.throws(() => planRow({ name: 'x', billing: 'free', ticket_limit: '2.5' }), /حد/);
});

test('pricing lines: limit, then features, then the free notes', () => {
  assert.deepEqual(
    planLines({ ticket_limit: 100, features: ['loyalty'], notes_ar: 'سطر 1\n\nسطر 2' }),
    ['100 تيكي في الشهر', 'بطاقة الولاء', 'سطر 1', 'سطر 2'],
  );
  assert.equal(
    planLines({ ticket_limit: null, features: [] }, true)[0],
    'Tickets sans plafond mensuel',
  );
});

test('subscription days are Algiers days, saved and read back the same', async () => {
  const { algiersDay, dayEnd, dayStart } = await import('../src/planRules.js');
  assert.equal(dayStart('2026-11-26'), '2026-11-25T23:00:00.000Z');
  assert.equal(dayEnd('2026-12-26'), '2026-12-26T22:59:59.000Z');
  assert.equal(algiersDay(dayStart('2026-11-26')), '2026-11-26');
  assert.equal(algiersDay(dayEnd('2026-12-26')), '2026-12-26');
  assert.equal(dayStart(''), null);
  assert.equal(algiersDay(null), '');
});
