import Phaser from 'phaser';
import {
  ANIMS,
  FONTS,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENES,
  TEXTURE_KEYS,
} from '../config/constants.js';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { FX_TEXTURES } from '../utils/textures.js';
import { ANIMATION_DATA } from '../data/animations.js';
import { createAnimations } from '../utils/frames.js';
import { fadeIn, popIn } from '../utils/fx.js';
import { audio } from '../audio/index.js';

const TIPS = [
  'Hold BLOCK to shrug off light attacks — but heavy hits still chip away.',
  'Jump over a punch: airborne frames dodge anything that is not a stomp.',
  'Chain attacks quickly to build a combo — damage scales down, style scales up.',
  'A blocked heavy attack still pushes you back. Use it to make space.',
  'The training mode never ends: perfect for learning your reach.',
];

/**
 * Loads the sprite atlases while showing a proper progress bar, then builds
 * every animation and moves on to the main menu.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.PRELOAD });
    this.failed = false;
  }

  preload() {
    this.#buildLoaderUi();

    this.load.on(Phaser.Loader.Events.PROGRESS, this.#onProgress, this);
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.#onFileComplete, this);
    this.load.on(Phaser.Loader.Events.COMPLETE, this.#onComplete, this);
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, this.#onError, this);

    ANIMATION_DATA.forEach(({ key }) => {
      this.load.atlas(
        `${TEXTURE_KEYS.MONKEY}-${key}`,
        `assets/monkeyMan/${key}/texture.png`,
        `assets/monkeyMan/${key}/texture.json`,
      );
    });

    this.load.image(TEXTURE_KEYS.JOYPAD, 'assets/joypad.png');
    this.load.image(TEXTURE_KEYS.NEXT, 'assets/next.png');
  }

  #buildLoaderUi() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy - 220, 'MONKEY MAYHEM', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '96px',
        fontStyle: 'bold',
        color: CSS_COLORS.gold,
        stroke: '#0b0f1a',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 140, 'Fighting Demo', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '40px',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    const barWidth = 720;
    const barHeight = 34;
    this.barWidth = barWidth;

    this.add
      .graphics()
      .fillStyle(0x000000, 0.45)
      .fillRoundedRect(
        cx - barWidth / 2 - 8,
        cy - barHeight / 2 - 8,
        barWidth + 16,
        barHeight + 16,
        22,
      )
      .fillStyle(COLORS.panel, 1)
      .fillRoundedRect(cx - barWidth / 2, cy - barHeight / 2, barWidth, barHeight, 18);

    this.barFill = this.add
      .image(cx - barWidth / 2 + 6, cy, FX_TEXTURES.pixel)
      .setOrigin(0, 0.5)
      .setDisplaySize(1, barHeight - 12)
      .setTint(COLORS.gold);

    this.percentText = this.add
      .text(cx, cy + 58, '0%', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '34px',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(cx, cy + 120, 'Loading sprites…', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '28px',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5);

    this.tipText = this.add
      .text(cx, cy + 240, 'Tip: ' + TIPS[0], {
        fontFamily: FONTS.PRIMARY,
        fontSize: '30px',
        color: CSS_COLORS.gold,
        align: 'center',
        wordWrap: { width: 1100 },
      })
      .setOrigin(0.5)
      .setAlpha(0.75);

    this.tweens.add({
      targets: this.tipText,
      alpha: { from: 0.35, to: 0.95 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  #onProgress(value) {
    if (!this.barFill) return;
    const width = Math.max(1, (this.barWidth - 12) * value);
    this.barFill.setDisplaySize(width, 22);
    this.percentText?.setText(`${Math.round(value * 100)}%`);
  }

  #onFileComplete(key) {
    if (!this.statusText) return;
    const label = String(key).replace('monkey-', 'anim: ');
    this.statusText.setText(`Loaded ${label}`);
  }

  #onComplete() {
    if (this.failed) return;
    this.statusText?.setText('Ready!');
    this.percentText?.setText('100%');
  }

  #onError(file) {
    this.failed = true;
    console.error('[preload] failed to load', file?.key, file?.src);
    this.statusText
      ?.setText('Failed to load game assets. Check that /assets is served.')
      .setColor(CSS_COLORS.red);
  }

  create() {
    createAnimations(this);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Show off the character for a beat before the menu appears.
    const monkey = this.add
      .sprite(cx, cy + 40, `${TEXTURE_KEYS.MONKEY}-${ANIMS.IDLE}`)
      .setOrigin(0.5, 1)
      .setScale(1.1);
    monkey.play({ key: ANIMS.IDLE, repeat: -1 });
    popIn(monkey, { from: 0.7, to: 1.1, duration: 420 });

    this.barFill?.destroy();
    this.percentText?.destroy();
    this.statusText?.destroy();
    this.tipText?.destroy();

    audio.play('whoosh', { volume: 0.6 });
    fadeIn(monkey, { duration: 200 });

    this.time.delayedCall(520, () => {
      this.cameras.main.fadeOut(220, 13, 18, 32);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENES.MENU);
      });
    });
  }
}
