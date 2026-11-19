import test from 'node:test';
import assert from 'node:assert/strict';
import { activityCopy, defaultPickups } from '../src/activityCopy.js';
import { gameFor, gameThemes } from '../src/gameThemes.js';

test('each activity gets its own game, clinics none', () => {
  assert.equal(gameFor('cafe'), 'coffee');
  assert.equal(gameFor('restaurant'), 'sandwich');
  assert.equal(gameFor('food_court'), 'sandwich');
  assert.equal(gameFor('laundry'), 'laundry');
  assert.equal(gameFor('car_wash'), 'tires');
  assert.equal(gameFor('tailor'), 'fabric');
  assert.equal(gameFor('other'), 'blocks');
  assert.equal(gameFor('clinic'), null);
  for (const theme of Object.values(gameThemes)) {
    assert.ok(theme.title && theme.drop && theme.over.includes('{0}'));
    assert.ok(theme.colors.length >= 2 && theme.sky.length === 2);
  }
});

test('customer page words follow the activity', () => {
  assert.equal(activityCopy('cafe').waiting, 'طلبك راه يتحضّر');
  assert.equal(activityCopy('laundry').waiting, 'حوايجك راهم يتغسلو');
  assert.equal(activityCopy('car_wash').ready, 'طوموبيلك واجدة للاستلام');
  assert.equal(activityCopy('clinic').number, 'رقم الدور');
  assert.equal(activityCopy('unknown').number, 'رقم التيكي');
  assert.ok(defaultPickups.has('تقدر تجي تديه من الكونتوار.'));
  for (const kind of ['cafe', 'clinic', 'laundry', 'car_wash', 'tailor', 'other'])
    for (const key of ['loading', 'waiting', 'calling', 'ready', 'pickup', 'finished', 'cancelled'])
      assert.ok(activityCopy(kind)[key], kind + ' ' + key);
});
