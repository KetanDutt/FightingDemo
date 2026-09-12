import Phaser from 'phaser';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { FONTS } from '../config/constants.js';
import { clamp01 } from '../utils/math.js';

/**
 * Horizontal slider with drag support.
 *
 * Used for the volume controls; the value is always 0..1 and reported through
 * `onChange` so the settings manager stays the single source of truth.
 */
export class Slider extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const {
      x = 0,
      y = 0,
      width = 380,
      height = 18,
      value = 1,
      color = COLORS.gold,
      label = '',
      onChange = null,
      format = (v) => `${Math.round(v * 100)}%`,
    } = config;

    super(scene, x, y);

    this.sliderWidth = width;
    this.sliderHeight = height;
    this.color = color;
    this.onChange = onChange;
    this.formatValue = format;
    this.value = clamp01(value);
    this.dragging = false;

    this.track = scene.add.graphics();
    this.fill = scene.add.graphics();
    this.knob = scene.add.graphics();
    this.add([this.track, this.fill, this.knob]);

    if (label) {
      this.label = scene.add
        .text(0, -34, label, {
          fontFamily: FONTS.PRIMARY,
          fontSize: '30px',
          color: CSS_COLORS.offWhite,
        })
        .setOrigin(0, 0.5);
      this.add(this.label);
    }

    this.valueText = scene.add
      .text(width + 26, 0, format(this.value), {
        fontFamily: FONTS.PRIMARY,
        fontSize: '28px',
        color: CSS_COLORS.gold,
      })
      .setOrigin(0, 0.5);
    this.add(this.valueText);

    this.zone = scene.add.zone(width / 2, 0, width + 50, Math.max(56, height + 40)).setOrigin(0.5);
    this.zone.setInteractive({ useHandCursor: true });
    this.add(this.zone);

    this.zone.on('pointerdown', (pointer) => {
      this.dragging = true;
      this.#updateFromPointer(pointer);
    });

    this.moveHandler = (pointer) => {
      if (this.dragging) this.#updateFromPointer(pointer);
    };
    this.upHandler = () => {
      this.dragging = false;
    };
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.moveHandler);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.upHandler);

    this.on(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.moveHandler);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.upHandler);
    });

    this.#redraw();
    scene.add.existing(this);
  }

  #updateFromPointer(pointer) {
    const localX = pointer.worldX - this.x;
    this.setValue(clamp01(localX / this.sliderWidth));
  }

  #redraw() {
    const w = this.sliderWidth;
    const h = this.sliderHeight;
    const r = h / 2;

    this.track.clear();
    this.track.fillStyle(0x000000, 0.4);
    this.track.fillRoundedRect(-4, -h / 2 - 2, w + 8, h + 4, r + 2);
    this.track.fillStyle(COLORS.panelLight, 1);
    this.track.fillRoundedRect(0, -h / 2, w, h, r);

    const filled = Math.max(0, w * this.value);
    this.fill.clear();
    if (filled > 2) {
      this.fill.fillStyle(this.color, 1);
      this.fill.fillRoundedRect(0, -h / 2, filled, h, r);
    }

    this.knob.clear();
    this.knob.fillStyle(0x000000, 0.35);
    this.knob.fillCircle(filled, 4, h * 0.95);
    this.knob.fillStyle(0xffffff, 1);
    this.knob.fillCircle(filled, 0, h * 0.95);
    this.knob.lineStyle(3, this.color, 1);
    this.knob.strokeCircle(filled, 0, h * 0.95);
  }

  setValue(value, { silent = false } = {}) {
    const next = clamp01(value);
    const changed = next !== this.value;
    this.value = next;
    this.valueText?.setText(this.formatValue(next));
    this.#redraw();
    if (changed && !silent) this.onChange?.(next);
    return this;
  }
}
