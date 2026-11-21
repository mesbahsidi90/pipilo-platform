import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderAudio } from '../src/orderAudio.js';
import { iosBrowser, keepScreenAwake } from '../src/screenAwake.js';

function fakeEnv() {
  const sources = [];
  class Context {
    constructor() {
      this.state = 'suspended';
      this.sampleRate = 100;
      this.destination = {};
      this.currentTime = 0;
    }
    async resume() {
      this.state = 'running';
    }
    async decodeAudioData() {
      return { duration: 1 };
    }
    createBuffer(_channels, length) {
      const data = new Float32Array(length);
      return { getChannelData: () => data, data };
    }
    createBufferSource() {
      const source = {
        started: false,
        stopped: false,
        connect: (node) => node,
        disconnect() {},
        start() {
          source.started = true;
        },
        stop() {
          source.stopped = true;
        },
      };
      sources.push(source);
      return source;
    }
    createGain() {
      return { gain: { value: 1 }, connect: (node) => node, disconnect() {} };
    }
    async close() {}
  }
  return {
    sources,
    env: {
      AudioContext: Context,
      navigator: {},
      fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
    },
  };
}

test('the iPhone keep-alive waits for the tap, stays very quiet, and stops cleanly', async () => {
  const { env, sources } = fakeEnv();
  const audio = createOrderAudio('/tone.mp3', env);
  assert.equal(audio.keepAlive(true), false, 'no sound before the customer taps');
  await audio.play();
  audio.pause();
  assert.equal(audio.keepAlive(true), true);
  const idle = sources.at(-1);
  assert.equal(idle.loop, true);
  assert.ok(idle.started);
  assert.ok(Math.max(...idle.buffer.data.map(Math.abs)) <= 0.0004);
  assert.equal(audio.keepAlive(true), true, 'a second call keeps the same loop');
  assert.equal(sources.at(-1), idle);
  await audio.play();
  assert.equal(idle.stopped, false, 'the ring plays on top of the keep-alive');
  audio.keepAlive(false);
  assert.ok(idle.stopped);
  audio.keepAlive(true);
  audio.dispose();
  assert.ok(sources.at(-1).stopped, 'closing the page stops it');
});

test('only iPhone and iPad Safari outside a home-screen app need the open page', () => {
  const env = (userAgent, extra = {}) => ({
    navigator: { userAgent, ...extra },
    matchMedia: () => ({ matches: Boolean(extra.app) }),
  });
  assert.equal(iosBrowser(env('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')), true);
  assert.equal(iosBrowser(env('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', { app: true })), false);
  assert.equal(iosBrowser(env('Mozilla/5.0 (iPhone)', { standalone: true })), false);
  assert.equal(
    iosBrowser(env('Mozilla/5.0 (Macintosh)', { platform: 'MacIntel', maxTouchPoints: 5 })),
    true,
  );
  assert.equal(iosBrowser(env('Mozilla/5.0 (Linux; Android 14; SM-S918B)')), false);
});

test('the screen stays on while waiting and comes back after the page is shown again', async () => {
  const requests = [];
  let listener = null;
  const env = {
    document: {
      visibilityState: 'visible',
      addEventListener: (_name, fn) => (listener = fn),
      removeEventListener: () => (listener = null),
    },
    navigator: {
      wakeLock: {
        request: async (type) => {
          const lock = { type, released: false, release: async () => (lock.released = true) };
          requests.push(lock);
          return lock;
        },
      },
    },
  };
  const release = keepScreenAwake(env);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, 'screen');
  await listener();
  assert.equal(requests.length, 2, 'asked again when the page comes back');
  release();
  assert.equal(requests[1].released, true);
  assert.equal(listener, null);
  assert.doesNotThrow(() => keepScreenAwake({ document: env.document, navigator: {} })());
});
