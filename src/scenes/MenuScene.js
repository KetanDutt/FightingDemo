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
import { titleText } from '../ui/text.js';
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
    this.cameras.main.setBackgroundColor(CSS_COLORS.bg);
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
    this.cameras.main.fadeIn(320, 11, 15, 26);
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
    // Skipped entirely under reduced motion — the mascot just idles.
    if (!settings.get('reducedMotion'))
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
    const title = titleText(this, GAME_WIDTH * 0.5, 178, 'Monkey Mayhem', { size: 132 }).setDepth(
      DEPTH.UI,
    );

    const subtitle = this.add
      .text(GAME_WIDTH * 0.5, 268, 'A 2D FIGHTING DEMO', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '30px',
        fontStyle: '600',
        letterSpacing: 8,
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    popIn(title, { from: 0.7, to: 1, duration: 480, ease: 'Back.easeOut' });
    slideIn(subtitle, { from: 40, duration: 420, delay: 120 });
    if (!settings.get('reducedMotion')) bob(title, { offset: -10, duration: 2600 });
  }

  #buildButtons() {
    const x = GAME_WIDTH * 0.63;
    const startY = 424;

    const definitions = [
      {
        label: 'Fight',
        icon: 'fight',
        variant: 'primary',
        action: () => this.#startSetup(MODE.ARCADE),
      },
      {
        label: 'Training',
        icon: 'target',
        variant: 'success',
        action: () => this.#startSetup(MODE.TRAINING),
      },
      {
        label: 'Move gallery',
        icon: 'gallery',
        variant: 'ghost',
        action: () => this.#openGallery(),
      },
      {
        label: 'Settings',
        icon: 'settings',
        variant: 'ghost',
        action: () => this.#toggleSettings(),
      },
    ];

    this.buttons = definitions.map((definition, index) => {
      const button = new Button(this, {
        x,
        y: startY + index * 128,
        width: 500,
        height: 100,
        label: definition.label,
        icon: definition.icon,
        fontSize: 40,
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
    // Touch players get the touch layout; everyone else gets the keys.
    const touchMode = settings.get('showTouchControls') || this.sys.game.device.input.touch;
    const controlsLine = touchMode
      ? 'D-pad move · up jump · down / BLOCK guard · PUNCH · HEAD · STOMP attack'
      : 'Move ← → · Jump ↑ · Block ↓ · Punch J · Headbutt K · Stomp L · Pause ESC';
    const hints = this.add
      .text(
        GAME_WIDTH * 0.5,
        GAME_HEIGHT - 148,
        `↑ ↓ select · ENTER confirm · G gallery · S settings · M mute\n${controlsLine}`,
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '26px',
          fontStyle: '500',
          color: CSS_COLORS.muted,
          align: 'center',
          lineSpacing: 10,
          wordWrap: { width: GAME_WIDTH - 200 },
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    const record = stats.values;
    const recordText = this.add
      .text(
        GAME_WIDTH * 0.5,
        GAME_HEIGHT - 76,
        record.matches > 0
          ? `Matches ${record.matches} · Wins ${record.wins} · Best combo ${record.bestCombo} · Best score ${record.bestScore}`
          : 'First time in the arena? Try Training mode.',
        {
          fontFamily: FONTS.DISPLAY,
          fontSize: '30px',
          fontStyle: '700',
          letterSpacing: 1,
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
    audio.play('transition', { volume: 0.4 });
    this.cameras.main.fadeOut(260, 11, 15, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.SETUP, { mode });
    });
  }

  #openGallery() {
    if (this.transitioning) return;
    this.transitioning = true;
    audio.play('uiClick');
    audio.play('transition', { volume: 0.35 });
    this.cameras.main.fadeOut(240, 11, 15, 26);
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
