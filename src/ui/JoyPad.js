import Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/constants.js';
import { COLORS } from '../config/palette.js';

/**
 * On-screen D-pad.
 *
 * The artwork (`assets/joypad.png`) is a round pad with four triangles; the
 * hot spots below are the measured centres of those triangles, expressed as
 * fractions of the image, so the hit zones stay aligned if the art is rescaled.
 */
const ARROWS = {
  left: { x: 0.198, y: 0.473 },
  right: { x: 0.797, y: 0.473 },
  up: { x: 0.497, y: 0.172 },
  down: { x: 0.497, y: 0.78 },
};

export class JoyPad extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const { x = 0, y = 0, scale = 0.62, alpha = 0.92, onDirection = null } = config;

    super(scene, x, y);
    this.setScale(scale);
    this.setAlpha(alpha);
    this.onDirection = onDirection;
    this.pressed = new Set();

    this.base = scene.add.image(0, 0, TEXTURE_KEYS.JOYPAD).setOrigin(0.5);
    this.add(this.base);

    const width = this.base.width;
    const height = this.base.height;
    const zoneRadius = Math.min(width, height) * 0.21;

    this.highlights = {};
    this.zones = {};

    Object.entries(ARROWS).forEach(([direction, point]) => {
      const localX = (point.x - 0.5) * width;
      const localY = (point.y - 0.5) * height;

      const highlight = scene.add.graphics({ x: localX, y: localY }).setAlpha(0);
      highlight.fillStyle(COLORS.gold, 0.55);
      highlight.fillCircle(0, 0, zoneRadius * 0.86);
      highlight.lineStyle(4, 0xffffff, 0.7);
      highlight.strokeCircle(0, 0, zoneRadius * 0.86);
      this.add(highlight);
      this.highlights[direction] = highlight;

      const zone = scene.add
        .zone(localX, localY, zoneRadius * 1.9, zoneRadius * 1.9)
        .setOrigin(0.5);
      zone.setInteractive({ useHandCursor: true });
      this.add(zone);
      this.zones[direction] = zone;

      zone.on('pointerdown', () => this.#press(direction));
      zone.on('pointerup', () => this.#release(direction));
      zone.on('pointerout', () => this.#release(direction));
    });

    // A pointer that leaves the canvas never fires `pointerup` on the zone.
    this.globalUp = () => this.releaseAll();
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.globalUp);
    this.on(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.globalUp);
    });

    scene.add.existing(this);
  }

  #press(direction) {
    if (this.pressed.has(direction)) return;
    this.pressed.add(direction);
    const highlight = this.highlights[direction];
    if (highlight) {
      this.scene.tweens.killTweensOf(highlight);
      highlight.setAlpha(1);
      highlight.setScale(0.8);
      this.scene.tweens.add({
        targets: highlight,
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: 'Back.easeOut',
      });
    }
    this.onDirection?.(direction, true);
  }

  #release(direction) {
    if (!this.pressed.has(direction)) return;
    this.pressed.delete(direction);
    const highlight = this.highlights[direction];
    if (highlight) {
      this.scene.tweens.killTweensOf(highlight);
      this.scene.tweens.add({ targets: highlight, alpha: 0, duration: 120 });
    }
    this.onDirection?.(direction, false);
  }

  releaseAll() {
    [...this.pressed].forEach((direction) => this.#release(direction));
  }

  isPressed(direction) {
    return this.pressed.has(direction);
  }
}
