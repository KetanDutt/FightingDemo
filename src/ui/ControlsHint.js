import Phaser from 'phaser';
import { FONTS } from '../config/constants.js';
import { CSS_COLORS } from '../config/palette.js';

/**
 * On-screen keyboard controls legend for the fight scene.
 *
 * Keyboard players get a bottom-centre pill spelling out every binding: the
 * primary keys (arrows + J / K / L) as chips on the main row, alternates
 * underneath. Clicking the pill — or pressing H — collapses it to a small
 * chip, and back again.
 *
 * Touch players get the d-pad + action buttons instead (see FightScene), so
 * the legend auto-collapses to its chip form whenever touch mode is active.
 */
const PRIMARY_BINDINGS = [
  { keys: ['←', '→'], label: 'move' },
  { keys: ['↑', 'Space'], label: 'jump' },
  { keys: ['↓'], label: 'block' },
  { keys: ['J'], label: 'punch' },
  { keys: ['K'], label: 'head' },
  { keys: ['L'], label: 'stomp' },
  { keys: ['ESC'], label: 'pause' },
];

const CHIP_FONT_SIZE = 24;
const LABEL_FONT_SIZE = 24;
const ALT_FONT_SIZE = 22;
const PAD_X = 30;
const PAD_Y = 18;
const ROW_GAP = 10;

export class ControlsHint extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const {
      x = 0,
      y = 0,
      training = false,
      expanded = true,
      baseAlpha = 0.95,
      dimAlpha = 0.55,
      dimDelay = 9000,
      onToggle = null,
    } = config;

    super(scene, x, y);

    this.baseAlpha = baseAlpha;
    this.dimAlpha = dimAlpha;
    this.dimDelay = dimDelay;
    this.onToggle = onToggle;
    this.expanded = Boolean(expanded);
    this.dimEvent = null;

    this.expandedGroup = scene.add.container(0, 0);
    this.collapsedGroup = scene.add.container(0, 0);
    this.add([this.expandedGroup, this.collapsedGroup]);

    this.#buildExpanded(training);
    this.#buildCollapsed();
    this.#applyMode();

    this.setAlpha(0);
    scene.add.existing(this);
    scene.tweens.add({
      targets: this,
      alpha: baseAlpha,
      duration: 450,
      delay: 700,
      ease: 'Quad.easeOut',
    });
    if (this.expanded) this.#scheduleDim();

    this.on(Phaser.GameObjects.Events.DESTROY, () => {
      this.dimEvent?.remove(false);
      this.dimEvent = null;
    });
  }

  get isExpanded() {
    return this.expanded;
  }

  setExpanded(expanded, { silent = false } = {}) {
    const next = Boolean(expanded);
    if (next === this.expanded) return this;
    this.expanded = next;
    this.#applyMode();
    if (!silent) this.onToggle?.(next);
    return this;
  }

  toggle() {
    return this.setExpanded(!this.expanded);
  }

  #applyMode() {
    this.expandedGroup.setVisible(this.expanded);
    this.collapsedGroup.setVisible(!this.expanded);
    this.dimEvent?.remove(false);
    this.dimEvent = null;
    this.scene?.tweens?.killTweensOf(this);
    if (this.expanded) {
      this.setAlpha(this.baseAlpha);
      this.#scheduleDim();
    } else {
      this.setAlpha(0.85);
    }
  }

  /** Fades the full legend down so it stops competing with the fight. */
  #scheduleDim() {
    if (!this.scene) return;
    this.dimEvent?.remove(false);
    this.dimEvent = this.scene.time.delayedCall(this.dimDelay, () => {
      this.dimEvent = null;
      if (!this.scene || !this.expanded) return;
      this.scene.tweens.add({
        targets: this,
        alpha: this.dimAlpha,
        duration: 800,
        ease: 'Quad.easeOut',
      });
    });
  }

  #makeChip(key) {
    const { scene } = this;
    const text = scene.add
      .text(0, 0, key, {
        fontFamily: FONTS.PRIMARY,
        fontSize: `${CHIP_FONT_SIZE}px`,
        fontStyle: 'bold',
        color: CSS_COLORS.white,
      })
      .setOrigin(0.5);
    const width = Math.max(30, text.width + 24);
    const height = text.height + 14;
    const background = scene.add.graphics();
    background.fillStyle(0xffffff, 0.13);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    background.lineStyle(2, 0xffffff, 0.35);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    const container = scene.add.container(0, 0, [background, text]);
    return { container, width, height };
  }

  #buildExpanded(training) {
    const { scene } = this;
    const row = scene.add.container(0, 0);

    let cursorX = 0;
    let rowHeight = 0;
    PRIMARY_BINDINGS.forEach((binding, index) => {
      binding.keys.forEach((key) => {
        const chip = this.#makeChip(key);
        chip.container.setPosition(cursorX + chip.width / 2, 0);
        row.add(chip.container);
        cursorX += chip.width + 8;
        rowHeight = Math.max(rowHeight, chip.height);
      });
      cursorX += 4; // breathing room between the chips and the label
      const label = scene.add
        .text(cursorX, 0, binding.label, {
          fontFamily: FONTS.PRIMARY,
          fontSize: `${LABEL_FONT_SIZE}px`,
          color: CSS_COLORS.muted,
        })
        .setOrigin(0, 0.5);
      row.add(label);
      cursorX += label.width;
      rowHeight = Math.max(rowHeight, label.height);
      if (index < PRIMARY_BINDINGS.length - 1) {
        cursorX += 26;
        const separator = scene.add
          .text(cursorX, 0, '·', {
            fontFamily: FONTS.PRIMARY,
            fontSize: `${LABEL_FONT_SIZE}px`,
            color: CSS_COLORS.gold,
          })
          .setOrigin(0, 0.5)
          .setAlpha(0.5);
        row.add(separator);
        cursorX += separator.width + 26;
      }
    });
    const rowWidth = cursorX;

    const altLine = training
      ? 'also: A/D move · W jump · S block · Z punch · X head · C stomp · R reset · gamepad supported'
      : 'also: A/D move · W jump · S block · Z punch · X head · C stomp · gamepad supported';
    const alt = scene.add
      .text(0, 0, altLine, {
        fontFamily: FONTS.PRIMARY,
        fontSize: `${ALT_FONT_SIZE}px`,
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    const contentHeight = rowHeight + ROW_GAP + alt.height;
    row.setPosition(-rowWidth / 2, -contentHeight / 2 + rowHeight / 2);
    alt.setPosition(0, contentHeight / 2 - alt.height / 2);

    const backgroundWidth = Math.max(rowWidth, alt.width) + PAD_X * 2;
    const backgroundHeight = contentHeight + PAD_Y * 2;
    const background = scene.add.graphics();
    background.fillStyle(0x05070f, 0.62);
    background.fillRoundedRect(
      -backgroundWidth / 2,
      -backgroundHeight / 2,
      backgroundWidth,
      backgroundHeight,
      26,
    );
    background.lineStyle(2, 0xffc93c, 0.28);
    background.strokeRoundedRect(
      -backgroundWidth / 2,
      -backgroundHeight / 2,
      backgroundWidth,
      backgroundHeight,
      26,
    );

    const zone = scene.add
      .zone(0, 0, backgroundWidth, backgroundHeight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.toggle());

    this.expandedGroup.add([background, row, alt, zone]);
  }

  #buildCollapsed() {
    const { scene } = this;
    const label = scene.add
      .text(0, 0, '⌨ CONTROLS · H', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '26px',
        fontStyle: 'bold',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0.5);
    const backgroundWidth = label.width + 56;
    const backgroundHeight = label.height + 26;
    const background = scene.add.graphics();
    background.fillStyle(0x05070f, 0.62);
    background.fillRoundedRect(
      -backgroundWidth / 2,
      -backgroundHeight / 2,
      backgroundWidth,
      backgroundHeight,
      20,
    );
    background.lineStyle(2, 0xffc93c, 0.28);
    background.strokeRoundedRect(
      -backgroundWidth / 2,
      -backgroundHeight / 2,
      backgroundWidth,
      backgroundHeight,
      20,
    );

    const zone = scene.add
      .zone(0, 0, backgroundWidth, backgroundHeight)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.toggle());

    this.collapsedGroup.add([background, label, zone]);
  }
}
