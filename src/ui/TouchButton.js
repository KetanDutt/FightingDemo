import Phaser from 'phaser';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { FONTS } from '../config/constants.js';

/**
 * Circular touch button used by the on-screen controls.
 *
 * Zones are used instead of Graphics for hit testing: they are cheap, stable
 * and support multi-touch (the game configures extra pointers at boot).
 */
export class TouchButton extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const {
      x = 0,
      y = 0,
      radius = 64,
      label = '',
      subLabel = '',
      color = COLORS.blue,
      fontSize = 26,
      onPress = null,
      onRelease = null,
      holdable = false,
    } = config;

    super(scene, x, y);

    this.radius = radius;
    this.onPress = onPress;
    this.onRelease = onRelease;
    this.holdable = holdable;
    this.isDown = false;
    this.baseColor = color;

    this.ring = scene.add.graphics();
    this.add(this.ring);
    this.#drawRing(0);

    if (label) {
      this.label = scene.add
        .text(0, subLabel ? -8 : 0, label, {
          fontFamily: FONTS.PRIMARY,
          fontSize: `${fontSize}px`,
          color: CSS_COLORS.white,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.add(this.label);
    }

    if (subLabel) {
      this.subLabel = scene.add
        .text(0, fontSize * 0.75, subLabel, {
          fontFamily: FONTS.PRIMARY,
          fontSize: `${Math.round(fontSize * 0.62)}px`,
          color: 'rgba(255,255,255,0.75)',
        })
        .setOrigin(0.5);
      this.add(this.subLabel);
    }

    this.zone = scene.add.zone(0, 0, radius * 2, radius * 2).setOrigin(0.5);
    this.add(this.zone);
    this.zone.setInteractive({ useHandCursor: true });

    this.zone.on('pointerdown', this.#handleDown, this);
    this.zone.on('pointerup', this.#handleUp, this);
    this.zone.on('pointerout', this.#handleUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.#handleGlobalUp, this);

    this.on(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.#handleGlobalUp, this);
    });

    scene.add.existing(this);
  }

  #drawRing(pressAmount) {
    const { radius: r } = this;
    this.ring.clear();
    this.ring.fillStyle(0x000000, 0.35);
    this.ring.fillCircle(0, 4, r);
    this.ring.fillStyle(this.baseColor, pressAmount > 0 ? 0.85 : 0.42);
    this.ring.fillCircle(0, 0, r);
    this.ring.fillStyle(0xffffff, pressAmount > 0 ? 0.22 : 0.1);
    this.ring.fillCircle(0, -r * 0.25, r * 0.58);
    this.ring.lineStyle(4, 0xffffff, pressAmount > 0 ? 0.95 : 0.55);
    this.ring.strokeCircle(0, 0, r);
  }

  #handleDown() {
    if (this.isDown) return;
    this.isDown = true;
    this.#drawRing(1);
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 90,
      ease: 'Quad.easeOut',
    });
    this.onPress?.(this);
    if (!this.holdable) {
      this.scene.time.delayedCall(110, () => this.#handleUp());
    }
  }

  #handleUp() {
    if (!this.isDown) return;
    this.isDown = false;
    this.#drawRing(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 130,
      ease: 'Back.easeOut',
    });
    this.onRelease?.(this);
  }

  /** Guarantees a released state even when the pointer leaves the canvas. */
  #handleGlobalUp() {
    if (this.isDown) this.#handleUp();
  }

  setColor(color) {
    this.baseColor = color;
    this.#drawRing(this.isDown ? 1 : 0);
    return this;
  }
}
