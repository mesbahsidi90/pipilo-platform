import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authStorage,
  expireIdleSession,
  idleLimitMs,
  lastActiveKey,
  remembered,
  setRemembered,
} from '../src/sessionRules.js';

function memory() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}
const token = 'sb-abc-auth-token';

test('remembered by default: the sign-in survives closing the browser', () => {
  const local = memory(),
    session = memory();
  assert.equal(remembered(local), true);
  authStorage(local, session).setItem(token, 'x');
  assert.equal(local.getItem(token), 'x');
  assert.equal(session.getItem(token), null);
});

test('shared device: the sign-in stays only in this browser session', () => {
  const local = memory(),
    session = memory();
  local.setItem(token, 'old');
  setRemembered(local, false);
  const store = authStorage(local, session);
  store.setItem(token, 'new');
  assert.equal(session.getItem(token), 'new');
  assert.equal(local.getItem(token), null);
  assert.equal(store.getItem(token), 'new');
  store.removeItem(token);
  assert.equal(store.getItem(token), null);
});

test('a remembered sign-in unused for 30 days asks for a new code', () => {
  const local = memory(),
    now = Date.parse('2026-11-21T10:00:00Z');
  local.setItem(token, 'x');
  // First visit after the update: only records the visit.
  assert.equal(expireIdleSession(local, now), false);
  assert.equal(local.getItem(lastActiveKey), String(now));
  // 29 days later: still signed in.
  const visit = now + idleLimitMs - 86400000;
  assert.equal(expireIdleSession(local, visit), false);
  assert.equal(local.getItem(token), 'x');
  // 31 days after that visit: signed out.
  assert.equal(expireIdleSession(local, visit + idleLimitMs + 86400000), true);
  assert.equal(local.getItem(token), null);
  assert.equal(local.getItem(lastActiveKey), null);
});

test('no sign-in, nothing to expire or record', () => {
  const local = memory();
  assert.equal(expireIdleSession(local), false);
  assert.equal(local.getItem(lastActiveKey), null);
});
