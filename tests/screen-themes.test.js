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

test('any brand colour becomes a palette as readable as the ready-made sets', async () => {
  const { brandPalette, BRAND_SWATCHES } = await import('../src/screenThemes.js');
  const colours = [
    ...BRAND_SWATCHES,
    '#ffffff',
    '#000000',
    '#ffff00',
    '#00ff00',
    '#ff00ff',
    '#7f7f7f',
  ];
  for (let h = 0; h < 360; h += 15) {
    const k = (n) => (n + h / 30) % 12;
    const f = (n) => 0.5 - 0.5 * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    colours.push(
      '#' +
        [f(0), f(8), f(4)]
          .map((v) =>
            Math.round(v * 255)
              .toString(16)
              .padStart(2, '0'),
          )
          .join(''),
    );
  }
  for (const colour of colours) {
    const t = brandPalette(colour);
    assert.ok(contrast(t.digit, t.latest) >= 7, colour + ': big number');
    assert.ok(contrast(t.digit, t.fresh) >= 4.5, colour + ': flashing');
    assert.ok(contrast(t.tileDigit, t.tile) >= 7, colour + ': earlier numbers');
    assert.ok(contrast(t.text, t.bg) >= 7, colour + ': texts');
    assert.ok(contrast(t.accent, t.panel) >= 4.5, colour + ': title');
    for (const value of Object.values(t)) assert.match(value, /^#[0-9a-f]{6}$/);
  }
});
