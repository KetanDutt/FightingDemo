import { DEPTH, FONTS } from '../config/constants.js';

/**
 * Pool of floating texts (damage numbers, "BLOCKED!", combo call-outs).
 *
 * Text objects are expensive to allocate mid-fight, so they are recycled.
 */
export class FloatingText {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.depth = options.depth ?? DEPTH.FLOATING_TEXT;
    this.pool = [];
    this.max = options.max ?? 16;
  }

  #take() {
    const existing = this.pool.find((item) => !item.active);
    if (existing) return existing;
    if (this.pool.length >= this.max) {
      // Recycle the oldest entry instead of growing without bound.
      const oldest = this.pool.shift();
      this.pool.push(oldest);
      this.scene.tweens.killTweensOf(oldest);
      return oldest;
    }
    const text = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '54px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b0f1a',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(this.depth)
      .setActive(false)
      .setVisible(false);
    this.pool.push(text);
    return text;
  }

  /**
   * Floats a message up and away.
   * @param {number} x
   * @param {number} y
   * @param {string} message
   */
  spawn(x, y, message, options = {}) {
    const {
      color = '#ffffff',
      fontSize = 54,
      duration = 780,
      rise = 110,
      drift = 0,
      scale = 1,
      delay = 0,
    } = options;

    const text = this.#take();
    text
      .setActive(true)
      .setVisible(true)
      .setPosition(x, y)
      .setText(message)
      .setColor(color)
      .setFontSize(fontSize)
      .setAlpha(0)
      .setScale(scale * 0.5)
      .setAngle(0);

    this.scene.tweens.killTweensOf(text);
    this.scene.tweens.add({
      targets: text,
      alpha: 1,
      scale: scale * 1.15,
      duration: 110,
      delay,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: text,
          y: y - rise,
          x: x + drift,
          alpha: 0,
          scale: scale * 0.85,
          angle: drift * 0.04,
          duration,
          ease: 'Quad.easeOut',
          onComplete: () => {
            text.setActive(false).setVisible(false);
          },
        });
      },
    });
    return text;
  }

  destroy() {
    this.pool.forEach((text) => text.destroy());
    this.pool.length = 0;
  }
}
