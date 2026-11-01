import Phaser from 'phaser';
import { FONTS } from '../config/constants.js';
import { COLORS, CSS_COLORS } from '../config/palette.js';

/**
 * Shared typography helpers.
 *
 * The game uses two voices: Saira Condensed 800 for display type (titles,
 * buttons, timers) and Inter for everything else. Display text gets a hard,
 * blur-free offset shadow — a poster-style "extrude" instead of a glow — and
 * section labels get the signature amber slash tick.
 */

/**
 * Big display title (uppercase, condensed, hard offset shadow).
 * @returns {Phaser.GameObjects.Text}
 */
export function titleText(scene, x, y, text, options = {}) {
  const { size = 110, color = CSS_COLORS.gold, align = 'center' } = options;
  return scene.add
    .text(x, y, String(text).toUpperCase(), {
      fontFamily: FONTS.DISPLAY,
      fontSize: `${size}px`,
      fontStyle: '800',
      color,
      letterSpacing: Math.max(1, Math.round(size * 0.025)),
      align,
      shadow: {
        offsetX: 0,
        offsetY: Math.max(4, Math.round(size * 0.07)),
        color: CSS_COLORS.shadow,
        blur: 0,
        fill: true,
      },
    })
    .setOrigin(0.5);
}

/**
 * Small uppercase section label prefixed with the amber slash tick.
 * `align`: 'left' anchors the tick at (x, y); 'center' centres the whole
 * group on x.
 * @returns {Phaser.GameObjects.Container}
 */
export function sectionLabel(scene, x, y, text, options = {}) {
  const { align = 'center', color = CSS_COLORS.muted } = options;
  const container = scene.add.container(x, y);

  const tick = scene.add.graphics();
  tick.fillStyle(COLORS.gold, 1);
  // parallelogram slash: the product's signature mark
  tick.beginPath();
  tick.moveTo(5, -9);
  tick.lineTo(12, -9);
  tick.lineTo(7, 9);
  tick.lineTo(0, 9);
  tick.closePath();
  tick.fillPath();

  const label = scene.add
    .text(0, 0, String(text).toUpperCase(), {
      fontFamily: FONTS.PRIMARY,
      fontSize: '24px',
      fontStyle: '600',
      color,
      letterSpacing: 4,
    })
    .setOrigin(0, 0.5);

  const gap = 12;
  const tickWidth = 12;
  const totalWidth = tickWidth + gap + label.width;
  const startX = align === 'left' ? 0 : -totalWidth / 2;
  tick.setPosition(startX, 0);
  label.setPosition(startX + tickWidth + gap, 0);

  container.add([tick, label]);
  container.setData('label', label);
  return container;
}

/** Body text with the standard UI voice. @returns {Phaser.GameObjects.Text} */
export function bodyText(scene, x, y, text, options = {}) {
  const {
    size = 28,
    color = CSS_COLORS.offWhite,
    alpha = 1,
    align = 'center',
    origin = 0.5,
    wrapWidth = null,
    weight = '400',
    letterSpacing = 0,
  } = options;
  return scene.add
    .text(x, y, text, {
      fontFamily: FONTS.PRIMARY,
      fontSize: `${size}px`,
      fontStyle: weight,
      color,
      alpha,
      align,
      letterSpacing,
      ...(wrapWidth ? { wordWrap: { width: wrapWidth } } : {}),
    })
    .setOrigin(origin, origin === 0.5 ? 0.5 : origin);
}

/** Numeric / value readout in display type (timers, scores, percents). */
export function valueText(scene, x, y, text, options = {}) {
  const {
    size = 34,
    color = CSS_COLORS.gold,
    align = 'center',
    origin = 0.5,
    weight = '700',
  } = options;
  return scene.add
    .text(x, y, text, {
      fontFamily: FONTS.DISPLAY,
      fontSize: `${size}px`,
      fontStyle: weight,
      color,
      align,
      letterSpacing: 1,
    })
    .setOrigin(origin);
}

/** Recolours a text object from a COLORS int (keeps the rest of its style). */
export function hexCss(hex) {
  return `#${Phaser.Display.Color.IntegerToColor(hex).color.toString(16).padStart(6, '0')}`;
}
