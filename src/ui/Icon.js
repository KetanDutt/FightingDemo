import Phaser from 'phaser';
import { COLORS } from '../config/palette.js';

/**
 * Procedural vector icons.
 *
 * Every icon in the game is drawn from primitives at runtime — no emoji, no
 * icon font, no image assets. Icons are authored in a 24x24 box centred on
 * the origin and scaled to `size`, stroked with a consistent weight so they
 * read as one family at any scale.
 */

const TAU = Math.PI * 2;
const DEG = Phaser.Math.DegToRad;

function stroke(ctx, x1, y1, x2, y2) {
  const { g, s } = ctx;
  g.beginPath();
  g.moveTo(x1 * s, y1 * s);
  g.lineTo(x2 * s, y2 * s);
  g.strokePath();
}

function polyline(ctx, points, close = false) {
  const { g, s } = ctx;
  g.beginPath();
  g.moveTo(points[0][0] * s, points[0][1] * s);
  for (let i = 1; i < points.length; i += 1) g.lineTo(points[i][0] * s, points[i][1] * s);
  if (close) g.closePath();
  g.strokePath();
}

function dot(ctx, x, y, r) {
  ctx.g.fillCircle(x * ctx.s, y * ctx.s, r * ctx.s);
}

const DRAWERS = {
  /** Crossed attacks — the "fight" glyph. */
  fight(ctx) {
    stroke(ctx, -8.5, 8.5, 5.5, -5.5); // blade 1
    stroke(ctx, -8.5, -8.5, 5.5, 5.5); // blade 2
    stroke(ctx, -10.5, 4.5, -5.5, 9.5); // guards
    stroke(ctx, -10.5, -4.5, -5.5, -9.5);
    dot(ctx, -9.5, 9.5, 1.6); // pommels
    dot(ctx, -9.5, -9.5, 1.6);
  },

  /** Concentric rings — training dummy. */
  target(ctx) {
    ctx.g.strokeCircle(0, 0, 8 * ctx.s);
    ctx.g.strokeCircle(0, 0, 4.2 * ctx.s);
    dot(ctx, 0, 0, 1.5);
  },

  /** Play glyph in a frame — media/gallery. */
  gallery(ctx) {
    const { g, s } = ctx;
    g.strokeRoundedRect(-9 * s, -7 * s, 18 * s, 14 * s, 3 * s);
    g.fillTriangle(-2.5 * s, -3.5 * s, -2.5 * s, 3.5 * s, 4 * s, 0);
  },

  /** Gear — settings. */
  settings(ctx) {
    const { g, s } = ctx;
    g.strokeCircle(0, 0, 3.1 * s);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      stroke(ctx, 5.2 * Math.cos(a), 5.2 * Math.sin(a), 8 * Math.cos(a), 8 * Math.sin(a));
    }
  },

  play(ctx) {
    ctx.g.fillTriangle(-4.5 * ctx.s, -7 * ctx.s, -4.5 * ctx.s, 7 * ctx.s, 7.5 * ctx.s, 0);
  },

  pause(ctx) {
    const { g, s } = ctx;
    g.fillRoundedRect(-6.5 * s, -7 * s, 4.6 * s, 14 * s, 2 * s);
    g.fillRoundedRect(1.9 * s, -7 * s, 4.6 * s, 14 * s, 2 * s);
  },

  /** Circular arrow — restart. */
  restart(ctx) {
    const { g, s } = ctx;
    g.beginPath();
    g.arc(0, 0, 7 * s, DEG(-50), DEG(235));
    g.strokePath();
    const a = DEG(235);
    const ex = 7 * Math.cos(a);
    const ey = 7 * Math.sin(a);
    stroke(ctx, ex - 4.5, ey + 1.5, ex, ey);
    stroke(ctx, ex + 0.5, ey - 4.5, ex, ey);
  },

  /** Two opposing arrows — rematch / run it back. */
  rematch(ctx) {
    stroke(ctx, -9, -4, 7, -4);
    stroke(ctx, 2.5, -8.5, 7, -4);
    stroke(ctx, 2.5, 0.5, 7, -4);
    stroke(ctx, 9, 4, -7, 4);
    stroke(ctx, -2.5, 8.5, -7, 4);
    stroke(ctx, -2.5, -0.5, -7, 4);
  },

  /** Door with an arrow leaving it — quit. */
  quit(ctx) {
    polyline(ctx, [
      [-8, -9],
      [3, -9],
      [3, 9],
      [-8, 9],
    ]);
    stroke(ctx, -8, -9, -8, 9);
    stroke(ctx, -3, 0, 9, 0);
    stroke(ctx, 5, -4, 9, 0);
    stroke(ctx, 5, 4, 9, 0);
  },

  /** House — main menu. */
  home(ctx) {
    polyline(ctx, [
      [-10, 1],
      [0, -9],
      [10, 1],
    ]);
    ctx.g.strokeRect(-7 * ctx.s, 1 * ctx.s, 14 * ctx.s, 8 * ctx.s);
  },

  /** Left arrow — back / previous. */
  back(ctx) {
    stroke(ctx, 8, 0, -8, 0);
    stroke(ctx, -3, -5, -8, 0);
    stroke(ctx, -3, 5, -8, 0);
  },

  /** Right arrow — next / forward. */
  next(ctx) {
    stroke(ctx, -8, 0, 8, 0);
    stroke(ctx, 3, -5, 8, 0);
    stroke(ctx, 3, 5, 8, 0);
  },

  /** Keyboard — collapsed controls legend. */
  keyboard(ctx) {
    const { g, s } = ctx;
    g.strokeRoundedRect(-10 * s, -6.5 * s, 20 * s, 13 * s, 2.5 * s);
    dot(ctx, -5.5, -1.5, 1.2);
    dot(ctx, 0, -1.5, 1.2);
    dot(ctx, 5.5, -1.5, 1.2);
    stroke(ctx, -4, 3.5, 4, 3.5);
  },

  /** Speaker — audio. */
  sound(ctx) {
    const { g, s } = ctx;
    g.fillTriangle(-9 * s, -3.5 * s, -3.5 * s, -3.5 * s, -3.5 * s, 3.5 * s, -9 * s, 3.5 * s);
    g.fillRect(-3.5 * s, -3.5 * s, 2 * s, 7 * s);
    g.beginPath();
    g.arc(0, 0, 6 * s, DEG(-50), DEG(50));
    g.strokePath();
  },
};

export const ICON_NAMES = Object.keys(DRAWERS);

/**
 * Draws icon `name` centred on the graphics origin, scaled to `size` px.
 * @param {Phaser.GameObjects.Graphics} graphics target (cleared first)
 * @param {string} name one of {@link ICON_NAMES}
 * @param {number} size icon box size in px
 * @param {number} color stroke/fill colour
 * @param {number} alpha
 */
export function drawIcon(graphics, name, size = 32, color = COLORS.white, alpha = 1) {
  const drawer = DRAWERS[name];
  if (!drawer) return graphics;
  graphics.clear();
  graphics.lineStyle(Math.max(2.2, size / 8.5), color, alpha);
  graphics.fillStyle(color, alpha);
  drawer({ g: graphics, s: size / 24, color, alpha });
  return graphics;
}
