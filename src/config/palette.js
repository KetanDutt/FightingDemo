/**
 * Colour palette + fighter skins.
 *
 * Every colour used by the UI lives here so the whole game can be re-themed
 * from a single file.
 *
 * System: a near-black ink backdrop, two quiet surface tones, one hairline
 * border colour and a single amber brand accent. Strong colours are reserved
 * for meaning (danger, success, the player's own actions) — chrome stays
 * neutral so important content stands out.
 */

export const COLORS = {
  // Backdrop (procedural arena)
  skyTop: 0x101a33,
  skyBottom: 0x2b3a63,
  sunGlow: 0xffb867,
  ridgeFar: 0x24325a,
  ridgeMid: 0x1a2547,
  ridgeNear: 0x121a34,
  ground: 0x2a2036,
  groundTop: 0x47365a,
  groundLine: 0x6b5285,

  // Brand + semantic
  gold: 0xffc93c,
  goldLight: 0xffd76a,
  goldDark: 0xc48f14,
  red: 0xff5d5d,
  redDark: 0xa12b2b,
  green: 0x5ddc7a,
  greenDark: 0x2c7d43,
  blue: 0x4fc3f7,
  purple: 0x9b6cff,

  // UI surfaces, text and borders
  ink: 0x0b0f1a,
  bg: 0x0b0f1a,
  panel: 0x131a2e,
  panelLight: 0x1a2340,
  border: 0x2b3757,
  white: 0xffffff,
  offWhite: 0xf2f5ff,
  muted: 0x8f99bd,
  /** Text colour on top of the gold accent. */
  accentInk: 0x241a04,
  shadow: 0x05070f,

  // Combat feedback
  hitSpark: 0xfff3a8,
  blockSpark: 0xa9e4ff,
  heavySpark: 0xffa64d,
  dust: 0xcfc4b0,
};

export const CSS_COLORS = {
  gold: '#ffc93c',
  goldLight: '#ffd76a',
  red: '#ff5d5d',
  green: '#5ddc7a',
  blue: '#4fc3f7',
  purple: '#9b6cff',
  white: '#ffffff',
  offWhite: '#f2f5ff',
  muted: '#8f99bd',
  panel: '#131a2e',
  panelLight: '#1a2340',
  border: '#2b3757',
  bg: '#0b0f1a',
  ink: '#0b0f1a',
  shadow: '#05070f',
  accent: '#ffc93c',
  accentInk: '#241a04',
};

/**
 * Deuteranopia-safe replacement for the red/green fill colours. Health reads
 * as blue-vs-orange instead of red-vs-green.
 */
export const COLORBLIND_FILLS = {
  /** Replaces `COLORS.red` (enemy health). */
  red: 0x3f7dff,
  /** Replaces `COLORS.green` (player health). */
  green: 0xff9d3f,
};

/** Picks the accessible fill for a side given the mode flag. */
export function colorblindFill(hex, enabled) {
  if (!enabled) return hex;
  if (hex === COLORS.red) return COLORBLIND_FILLS.red;
  if (hex === COLORS.green) return COLORBLIND_FILLS.green;
  return hex;
}

/**
 * Fighter skins. `tint` is multiplied with the sprite art, so neutral is
 * 0xffffff. `accent` is used for the HUD bar + name plate.
 */
export const SKINS = [
  { id: 'classic', name: 'Classic', tint: 0xffffff, accent: COLORS.gold, swatch: '#c98f52' },
  { id: 'ember', name: 'Ember', tint: 0xff9b7a, accent: COLORS.red, swatch: '#ff8a5c' },
  { id: 'jade', name: 'Jade', tint: 0x9fe8b0, accent: COLORS.green, swatch: '#7fd79a' },
  { id: 'royal', name: 'Royal', tint: 0x9fb4ff, accent: COLORS.blue, swatch: '#8fa6ff' },
  { id: 'shadow', name: 'Shadow', tint: 0x9a92b5, accent: COLORS.purple, swatch: '#8d84ad' },
  { id: 'banana', name: 'Banana', tint: 0xffe08a, accent: COLORS.gold, swatch: '#ffd86b' },
];

export function getSkin(id) {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0];
}
