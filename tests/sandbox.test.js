import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleOrders, sandboxActive } from '../src/sandboxRules.js';

const at = (pathname, hash = '') => ({ pathname, hash });
const now = Date.parse('2026-11-19T15:00:00Z');

test('the trial starts at /jarreb and follows the dashboard pages', () => {
  assert.equal(sandboxActive(at('/jarreb'), null, now), true);
  assert.equal(sandboxActive(at('/dashboard'), null, now), false);
  assert.equal(sandboxActive(at('/dashboard'), now - 60000, now), true);
  assert.equal(sandboxActive(at('/dashboard/codes'), now - 60000, now), true);
  assert.equal(sandboxActive(at('/', '#track/abc'), now - 60000, now), true);
});

test('real pages end the trial', () => {
  for (const path of ['/signup', '/login', '/account', '/admin', '/invite/x', '/'])
    assert.equal(sandboxActive(at(path), now - 60000, now), false, path);
  assert.equal(sandboxActive(at('/signups'), now - 60000, now), true);
});

test('sample data has a live board and a week of finished orders', () => {
  let seed = 1;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rows = sampleOrders('clinic', now, random);
  const live = rows.filter((o) => ['preparing', 'ready'].includes(o.status));
  assert.equal(live.length, 5);
  assert.equal(live.filter((o) => o.status === 'ready').length, 1);
  assert.ok(live.every((o) => o.guest_name));
  assert.ok(live.some((o) => o.guest_phone));
  const done = rows.filter((o) => o.status === 'collected');
  assert.ok(done.length > 40);
  assert.ok(done.every((o) => o.created_at < o.ready_at && o.ready_at < o.collected_at));
  assert.ok(rows.every((o) => Date.parse(o.created_at) < now));
  const today = rows.filter((o) => o.created_at.slice(0, 10) === '2026-11-19');
  assert.equal(new Set(today.map((o) => o.number)).size, today.length);
  assert.ok(Math.max(...live.map((o) => Number(o.number))) < 20);
  assert.equal(sampleOrders('unknown', now, random).length > 0, true);
});

test('the trial ends by itself after six hours', () => {
  assert.equal(sandboxActive(at('/dashboard'), now - 5 * 3600000, now), true);
  assert.equal(sandboxActive(at('/dashboard'), now - 7 * 3600000, now), false);
  assert.equal(sandboxActive(at('/dashboard'), Number.NaN, now), false);
});
