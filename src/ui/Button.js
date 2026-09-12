import Phaser from 'phaser';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { FONTS } from '../config/constants.js';
import { fadeIn, popIn, popOut, pulse } from '../utils/fx.js';
import { audio } from '../audio/index.js';

/**
 * A polished, reusable button.
 *
 * Features: rounded panel + border, hover / press / disabled states, springy
 * tweens, hover + click SFX, keyboard "click" support for tests and an
 * optional icon glyph.
 */
export class Button extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const {
      x = 0,
      y = 0,
      width = 420,
      height = 108,
      label = 'Button',
      icon = '',
      fontSize = 44,
      variant = 'primary',
      onClick = null,
      sound = 'uiClick',
      enabled = true,
      onHover = null,
    } = config;

    super(scene, x, y);

    this.width = width;
    this.height = height;
    this.variant = variant;
    this.onClick = onClick;
    this.clickSound = sound;
    this.isEnabled = enabled;
    this.onHover = onHover;
    this.hoverScale = 1.045;
    this.pressScale = 0.955;

    const palette = Button.paletteFor(variant);
    this.palette = palette;

    this.bg = scene.add.graphics();
    this.border = scene.add.graphics();
    this.add([this.bg, this.border]);

    this.label = scene.add
      .text(icon ? 14 : 0, 0, label, {
        fontFamily: FONTS.PRIMARY,
        fontSize: `${fontSize}px`,
        color: palette.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(this.label);

    if (icon) {
      this.icon = scene.add
        .text(-this.label.width / 2 - 12, 0, icon, {
          fontFamily: FONTS.PRIMARY,
          fontSize: `${fontSize + 6}px`,
        })
        .setOrigin(1, 0.5);
      this.add(this.icon);
    }

    this.#draw(1);

    this.setSize(width, height);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );

    this.on(Phaser.GameObjects.Events.DESTROY, this.#onDestroy, this);
    this.on('pointerover', this.#onOver, this);
    this.on('pointerout', this.#onOut, this);
    this.on('pointerdown', this.#onDown, this);
    this.on('pointerup', this.#onUp, this);

    scene.add.existing(this);
  }

  static paletteFor(variant) {
    switch (variant) {
      case 'danger':
        return {
          fill: COLORS.redDark,
          fillHover: COLORS.red,
          border: COLORS.red,
          text: CSS_COLORS.white,
        };
      case 'ghost':
        return {
          fill: COLORS.panel,
          fillHover: COLORS.panelLight,
          border: COLORS.gold,
          text: CSS_COLORS.gold,
        };
      case 'success':
        return {
          fill: COLORS.greenDark,
          fillHover: COLORS.green,
          border: COLORS.green,
          text: CSS_COLORS.white,
        };
      case 'primary':
      default:
        return {
          fill: COLORS.goldDark,
          fillHover: COLORS.gold,
          border: COLORS.gold,
          text: '#23180a',
        };
    }
  }

  #onDestroy() {
    this.removeAllListeners();
    this.scene?.tweens?.killTweensOf(this);
  }

  #draw(hoverAmount) {
    const { width, height, palette } = this;
    const radius = Math.min(28, height / 2.5);
    const fill = hoverAmount > 0.5 ? palette.fillHover : palette.fill;

    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.28);
    this.bg.fillRoundedRect(-width / 2 + 3, -height / 2 + 8, width, height, radius);
    this.bg.fillStyle(fill, 1);
    this.bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    // subtle top gloss
    this.bg.fillStyle(0xffffff, 0.12);
    this.bg.fillRoundedRect(
      -width / 2 + 8,
      -height / 2 + 6,
      width - 16,
      height * 0.36,
      radius * 0.7,
    );

    this.border.clear();
    this.border.lineStyle(4, palette.border, hoverAmount > 0.5 ? 1 : 0.75);
    this.border.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  }

  #onOver() {
    if (!this.isEnabled) return;
    this.#draw(1);
    this.onHover?.(this);
    this.scene?.input?.setDefaultCursor?.('pointer');
    this.scene.tweens.add({
      targets: this,
      scaleX: this.hoverScale,
      scaleY: this.hoverScale,
      duration: 130,
      ease: 'Quad.easeOut',
    });
    audio.play('uiHover', { throttleMs: 60 });
  }

  #onOut() {
    if (!this.isEnabled) return;
    this.#draw(0);
    this.scene?.input?.setDefaultCursor?.('default');
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 130,
      ease: 'Quad.easeOut',
    });
  }

  #onDown() {
    if (!this.isEnabled) {
      audio.play('uiDenied', { throttleMs: 120 });
      return;
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: this.pressScale,
      scaleY: this.pressScale,
      duration: 80,
      ease: 'Quad.easeOut',
    });
  }

  #onUp() {
    if (!this.isEnabled) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: this.hoverScale,
      scaleY: this.hoverScale,
      duration: 110,
      ease: 'Back.easeOut',
    });
    this.activate();
  }

  /** Programmatic activation (also used by keyboard shortcuts). */
  activate() {
    if (!this.isEnabled || !this.onClick) return false;
    audio.play(this.clickSound, { throttleMs: 40 });
    pulse(this, { amount: 1.1, duration: 120, baseScale: 1 });
    this.onClick(this);
    return true;
  }

  setEnabled(value) {
    this.isEnabled = Boolean(value);
    this.setAlpha(this.isEnabled ? 1 : 0.45);
    this.#draw(this.isEnabled ? 0 : 0);
    return this;
  }

  setLabel(text) {
    this.label.setText(text);
    return this;
  }

  /** Animated entrance used by menus. */
  appear(delay = 0) {
    this.setAlpha(0);
    this.setScale(0.8);
    popIn(this, { from: 0.8, to: 1, duration: 320, delay, ease: 'Back.easeOut' });
    return this;
  }

  /** Animated exit; resolves when the tween finishes. */
  disappear(delay = 0, destroy = true) {
    return new Promise((resolve) => {
      const tween = popOut(this, { delay, duration: 160, destroy: false });
      if (!tween) {
        resolve();
        return;
      }
      tween.once('complete', () => {
        if (destroy && this.scene) this.destroy();
        resolve();
      });
    });
  }

  /** Re-shows a hidden button (used when returning from a sub scene). */
  reveal(delay = 0) {
    return fadeIn(this, { delay, duration: 200 });
  }
}
