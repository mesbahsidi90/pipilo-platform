import test from 'node:test';
import assert from 'node:assert/strict';
import { bearer, route } from '../supabase/functions/pos-api/routes.js';

test('POS API routes', () => {
  assert.deepEqual(route('GET', '/v1/branches'), { action: 'branches' });
  assert.deepEqual(route('POST', '/v1/tickets'), { action: 'create' });
  assert.deepEqual(route('POST', '/api/v1/tickets/'), { action: 'create' });
  assert.deepEqual(route('GET', '/v1/tickets/INV%2F7'), { action: 'get', ticket: 'INV/7' });
  assert.deepEqual(route('POST', '/v1/tickets/INV-1/ready'), { action: 'ready', ticket: 'INV-1' });
  assert.deepEqual(route('POST', '/v1/tickets/x/complete'), { action: 'complete', ticket: 'x' });
  assert.deepEqual(route('POST', '/v1/tickets/x/cancel'), { action: 'cancel', ticket: 'x' });
  assert.deepEqual(route('GET', '/v1/tickets/x/ready'), { error: 405 });
  assert.deepEqual(route('DELETE', '/v1/tickets'), { error: 405 });
  assert.equal(route('POST', '/v1/tickets/x/delete'), null);
  assert.equal(route('GET', '/v2/branches'), null);
  assert.equal(route('GET', '/v1/tickets/%E0%A4%A'), null);
  assert.equal(route('POST', '/v1/tickets/x/ready/more'), null);
});

test('POS API bearer key', () => {
  assert.equal(bearer('Bearer bpk_abc'), 'bpk_abc');
  assert.equal(bearer('bearer  bpk_abc'), 'bpk_abc');
  assert.equal(bearer('Basic xyz'), '');
  assert.equal(bearer(null), '');
});
