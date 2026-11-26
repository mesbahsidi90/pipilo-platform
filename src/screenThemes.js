// Colour sets for the waiting / call screen, chosen in «الفروع والأكواد».
// public/tv.html repeats these values (it cannot import modules on old TVs);
// tests/screen-themes.test.js keeps the two in step. Each set is checked for
// readable contrast between the numbers and their background.

export const SCREEN_THEMES = {
  dark: {
    label: 'داكن',
    bg: '#101112',
    panel: '#17191b',
    latest: '#133a2b',
    fresh: '#1f6b3e',
    tile: '#1c2c22',
    accent: '#7ee2a8',
    digit: '#ffffff',
    tileDigit: '#b6f2cc',
    text: '#f3f6f4',
    muted: '#9aa59f',
  },
  green: {
    label: 'أخضر',
    bg: '#0b2a24',
    panel: '#0f3a32',
    latest: '#145244',
    fresh: '#1f7a5c',
    tile: '#12473c',
    accent: '#9ff2c6',
    digit: '#ffffff',
    tileDigit: '#c9f7dd',
    text: '#eefaf3',
    muted: '#a6c9bb',
  },
  blue: {
    label: 'أزرق',
    bg: '#0b1726',
    panel: '#102236',
    latest: '#15365a',
    fresh: '#1f5a96',
    tile: '#14304d',
    accent: '#8cc8ff',
    digit: '#ffffff',
    tileDigit: '#cfe6ff',
    text: '#eef5ff',
    muted: '#9fb4cc',
  },
  burgundy: {
    label: 'أحمر قاتم',
    bg: '#1d0c10',
    panel: '#2a1217',
    latest: '#4a1621',
    fresh: '#7d2233',
    tile: '#3a1a20',
    accent: '#ffb3c0',
    digit: '#ffffff',
    tileDigit: '#ffd6dd',
    text: '#fff3f5',
    muted: '#c9a3aa',
  },
  coffee: {
    label: 'قهوة',
    bg: '#1a130e',
    panel: '#241a13',
    latest: '#3d2a1c',
    fresh: '#6b4528',
    tile: '#33251a',
    accent: '#f3c98b',
    digit: '#fff7ea',
    tileDigit: '#f5dcb6',
    text: '#fbf3e8',
    muted: '#c4ad93',
  },
  light: {
    label: 'فاتح',
    bg: '#eef1ec',
    panel: '#ffffff',
    latest: '#0c3e38',
    fresh: '#157a5c',
    tile: '#e3ede7',
    accent: '#0c3e38',
    digit: '#ffffff',
    tileDigit: '#0c3e38',
    text: '#13211e',
    muted: '#56665f',
  },
};

export const SCREEN_DIGITS = ['dots', 'bold'];

export function screenStyle(value = {}) {
  const digits = SCREEN_DIGITS.includes(value.digits) ? value.digits : 'dots';
  if (value.theme === 'custom' && value.palette && validHex(value.palette.latest))
    return { digits, theme: 'custom', palette: value.palette };
  return { digits, theme: SCREEN_THEMES[value.theme] ? value.theme : 'dark' };
}

// CSS custom properties for a colour set, for the in-app screen and previews.
export function themeVars(theme, palette) {
  const t = themeColors(theme, palette);
  return {
    '--wb-bg': t.bg,
    '--wb-panel': t.panel,
    '--wb-latest': t.latest,
    '--wb-fresh': t.fresh,
    '--wb-tile': t.tile,
    '--wb-accent': t.accent,
    '--wb-digit': t.digit,
    '--wb-tile-digit': t.tileDigit,
    '--wb-text': t.text,
    '--wb-muted': t.muted,
  };
}

// WCAG contrast ratio between two #rrggbb colours.
export function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// ---- Brand colours ---------------------------------------------------------
// Any colour the shop picks becomes a full palette that keeps the same
// contrast as the ready-made sets (checked in tests/screen-themes.test.js).
export const BRAND_SWATCHES = [
  '#e67e22',
  '#d35400',
  '#c0392b',
  '#e84393',
  '#8e44ad',
  '#5b3cc4',
  '#2c3e91',
  '#1e88e5',
  '#00a8b5',
  '#16a085',
  '#27ae60',
  '#7cb342',
  '#f1c40f',
  '#a1887f',
  '#6d4c41',
  '#455a64',
  '#212121',
  '#b71c1c',
];

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) =>
  '#' +
  rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const mix = (a, b, t) => toHex(toRgb(a).map((c, i) => c + (toRgb(b).at(i) - c) * t));

// Darken `color` until white text on it reaches `ratio`.
function darkenFor(color, ratio) {
  let c = color;
  for (let i = 0; i < 40 && contrast('#ffffff', c) < ratio; i++) c = mix(c, '#000000', 0.08);
  return c;
}
// Lighten `ink` until it reaches `ratio` on `ground`.
function lightenOn(ink, ground, ratio) {
  let c = ink;
  for (let i = 0; i < 40 && contrast(c, ground) < ratio; i++) c = mix(c, '#ffffff', 0.12);
  return c;
}

export function validHex(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value.toLowerCase());
}

export function brandPalette(color) {
  const brand = validHex(color) ? color.toLowerCase() : '#0c3e38';
  const bg = mix(brand, '#000000', 0.86);
  const panel = mix(brand, '#000000', 0.8);
  const tile = mix(brand, '#000000', 0.7);
  return {
    color: brand,
    bg,
    panel,
    latest: darkenFor(brand, 7.2),
    fresh: darkenFor(mix(brand, '#ffffff', 0.08), 4.8),
    tile,
    accent: lightenOn(mix(brand, '#ffffff', 0.45), panel, 4.8),
    digit: '#ffffff',
    tileDigit: lightenOn(mix(brand, '#ffffff', 0.7), tile, 7.2),
    text: lightenOn(mix(brand, '#ffffff', 0.92), bg, 7.2),
    muted: lightenOn(mix(brand, '#ffffff', 0.55), bg, 4.8),
  };
}

// The colours actually used: a ready-made set, or the shop's brand palette.
export function themeColors(theme, palette) {
  if (theme === 'custom' && palette && validHex(palette.latest)) return palette;
  return SCREEN_THEMES[theme] || SCREEN_THEMES.dark;
}
