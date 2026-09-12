/**
 * Colour palette + fighter skins.
 *
 * Every colour used by the UI lives here so the whole game can be re-themed
 * from a single file.
 */

export const COLORS = {
  // Backdrop
  skyTop: 0x101a33,
  skyBottom: 0x2b3a63,
  sunGlow: 0xffb867,
  ridgeFar: 0x24325a,
  ridgeMid: 0x1a2547,
  ridgeNear: 0x121a34,
  ground: 0x2a2036,
  groundTop: 0x47365a,
  groundLine: 0x6b5285,

  // UI
  gold: 0xffc93c,
  goldDark: 0xc48f14,
  red: 0xff5d5d,
  redDark: 0xa12b2b,
  green: 0x5ddc7a,
  greenDark: 0x2c7d43,
  blue: 0x4fc3f7,
  purple: 0x9b6cff,
  white: 0xffffff,
  offWhite: 0xf5f7ff,
  panel: 0x141b30,
  panelLight: 0x1f2947,
  shadow: 0x05070f,
  ink: 0x0b0f1a,

  // Combat feedback
  hitSpark: 0xfff3a8,
  blockSpark: 0xa9e4ff,
  heavySpark: 0xffa64d,
  dust: 0xcfc4b0,
};

export const CSS_COLORS = {
  gold: '#ffc93c',
  red: '#ff5d5d',
  green: '#5ddc7a',
  blue: '#4fc3f7',
  white: '#ffffff',
  offWhite: '#f5f7ff',
  muted: '#97a0c2',
  panel: '#141b30',
};

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
