import Phaser from 'phaser';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { FONTS, GAME_HEIGHT, GAME_WIDTH } from '../config/constants.js';
import { settings } from '../core/Settings.js';
import { stats } from '../core/Stats.js';
import { Button } from './Button.js';
import { Slider } from './Slider.js';
import { Toggle } from './Toggle.js';
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
      .fillStyle(0x05070f, 0.72)
      .fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
    this.add([this.dimmer, this.backdrop]);

    const panel = scene.add.graphics();
    panel.fillStyle(0x000000, 0.4);
    panel.fillRoundedRect(-width / 2 + 6, -height / 2 + 10, width, height, 36);
    panel.fillStyle(COLORS.panel, 0.98);
    panel.fillRoundedRect(-width / 2, -height / 2, width, height, 36);
    panel.lineStyle(4, COLORS.gold, 0.8);
    panel.strokeRoundedRect(-width / 2, -height / 2, width, height, 36);
    this.add(panel);

    const title = scene.add
      .text(0, -height / 2 + 60, 'SETTINGS', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '54px',
        fontStyle: 'bold',
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5);
    this.add(title);

    this.controls = [];

    /* ------------------------- two-column layout ------------------------- */

    const divider = scene.add.graphics();
    divider.lineStyle(2, COLORS.gold, 0.15);
    divider.lineBetween(0, -height / 2 + 120, 0, height / 2 - 120);
    this.add(divider);

    // Left column: volume / shake sliders.
    const leftX = -width / 2 + 60;
    let leftY = -height / 2 + 180;

    const addSlider = (label, key) => {
      const slider = new Slider(scene, {
        x: leftX,
        y: leftY,
        width: width * 0.42,
        value: settings.get(key),
        label,
        onChange: (value) => settings.set(key, value),
      });
      this.add(slider);
      this.controls.push(() => slider.setValue(settings.get(key), { silent: true }));
      leftY += 96;
      return slider;
    };

    addSlider('Master volume', 'masterVolume');
    addSlider('Sound effects', 'sfxVolume');
    addSlider('Music', 'musicVolume');
    addSlider('Screen shake', 'screenShake');

    // Particle quality lives under the sliders.
    const qualityLabel = scene.add
      .text(leftX, leftY - 6, 'Particles', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '30px',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0, 0.5);
    this.add(qualityLabel);

    this.qualityButtons = QUALITY_LABELS.map((label, index) => {
      const button = new Button(scene, {
        x: leftX + 150 + index * 130,
        y: leftY - 6,
        width: 116,
        height: 56,
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
    const rightX = 60;
    let rightY = -height / 2 + 176;

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
      rightY += 82;
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
    const footerY = height / 2 - 76;
    this.resetButton = new Button(scene, {
      x: -180,
      y: footerY,
      width: 300,
      height: 84,
      label: 'Reset data',
      fontSize: 30,
      variant: 'danger',
      onClick: () => this.#resetData(),
    });
    this.add(this.resetButton);

    this.closeButton = new Button(scene, {
      x: 190,
      y: footerY,
      width: 300,
      height: 84,
      label: 'Done',
      fontSize: 34,
      variant: 'primary',
      onClick: () => this.close(),
    });
    this.add(this.closeButton);

    this.#refreshQuality();
    this.setAlpha(0);
    this.setScale(0.9);
    scene.add.existing(this);
  }

  #refreshQuality() {
    const current = settings.get('particleQuality');
    this.qualityButtons.forEach((button, index) => {
      button.setAlpha(index === current ? 1 : 0.4);
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
