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
        fontSize: '30px',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0, 0.5);
    this.add(this.label);

    this.track = scene.add.graphics({ x: width + 40, y: 0 });
    this.add(this.track);

    this.knob = scene.add.graphics({ x: width + 40, y: 0 });
    this.add(this.knob);

    this.zone = scene.add.zone(width / 2 + 20, 0, width + this.label.width + 80, 72).setOrigin(0.5);
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
    this.track.fillStyle(this.value ? COLORS.greenDark : COLORS.panelLight, 1);
    this.track.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    this.track.lineStyle(3, this.value ? COLORS.green : 0x5b6785, 1);
    this.track.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    const knobX = (this.value ? 1 : -1) * (w / 2 - h / 2 - 4);
    this.knob.clear();
    this.knob.fillStyle(0x000000, 0.3);
    this.knob.fillCircle(knobX, 3, h * 0.36);
    this.knob.fillStyle(0xffffff, 1);
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
