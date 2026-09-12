import Phaser from 'phaser';
import {
  ANIMS,
  DEPTH,
  FONTS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  MODE,
  SCENES,
  SPRITE_ORIGIN,
  TEXTURE_KEYS,
} from '../config/constants.js';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { Arena } from '../systems/Arena.js';
import { Button } from '../ui/Button.js';
import { MenuNav } from '../ui/MenuNav.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { FX_TEXTURES } from '../utils/textures.js';
import { bob, fadeIn, popIn, slideIn } from '../utils/fx.js';
import { audio } from '../audio/index.js';
import { settings } from '../core/Settings.js';
import { stats } from '../core/Stats.js';

/**
 * Main menu: animated arena, mascot, mode selection and settings.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MENU });
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d1220');
    this.arena = new Arena(this, { reducedMotion: settings.get('reducedMotion') });

    this.#buildMascot();
    this.#buildTitle();
    this.#buildButtons();
    this.#buildFooter();

    this.settingsPanel = new SettingsPanel(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      onClose: () => audio.play('uiBack', { volume: 0.7 }),
    });
    this.settingsPanel.setVisible(false);
    this.add.existing(this.settingsPanel);

    this.input.keyboard?.on('keydown-G', () => this.#openGallery());
    this.input.keyboard?.on('keydown-S', () => this.#toggleSettings());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.settingsPanel.visible) this.settingsPanel.close();
    });

    audio.playMusic('menu');
    this.cameras.main.fadeIn(320, 13, 18, 32);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#cleanup());
  }

  /* --------------------------------- build --------------------------------- */

  #buildMascot() {
    const x = GAME_WIDTH * 0.28;
    const mascot = this.add
      .sprite(x, GROUND_Y, `${TEXTURE_KEYS.MONKEY}-${ANIMS.IDLE}`)
      .setOrigin(SPRITE_ORIGIN.x, SPRITE_ORIGIN.y)
      .setScale(1.25)
      .setDepth(DEPTH.FIGHTER);
    mascot.play({ key: ANIMS.IDLE, repeat: -1 });

    const shadow = this.add
      .image(x, GROUND_Y - 4, FX_TEXTURES.shadow)
      .setAlpha(0.4)
      .setDisplaySize(460, 110)
      .setDepth(DEPTH.SHADOW);

    this.mascot = mascot;
    this.mascotShadow = shadow;

    // Idle curiosity: look around / scratch every few seconds.
    this.time.addEvent({
      delay: 4200,
      loop: true,
      callback: () => {
        if (!mascot.scene) return;
        const options = [ANIMS.HEAD, ANIMS.PUNCH, ANIMS.STOMP, ANIMS.JUMP];
        const pick = Phaser.Utils.Array.GetRandom(options);
        mascot.play({ key: pick, repeat: 0 });
        if (pick === ANIMS.PUNCH) audio.play('swingLight', { volume: 0.35 });
        if (pick === ANIMS.JUMP) audio.play('jump', { volume: 0.3 });
        mascot.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (mascot.scene) mascot.play({ key: ANIMS.IDLE, repeat: -1 });
        });
      },
    });
  }

  #buildTitle() {
    const title = this.add
      .text(GAME_WIDTH * 0.5, 190, 'MONKEY MAYHEM', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '124px',
        fontStyle: 'bold',
        color: CSS_COLORS.gold,
        stroke: '#1a0f00',
        strokeThickness: 16,
        shadow: { offsetX: 0, offsetY: 10, color: '#000000', blur: 18, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    const subtitle = this.add
      .text(GAME_WIDTH * 0.5, 286, 'A 2D FIGHTING DEMO', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '42px',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setDepth(DEPTH.UI);

    popIn(title, { from: 0.7, to: 1, duration: 480, ease: 'Back.easeOut' });
    slideIn(subtitle, { from: 40, duration: 420, delay: 120 });
    bob(title, { offset: -10, duration: 2600 });
  }

  #buildButtons() {
    const x = GAME_WIDTH * 0.63;
    const startY = 430;

    const definitions = [
      {
        label: 'FIGHT',
        icon: '🥊',
        variant: 'primary',
        action: () => this.#startSetup(MODE.ARCADE),
      },
      {
        label: 'TRAINING',
        icon: '🎯',
        variant: 'success',
        action: () => this.#startSetup(MODE.TRAINING),
      },
      { label: 'MOVE GALLERY', icon: '🎬', variant: 'ghost', action: () => this.#openGallery() },
      { label: 'SETTINGS', icon: '⚙️', variant: 'ghost', action: () => this.#toggleSettings() },
    ];

    this.buttons = definitions.map((definition, index) => {
      const button = new Button(this, {
        x,
        y: startY + index * 132,
        width: 520,
        height: 104,
        label: definition.label,
        icon: definition.icon,
        fontSize: 42,
        variant: definition.variant,
        onClick: definition.action,
      }).setDepth(DEPTH.UI);
      button.appear(120 + index * 90);
      return button;
    });

    // Keyboard / d-pad navigation (arrows to move, ENTER to confirm).
    this.nav = new MenuNav(this, { items: this.buttons });
  }

  #buildFooter() {
    const hints = this.add
      .text(
        GAME_WIDTH * 0.5,
        GAME_HEIGHT - 150,
        '↑ ↓  select  ·  ENTER  confirm  ·  G  gallery  ·  S  settings\nMove  ← →  ·  Jump  ↑  ·  Block  ↓  ·  Punch  J  ·  Headbutt  K  ·  Stomp  L  ·  Pause  ESC',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '30px',
          color: CSS_COLORS.offWhite,
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 200 },
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.7)
      .setDepth(DEPTH.UI);

    const record = stats.values;
    const recordText = this.add
      .text(
        GAME_WIDTH * 0.5,
        GAME_HEIGHT - 80,
        record.matches > 0
          ? `Matches ${record.matches}  ·  Wins ${record.wins}  ·  Best combo ${record.bestCombo}  ·  Best score ${record.bestScore}`
          : 'First time in the arena? Try Training mode.',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '28px',
          color: CSS_COLORS.gold,
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    fadeIn(hints, { duration: 500, delay: 400 });
    fadeIn(recordText, { duration: 500, delay: 520 });
  }

  /* -------------------------------- actions -------------------------------- */

  #startSetup(mode) {
    if (this.transitioning) return;
    this.transitioning = true;
    audio.play('uiConfirm');
    this.cameras.main.fadeOut(260, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.SETUP, { mode });
    });
  }

  #openGallery() {
    if (this.transitioning) return;
    this.transitioning = true;
    audio.play('uiClick');
    this.cameras.main.fadeOut(240, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.GALLERY);
    });
  }

  #toggleSettings() {
    if (this.settingsPanel.visible) {
      this.settingsPanel.close();
      return;
    }
    audio.play('uiClick');
    this.settingsPanel.syncFromSettings().open();
  }

  #cleanup() {
    this.input.keyboard?.removeAllListeners();
    this.arena?.destroy();
  }

  /** Keeps the mascot shadow in sync (called on resize-like events). */
  update() {
    if (this.mascotShadow && this.mascot) {
      this.mascotShadow.setDisplaySize(460 * this.mascot.scaleX, 110);
    }
  }

  /** Called by the settings panel when colours change (reserved for themes). */
  refreshPalette() {
    this.cameras.main.setBackgroundColor(`#${COLORS.ink.toString(16).padStart(6, '0')}`);
  }
}
