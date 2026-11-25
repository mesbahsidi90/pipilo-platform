import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SCREEN_THEMES, contrast, screenStyle } from '../src/screenThemes.js';

test('every colour set keeps the numbers readable from across the room', () => {
  for (const [name, t] of Object.entries(SCREEN_THEMES)) {
    assert.ok(contrast(t.digit, t.latest) >= 7, name + ': big number on its box');
    assert.ok(contrast(t.digit, t.fresh) >= 4.5, name + ': big number while flashing');
    assert.ok(contrast(t.tileDigit, t.tile) >= 7, name + ': earlier numbers');
    assert.ok(contrast(t.text, t.bg) >= 7, name + ': shop name and texts');
    assert.ok(contrast(t.accent, t.panel) >= 4.5, name + ': title on the board');
  }
});

test('the TV page carries the same colour sets as the app', () => {
  const page = fs.readFileSync(new URL('../public/tv.html', import.meta.url), 'utf8');
  for (const [name, t] of Object.entries(SCREEN_THEMES))
    for (const [key, value] of Object.entries(t))
      if (key !== 'label')
        assert.ok(page.includes(value), `tv.html is missing ${name}.${key} ${value}`);
  for (const name of Object.keys(SCREEN_THEMES)) assert.ok(page.includes(name + ':'), name);
});

test('unknown styles fall back to dots on the dark set', () => {
  assert.deepEqual(screenStyle({ digits: 'bold', theme: 'blue' }), {
    digits: 'bold',
    theme: 'blue',
  });
  assert.deepEqual(screenStyle({ digits: 'x', theme: 'pink' }), { digits: 'dots', theme: 'dark' });
  assert.deepEqual(screenStyle(), { digits: 'dots', theme: 'dark' });
});
