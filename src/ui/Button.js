import Phaser from 'phaser';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { FONTS } from '../config/constants.js';
import { fadeIn, popIn, popOut, pulse } from '../utils/fx.js';
import { audio } from '../audio/index.js';
import { drawIcon, ICON_NAMES } from './Icon.js';

/**
 * A reusable menu button.
 *
 * Design: flat fill + hairline border, no gloss and no drop shadow — chrome
 * stays quiet and the label (condensed caps) carries the weight. An optional
 * vector icon sits left of the label. Variants: `primary` (brand amber),
 * `ghost` (neutral surface), `danger`, `success`. Picker buttons can be
 * marked with `setSelected(true)` for a filled accent state.
 *
 * Features: hover / press / disabled / selected states, springy tweens,
 * hover + click SFX, keyboard "click" support and an animated entrance.
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
    this.hoverScale = 1.03;
    this.pressScale = 0.965;
    this.hovered = false;
    this.selected = false;

    this.bg = scene.add.graphics();
    this.add(this.bg);

    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: `${fontSize}px`,
        fontStyle: '800',
        letterSpacing: Math.max(1, Math.round(fontSize * 0.05)),
      })
      .setOrigin(0.5);
    this.add(this.label);

    this.iconGraphics = null;
    if (icon && ICON_NAMES.includes(icon)) {
      this.iconName = icon;
      this.iconGraphics = scene.add.graphics();
      this.add(this.iconGraphics);
    }

    this.setLabel(label);
    this.#draw();

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

  static paletteFor(variant, { selected = false, hover = false } = {}) {
    const base = {
      primary: {
        fill: COLORS.gold,
        fillHover: COLORS.goldLight,
        border: COLORS.gold,
        borderHover: COLORS.goldLight,
        text: CSS_COLORS.accentInk,
        textHover: CSS_COLORS.accentInk,
      },
      danger: {
        fill: COLORS.redDark,
        fillHover: COLORS.red,
        border: COLORS.red,
        borderHover: COLORS.red,
        text: CSS_COLORS.white,
        // Bright hover fill gets dark ink text (same rule as the gold primary).
        textHover: CSS_COLORS.accentInk,
      },
      success: {
        fill: COLORS.greenDark,
        fillHover: COLORS.green,
        border: COLORS.green,
        borderHover: COLORS.green,
        text: CSS_COLORS.white,
        textHover: CSS_COLORS.accentInk,
      },
      ghost: {
        fill: COLORS.panel,
        fillHover: COLORS.panelLight,
        border: COLORS.border,
        borderHover: COLORS.gold,
        text: CSS_COLORS.offWhite,
        textHover: CSS_COLORS.gold,
      },
    }[variant] ?? { fill: COLORS.gold, border: COLORS.gold, text: CSS_COLORS.accentInk };

    if (selected) {
      // Filled accent state used by picker rows (difficulty, rounds, quality).
      return {
        fill: COLORS.gold,
        fillHover: COLORS.goldLight,
        border: COLORS.gold,
        borderHover: COLORS.goldLight,
        text: CSS_COLORS.accentInk,
        textHover: CSS_COLORS.accentInk,
      };
    }
    if (!hover) return base;
    return {
      fill: base.fillHover,
      fillHover: base.fillHover,
      border: base.borderHover,
      borderHover: base.borderHover,
      text: base.textHover ?? base.text,
      textHover: base.textHover ?? base.text,
    };
  }

  #onDestroy() {
    this.removeAllListeners();
    this.scene?.tweens?.killTweensOf(this);
  }

  #draw() {
    const { width, height } = this;
    const palette = Button.paletteFor(this.variant, {
      selected: this.selected,
      hover: this.hovered && this.isEnabled,
    });
    const radius = Math.min(12, height / 3);
    const isGhostIdle = this.variant === 'ghost' && !this.selected && !this.hovered;

    this.bg.clear();
    this.bg.fillStyle(palette.fill, isGhostIdle ? 0.92 : 1);
    this.bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    this.bg.lineStyle(2.5, palette.border, 1);
    this.bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

    this.label.setColor(palette.text);
    this.#layoutContent(palette.text);
  }

  /** Centres [icon + label] as one group and repaints the icon colour. */
  #layoutContent(textColor) {
    const gap = 16;
    const iconSize = this.iconGraphics ? Math.round(this.label.height * 0.62) : 0;
    const total = (this.iconGraphics ? iconSize + gap : 0) + this.label.width;
    let startX = -total / 2;
    if (this.iconGraphics) {
      this.iconGraphics.setPosition(startX + iconSize / 2, 1);
      startX += iconSize + gap;
    }
    this.label.setPosition(startX + this.label.width / 2, 0);
    if (this.iconGraphics) {
      this.iconGraphics.clear();
      const iconColor = Phaser.Display.Color.HexStringToColor(textColor).color;
      drawIcon(this.iconGraphics, this.iconName, iconSize, iconColor, 1);
    }
  }

  #onOver(pointer) {
    if (!this.isEnabled) return;
    // Touch pointers fire over+out around every tap; only re-arm hover visuals
    // for the mouse so taps don't double-tween the scale.
    if (pointer?.wasTouch) return;
    this.hovered = true;
    this.#draw();
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
    // Sliding off mid-press cancels the click.
    this.pressed = false;
    this.hovered = false;
    if (!this.isEnabled) return;
    this.#draw();
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
    this.pressed = true;
    this.scene.tweens.add({
      targets: this,
      scaleX: this.pressScale,
      scaleY: this.pressScale,
      duration: 80,
      ease: 'Quad.easeOut',
    });
  }

  #onUp(pointer) {
    const wasPressed = this.pressed;
    this.pressed = false;
    // Only a press that started on the button counts as a click; a release
    // after dragging in from elsewhere just restores the hover state.
    if (!this.isEnabled || !wasPressed) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: pointer?.wasTouch ? 1 : this.hoverScale,
      scaleY: pointer?.wasTouch ? 1 : this.hoverScale,
      duration: 110,
      ease: 'Back.easeOut',
    });
    this.activate();
  }

  /** Programmatic activation (also used by keyboard shortcuts). */
  activate() {
    if (!this.isEnabled || !this.onClick) return false;
    audio.play(this.clickSound, { throttleMs: 40 });
    pulse(this, { amount: 1.06, duration: 120, baseScale: 1 });
    this.onClick(this);
    return true;
  }

  setEnabled(value) {
    this.isEnabled = Boolean(value);
    this.pressed = false;
    this.hovered = false;
    this.setAlpha(this.isEnabled ? 1 : 0.4);
    this.#draw();
    return this;
  }

  /** Picker-style selected state (filled accent for ghost buttons). */
  setSelected(value) {
    this.selected = Boolean(value);
    this.#draw();
    return this;
  }

  setLabel(text) {
    this.label.setText(String(text).toUpperCase());
    this.#draw();
    return this;
  }

  /** Swaps the vector icon (keeps the current state colours). */
  setIcon(name) {
    if (!this.iconGraphics || !ICON_NAMES.includes(name)) return this;
    this.iconName = name;
    this.#draw();
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
