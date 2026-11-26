import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementText, newlyReady, pickVoice, speakCalls } from '../src/announce.js';

test('announcement text per language and activity', () => {
  assert.equal(announcementText('57'), 'الطلب رقم 57، طلبك واجد.');
  assert.equal(announcementText(12, { clinic: true }), 'الرقم 12، تفضّل للاستقبال.');
  assert.match(announcementText('57', { lang: 'fr' }), /^Commande numéro 57/);
});

test('only numbers that just became ready are called', () => {
  assert.deepEqual(newlyReady(null, new Set(['1'])), []);
  assert.deepEqual(newlyReady(new Set(['1']), new Set(['1', '2', '3'])), ['2', '3']);
});

test('voice selection falls back to nothing when the language is missing', () => {
  const voices = [{ lang: 'en-US' }, { lang: 'fr-FR' }];
  assert.equal(pickVoice(voices, 'ar'), null);
  assert.equal(pickVoice(voices, 'fr').lang, 'fr-FR');
});

test('speaking is skipped without a matching voice', () => {
  const spoken = [];
  const synth = { getVoices: () => [{ lang: 'en-US' }], speak: (u) => spoken.push(u) };
  globalThis.SpeechSynthesisUtterance ??= class {
    constructor(text) {
      this.text = text;
    }
  };
  assert.equal(speakCalls(['5'], { lang: 'ar' }, synth), false);
  synth.getVoices = () => [{ lang: 'ar-SA' }];
  assert.equal(speakCalls(['5', '6'], { lang: 'ar' }, synth), true);
  assert.deepEqual(
    spoken.map((u) => u.text),
    ['الطلب رقم 5، طلبك واجد.', 'الطلب رقم 6، طلبك واجد.'],
  );
});

test('a number called again (its call time moved) is announced again', async () => {
  const { newCalls } = await import('../src/announce.js');
  const before = new Map([
    ['57', 100],
    ['46', 50],
  ]);
  assert.deepEqual(newCalls(null, before), []);
  assert.deepEqual(newCalls(before, new Map(before)), []);
  assert.deepEqual(
    newCalls(
      before,
      new Map([
        ['57', 100],
        ['46', 200],
        ['12', 300],
      ]),
    ),
    ['46', '12'],
  );
});
