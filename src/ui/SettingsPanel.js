import Phaser from 'phaser';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { DEPTH, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config/constants.js';
import { settings } from '../core/Settings.js';
import { stats } from '../core/Stats.js';
import { Button } from './Button.js';
import { Slider } from './Slider.js';
import { Toggle } from './Toggle.js';
import { sectionLabel, titleText } from './text.js';
import { popIn, popOut } from '../utils/fx.js';

const QUALITY_LABELS = ['Off', 'Normal', 'High'];

/**
 * Slide-in settings panel shared by the main menu and the pause screen.
 * Every control writes straight to the settings manager, which persists and
 * broadcasts the change.
 */
export class SettingsPanel extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const {
      x = GAME_WIDTH / 2,
      y = GAME_HEIGHT / 2,
      width = 1160,
      height = 780,
      onClose = null,
      /** Hide controls that make no sense mid-match. */
      compact = false,
    } = config;

    super(scene, x, y);

    this.panelWidth = width;
    this.panelHeight = height;
    this.onClose = onClose;

    // Dimmed, click-blocking backdrop covering the whole screen.
    this.backdrop = scene.add
      .zone(GAME_WIDTH / 2 - x, GAME_HEIGHT / 2 - y, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();
    this.dimmer = scene.add
      .graphics({ x: GAME_WIDTH / 2 - x, y: GAME_HEIGHT / 2 - y })
      .fillStyle(COLORS.shadow, 0.66)
      .fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
    this.add([this.dimmer, this.backdrop]);

    // Flat surface + hairline border; the dimmer does the separation work.
    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.panel, 0.98);
    panel.fillRoundedRect(-width / 2, -height / 2, width, height, 20);
    panel.lineStyle(2, COLORS.border, 1);
    panel.strokeRoundedRect(-width / 2, -height / 2, width, height, 20);
    this.add(panel);

    const title = titleText(scene, -width / 2 + 56, -height / 2 + 66, 'Settings', { size: 52 });
    title.setOrigin(0, 0.5);
    this.add(title);

    this.controls = [];

    /* ------------------------- two-column layout ------------------------- */

    const divider = scene.add.graphics();
    divider.lineStyle(1.5, COLORS.border, 1);
    divider.lineBetween(0, -height / 2 + 116, 0, height / 2 - 116);
    this.add(divider);

    // Left column: volume / shake sliders.
    const leftX = -width / 2 + 56;
    this.add(sectionLabel(scene, leftX, -height / 2 + 132, 'Audio & effects', { align: 'left' }));
    // Compact (pause) panels are shorter — tighten the slider rows so the
    // particles row never collides with the footer buttons.
    const rowStep = compact ? 84 : 94;
    let leftY = -height / 2 + (compact ? 184 : 196);

    const addSlider = (label, key) => {
      const slider = new Slider(scene, {
        x: leftX,
        y: leftY,
        width: width * 0.38,
        value: settings.get(key),
        label,
        onChange: (value) => settings.set(key, value),
      });
      this.add(slider);
      this.controls.push(() => slider.setValue(settings.get(key), { silent: true }));
      leftY += rowStep;
      return slider;
    };

    addSlider('Master volume', 'masterVolume');
    addSlider('Sound effects', 'sfxVolume');
    addSlider('Music', 'musicVolume');
    addSlider('Screen shake', 'screenShake');

    // Particle quality lives under the sliders.
    const qualityLabel = scene.add
      .text(leftX, leftY - 4, 'Particles', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '27px',
        fontStyle: '500',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0, 0.5);
    this.add(qualityLabel);

    const qualityRowX = leftX + qualityLabel.width + 40 + 57;
    this.qualityButtons = QUALITY_LABELS.map((label, index) => {
      const button = new Button(scene, {
        x: qualityRowX + index * 128,
        y: leftY - 4,
        width: 114,
        height: 54,
        label,
        fontSize: 24,
        variant: 'ghost',
        onClick: () => {
          settings.set('particleQuality', index);
          this.#refreshQuality();
        },
      });
      this.add(button);
      return button;
    });

    // Right column: toggles.
    const rightX = 56;
    this.add(sectionLabel(scene, rightX, -height / 2 + 132, 'Preferences', { align: 'left' }));
    let rightY = -height / 2 + 190;

    const addToggle = (label, key) => {
      const toggle = new Toggle(scene, {
        x: rightX,
        y: rightY,
        label,
        value: settings.get(key),
        onChange: (value) => settings.set(key, value),
      });
      this.add(toggle);
      this.controls.push(() => toggle.setValue(settings.get(key), { silent: true }));
      rightY += 78;
      return toggle;
    };

    addToggle('Reduced motion', 'reducedMotion');
    addToggle('Hit-stop (freeze frames)', 'hitStop');
    addToggle('Show FPS', 'showFps');
    if (!compact) {
      addToggle('Colour-blind friendly', 'colorblindMode');
    }
    // Both apply live mid-match, so they stay available while paused.
    addToggle('On-screen controls', 'showTouchControls');
    addToggle('Control hints', 'showControlsHint');

    // Footer buttons
    const footerY = height / 2 - 72;
    this.resetButton = new Button(scene, {
      x: -190,
      y: footerY,
      width: 300,
      height: 80,
      label: 'Reset data',
      fontSize: 28,
      variant: 'danger',
      onClick: () => this.#resetData(),
    });
    this.add(this.resetButton);

    this.closeButton = new Button(scene, {
      x: 190,
      y: footerY,
      width: 300,
      height: 80,
      label: 'Done',
      fontSize: 32,
      variant: 'primary',
      onClick: () => this.close(),
    });
    this.add(this.closeButton);

    this.#refreshQuality();
    this.setAlpha(0);
    this.setScale(0.9);
    // The panel is modal: it must render (and hit-test) above the host menu's
    // buttons, which live at DEPTH.UI. Without this it is drawn *behind* the
    // existing menu and the dimmer never covers the buttons.
    this.setDepth(DEPTH.OVERLAY);
    scene.add.existing(this);
  }

  #refreshQuality() {
    const current = settings.get('particleQuality');
    this.qualityButtons.forEach((button, index) => {
      button.setSelected(index === current);
    });
  }

  #resetData() {
    settings.reset();
    stats.reset();
    this.syncFromSettings();
  }

  /** Pushes current settings values back into the widgets. */
  syncFromSettings() {
    this.controls.forEach((sync) => sync());
    this.#refreshQuality();
    return this;
  }

  open() {
    this.setVisible(true);
    this.setAlpha(0);
    popIn(this, { from: 0.88, to: 1, duration: 280, ease: 'Back.easeOut' });
    return this;
  }

  close() {
    popOut(this, { duration: 180, destroy: false }).once('complete', () => {
      this.setVisible(false);
      this.onClose?.();
    });
    return this;
  }

  destroy(fromScene) {
    this.scene?.tweens?.killTweensOf(this);
    super.destroy(fromScene);
  }
}
