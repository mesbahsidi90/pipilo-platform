import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8');

async function receive(payload) {
  const handlers = {},
    posted = [],
    shown = [];
  const self = {
    location: { origin: 'https://bipilo.app' },
    addEventListener: (name, fn) => (handlers[name] = fn),
    clients: { matchAll: async () => [], claim: async () => {} },
    registration: { showNotification: async (...args) => shown.push(args) },
    skipWaiting: () => {},
  };
  const fetch = async (url, options) => {
    posted.push({ url, body: JSON.parse(options.body) });
    return { ok: true };
  };
  vm.runInNewContext(script, { self, URL, fetch, JSON });
  await new Promise((resolve, reject) =>
    handlers.push({
      data: { json: () => payload },
      waitUntil: (p) => p.then(resolve, reject),
    }),
  );
  return { posted, shown };
}

const ready = {
  type: 'ORDER_READY',
  ticket: 't1',
  title: 'جا دورك!',
  body: '12',
  url: 'https://bipilo.app/#track/t1',
};

test('the phone reports «وصل» after showing the ready alert', async () => {
  const { posted, shown } = await receive({
    ...ready,
    ack: 'https://kdvtqlqiervznhzbpjcx.supabase.co/functions/v1/order-alerts/delivered',
  });
  assert.equal(shown.length, 1);
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0].body, { ticket: 't1' });
});

test('the phone never reports to another address, nor for the «قرب دورك» alert', async () => {
  assert.equal(
    (await receive({ ...ready, ack: 'https://attacker.example/collect' })).posted.length,
    0,
  );
  assert.equal((await receive(ready)).posted.length, 0);
  const near = await receive({
    ...ready,
    type: 'QUEUE_NEAR',
    ack: 'https://kdvtqlqiervznhzbpjcx.supabase.co/functions/v1/order-alerts/delivered',
  });
  assert.equal(near.shown.length, 1);
  assert.equal(near.posted.length, 0);
});

test('a trial ticket alert opens #trial and reports to the trial route', async () => {
  const { posted, shown } = await receive({
    ...ready,
    url: 'https://bipilo.app/#trial/t1',
    ack: 'https://kdvtqlqiervznhzbpjcx.supabase.co/functions/v1/order-alerts/trial-delivered',
  });
  assert.equal(shown.length, 1);
  assert.equal(posted.length, 1);
});
