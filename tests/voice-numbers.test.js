import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { callClips, numberClips, voiceClipTexts } from '../src/voiceNumbers.js';

test('numbers are said the Arabic way: units before tens, joined with «و»', () => {
  assert.deepEqual(numberClips('7'), ['u7']);
  assert.deepEqual(numberClips('15'), ['u15']);
  assert.deepEqual(numberClips('20'), ['t2']);
  assert.deepEqual(numberClips('57'), ['u7', 'wt5']);
  assert.deepEqual(numberClips('300'), ['h3']);
  assert.deepEqual(numberClips('305'), ['h3', 'wu5']);
  assert.deepEqual(numberClips('357'), ['h3', 'wu7', 'wt5']);
  assert.deepEqual(numberClips('1000'), ['k1']);
  assert.deepEqual(numberClips('1305'), ['k1', 'wh3', 'wu5']);
  assert.deepEqual(numberClips('2040'), ['k2', 'wt4']);
  assert.deepEqual(numberClips('0'), ['zero']);
});

test('long or odd numbers are read digit by digit or skipped', () => {
  assert.deepEqual(numberClips('10204'), ['u1', 'zero', 'u2', 'zero', 'u4']);
  assert.equal(numberClips('A12'), null);
  assert.equal(numberClips(''), null);
  assert.equal(callClips('x'), null);
});

test('a call is «الطلب رقم» + number + «جاهز», and every clip it uses exists', () => {
  assert.deepEqual(callClips('57'), ['order', 'u7', 'wt5', 'ready']);
  const known = voiceClipTexts();
  const files = new Set(
    fs
      .readdirSync(new URL('../public/voice/ar/', import.meta.url))
      .map((f) => f.replace('.wav', '')),
  );
  for (const key of Object.keys(known)) assert.ok(files.has(key), 'missing clip ' + key);
  for (let n = 0; n <= 9999; n += 7)
    for (const key of callClips(String(n))) assert.ok(key in known, n + ' needs ' + key);
});
