import Phaser from 'phaser';
import { COLORS } from '../config/palette.js';
import { clamp01 } from '../utils/math.js';

/**
 * Horizontal status bar with a delayed "chip" layer.
 *
 * Used for health (and reused for anything else that drains): the bright fill
 * moves instantly while the pale lag layer catches up a moment later, which
 * reads as impact without needing extra VFX.
 */
export class Bar extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const {
      x = 0,
      y = 0,
      width = 640,
      height = 44,
      radius = 14,
      fillColor = COLORS.green,
      lagColor = COLORS.gold,
      trackColor = 0x0a0e1b,
      /** `true` makes the bar drain towards the right (player two). */
      flip = false,
      dangerThreshold = 0.25,
      showTicks = true,
    } = config;

    super(scene, x, y);

    this.barWidth = width;
    this.barHeight = height;
    this.radius = radius;
    this.flip = flip;
    this.fillColor = fillColor;
    this.lagColor = lagColor;
    this.dangerThreshold = dangerThreshold;
    this.showTicks = showTicks;

    this.value = 1;
    this.lagValue = 1;
    this.lagDelay = 280;

    this.track = scene.add.graphics();
    this.lag = scene.add.graphics();
    this.fill = scene.add.graphics();
    this.overlay = scene.add.graphics();

    this.add([this.track, this.lag, this.fill, this.overlay]);
    this.#drawTrack(trackColor);
    this.render(1, 1);

    scene.add.existing(this);
  }

  #drawTrack(color) {
    const { barWidth: w, barHeight: h, radius: r } = this;
    this.track.clear();
    this.track.fillStyle(0x000000, 0.45);
    this.track.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 4);
    this.track.fillStyle(color, 1);
    this.track.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  }

  #barRect(ratio) {
    const { barWidth: w, barHeight: h, radius: r, flip } = this;
    const fillWidth = Math.max(0, w * clamp01(ratio));
    const x = flip ? w / 2 - fillWidth : -w / 2;
    return { x, y: -h / 2, width: fillWidth, height: h, radius: r };
  }

  render(value = this.value, lagValue = this.lagValue) {
    const fillRect = this.#barRect(value);
    const lagRect = this.#barRect(Math.max(value, lagValue));

    this.lag.clear();
    if (lagRect.width > 1) {
      this.lag.fillStyle(this.lagColor, 0.85);
      this.lag.fillRoundedRect(lagRect.x, lagRect.y, lagRect.width, lagRect.height, lagRect.radius);
    }

    this.fill.clear();
    if (fillRect.width > 1) {
      const color = value <= this.dangerThreshold ? COLORS.red : this.fillColor;
      this.fill.fillStyle(color, 1);
      this.fill.fillRoundedRect(
        fillRect.x,
        fillRect.y,
        fillRect.width,
        fillRect.height,
        fillRect.radius,
      );
      // gloss
      this.fill.fillStyle(0xffffff, 0.18);
      this.fill.fillRoundedRect(
        fillRect.x + 6,
        fillRect.y + 5,
        Math.max(0, fillRect.width - 12),
        fillRect.height * 0.32,
        fillRect.radius * 0.6,
      );
    }

    this.overlay.clear();
    this.overlay.lineStyle(3, 0xffffff, 0.25);
    this.overlay.strokeRoundedRect(
      -this.barWidth / 2,
      -this.barHeight / 2,
      this.barWidth,
      this.barHeight,
      this.radius,
    );
    if (this.showTicks) {
      this.overlay.lineStyle(2, 0x000000, 0.25);
      for (let i = 1; i < 5; i += 1) {
        const x = -this.barWidth / 2 + (this.barWidth / 5) * i;
        this.overlay.lineBetween(x, -this.barHeight / 2 + 4, x, this.barHeight / 2 - 4);
      }
    }
    return this;
  }

  /**
   * Sets the bar value (0..1).
   * @param {number} ratio
   * @param {{animate?:boolean, duration?:number, delayLag?:number}} options
   */
  setValue(ratio, options = {}) {
    const { animate = true, duration = 220, delayLag = this.lagDelay } = options;
    const next = clamp01(ratio);
    const previous = this.value;
    this.value = next;

    if (!animate) {
      this.lagValue = next;
      this.render();
      return this;
    }

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      value: next,
      duration: previous > next ? duration : Math.round(duration * 0.6),
      ease: 'Quad.easeOut',
      onUpdate: () => this.render(),
    });

    this.scene.tweens.add({
      targets: this,
      lagValue: next,
      delay: previous > next ? delayLag : 0,
      duration: 460,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.render(),
    });
    return this;
  }

  /** Flashes the bar white — used when damage lands. */
  flash() {
    this.setScale(1.03);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
    return this;
  }

  /** Keeps the danger pulse going while health is critical. */
  setDanger(isDanger) {
    if (isDanger && !this.dangerTween) {
      this.dangerTween = this.scene.tweens.add({
        targets: this,
        alpha: { from: 1, to: 0.65 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!isDanger && this.dangerTween) {
      this.dangerTween.stop();
      this.dangerTween = null;
      this.setAlpha(1);
    }
    return this;
  }
}
