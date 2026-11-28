import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasStoredSession, standaloneStart } from '../src/routes.js';

const store = (entries) => ({
  get length() {
    return Object.keys(entries).length;
  },
  key: (i) => Object.keys(entries)[i] ?? null,
  getItem: (k) => entries[k] ?? null,
});

test('the installed app opens the dashboard for a signed-in shop', () => {
  assert.deepEqual(standaloneStart({ signedIn: true, ticket: 'abc' }), ['dashboard', '']);
  assert.deepEqual(standaloneStart({ signedIn: false, ticket: 'abc' }), ['track', 'abc']);
  assert.deepEqual(standaloneStart({ signedIn: false, ticket: 'abc', ticketRoute: 'demo' }), [
    'demo',
    'abc',
  ]);
  assert.deepEqual(standaloneStart({ signedIn: false, ticket: null }), ['follow', '']);
});

test('a stored Supabase sign-in is found in either storage', () => {
  assert.equal(hasStoredSession(store({ 'sb-kdv-auth-token': '{"a":1}' })), true);
  assert.equal(hasStoredSession(store({}), store({ 'sb-kdv-auth-token': 'x' })), true);
  assert.equal(hasStoredSession(store({ 'sb-kdv-auth-token-code-verifier': 'x' })), false);
  assert.equal(hasStoredSession(store({ 'bippo-last-ticket': 'x' })), false);
  assert.equal(
    hasStoredSession({
      get length() {
        throw new Error('blocked');
      },
    }),
    false,
  );
});
