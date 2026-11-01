import Phaser from 'phaser';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { FONTS } from '../config/constants.js';
import { audio } from '../audio/index.js';

/**
 * Labelled switch used by the settings panel.
 */
export class Toggle extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const { x = 0, y = 0, label = '', value = false, onChange = null, width = 96 } = config;

    super(scene, x, y);
    this.onChange = onChange;
    this.value = Boolean(value);
    this.trackWidth = width;
    this.trackHeight = Math.round(width * 0.52);

    this.label = scene.add
      .text(0, 0, label, {
        fontFamily: FONTS.PRIMARY,
        fontSize: '28px',
        fontStyle: '500',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0, 0.5);
    this.add(this.label);

    // The switch sits to the right of the label, never on top of it.
    const trackX = this.label.width + 52;
    this.track = scene.add.graphics({ x: trackX, y: 0 });
    this.add(this.track);

    this.knob = scene.add.graphics({ x: trackX, y: 0 });
    this.add(this.knob);

    const totalWidth = trackX + width;
    this.zone = scene.add.zone(totalWidth / 2, 0, totalWidth + 24, 76).setOrigin(0.5);
    this.zone.setInteractive({ useHandCursor: true });
    this.add(this.zone);
    this.zone.on('pointerup', () => this.toggle());

    this.#redraw(false);
    scene.add.existing(this);
  }

  #redraw(animate = true) {
    const w = this.trackWidth;
    const h = this.trackHeight;
    const r = h / 2;

    this.track.clear();
    // On = brand accent (an enabled setting is the accent's job here, not a
    // "success" state); off = quiet surface with a hairline border.
    this.track.fillStyle(this.value ? COLORS.gold : COLORS.panelLight, 1);
    this.track.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    this.track.lineStyle(2.5, this.value ? COLORS.gold : COLORS.border, 1);
    this.track.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    const knobX = (this.value ? 1 : -1) * (w / 2 - h / 2 - 4);
    this.knob.clear();
    this.knob.fillStyle(this.value ? COLORS.accentInk : COLORS.offWhite, 1);
    this.knob.fillCircle(knobX, 0, h * 0.36);

    if (animate && this.scene?.tweens) {
      this.scene.tweens.add({
        targets: this.knob,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 110,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  setValue(value, { silent = false } = {}) {
    const next = Boolean(value);
    const changed = next !== this.value;
    this.value = next;
    this.#redraw(changed);
    if (changed && !silent) this.onChange?.(next);
    return this;
  }

  toggle() {
    this.setValue(!this.value);
    audio.play('uiClick', { volume: 0.7 });
    return this;
  }
}
