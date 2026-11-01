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
import { titleText } from '../ui/text.js';
import { fadeIn, popIn } from '../utils/fx.js';
import { audio } from '../audio/index.js';
import { settings } from '../core/Settings.js';

const TIPS = [
  'Hold BLOCK to shrug off light attacks — but heavy hits still chip away.',
  'Jump over a punch: airborne frames dodge anything that is not a stomp.',
  'Chain attacks quickly to build a combo — damage scales down, style scales up.',
  'A blocked heavy attack still pushes you back. Use it to make space.',
  'The training mode never ends: perfect for learning your reach.',
  'Hold AWAY from your opponent to auto-block — the Street Fighter way.',
  'The Stomp knocks down on hit, but its long recovery makes it very punishable.',
  'Check the Move Gallery (G key) to see every animation and its frame data.',
  'Keyboard not your thing? Connect a gamepad — full support out of the box.',
  'Best of 3 by default. Change round count in Settings for longer sessions.',
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
    // Note: assets/next.png is no longer loaded — the gallery's Next control
    // is a flat Button with a vector icon now.
  }

  #buildLoaderUi() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    titleText(this, cx, cy - 224, 'Monkey Mayhem', { size: 96 });

    this.add
      .text(cx, cy - 138, 'FIGHTING DEMO', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '28px',
        fontStyle: '600',
        letterSpacing: 9,
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5);

    const barWidth = 680;
    const barHeight = 26;
    this.barWidth = barWidth;

    const track = this.add.graphics();
    track.fillStyle(COLORS.ink, 0.9);
    track.fillRoundedRect(cx - barWidth / 2, cy - barHeight / 2, barWidth, barHeight, 13);
    track.lineStyle(2, COLORS.border, 1);
    track.strokeRoundedRect(cx - barWidth / 2, cy - barHeight / 2, barWidth, barHeight, 13);

    this.barFill = this.add
      .image(cx - barWidth / 2 + 5, cy, FX_TEXTURES.pixel)
      .setOrigin(0, 0.5)
      .setDisplaySize(1, barHeight - 10)
      .setTint(COLORS.gold);

    this.percentText = this.add
      .text(cx, cy + 52, '0%', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '36px',
        fontStyle: '800',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(cx, cy + 108, 'Loading sprites…', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '26px',
        fontStyle: '400',
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5);

    this.tipText = this.add
      .text(cx, cy + 224, 'Tip: ' + TIPS[0], {
        fontFamily: FONTS.PRIMARY,
        fontSize: '27px',
        fontStyle: '400',
        color: CSS_COLORS.muted,
        align: 'center',
        wordWrap: { width: 1100 },
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    // Respect reduced motion: static tip instead of a pulsing one.
    if (!settings.get('reducedMotion')) {
      this.tweens.add({
        targets: this.tipText,
        alpha: { from: 0.45, to: 0.85 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Cycle through tips
    this.tipIndex = 0;
    this.time.addEvent({
      delay: 3600,
      loop: true,
      callback: () => {
        this.tipIndex = (this.tipIndex + 1) % TIPS.length;
        if (this.tipText?.scene) {
          this.tipText.setText('Tip: ' + TIPS[this.tipIndex]);
        }
      },
    });
  }

  #onProgress(value) {
    if (!this.barFill) return;
    const width = Math.max(1, (this.barWidth - 10) * value);
    this.barFill.setDisplaySize(width, 16);
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
    if (this.failed) return;
    createAnimations(this);

    // Show off the character for a beat before the menu appears — parked in
    // the bottom-left corner (same spot as the menu mascot) so it never
    // covers the centred title or the progress bar.
    const monkey = this.add
      .sprite(300, GAME_HEIGHT - 30, `${TEXTURE_KEYS.MONKEY}-${ANIMS.IDLE}`)
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
      this.cameras.main.fadeOut(220, 11, 15, 26);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENES.MENU);
      });
    });
  }
}
