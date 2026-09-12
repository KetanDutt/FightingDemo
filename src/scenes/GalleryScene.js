import Phaser from 'phaser';
import {
  ANIMS,
  DEPTH,
  FONTS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  SCENES,
  SPRITE_ORIGIN,
  TEXTURE_KEYS,
} from '../config/constants.js';
import { COLORS, CSS_COLORS } from '../config/palette.js';
import { ANIMATION_DATA } from '../data/animations.js';
import { Arena } from '../systems/Arena.js';
import { Button } from '../ui/Button.js';
import { FX_TEXTURES } from '../utils/textures.js';
import { sortedFrameNames } from '../utils/frames.js';
import { fadeIn, popIn, pulse, slideIn } from '../utils/fx.js';
import { audio } from '../audio/index.js';
import { settings } from '../core/Settings.js';

const SPEEDS = [0.25, 0.5, 1, 2];

/**
 * Move gallery — the spiritual successor of the original prototype's menu
 * screen: browse every animation in the library with playback controls and
 * frame data.
 */
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.GALLERY });
  }

  create() {
    this.index = 0;
    this.loop = true;
    this.speedIndex = 2;
    this.autoAdvance = false;

    this.arena = new Arena(this, { reducedMotion: settings.get('reducedMotion') });
    this.cameras.main.fadeIn(260, 13, 18, 32);

    this.#buildStage();
    this.#buildCharacter();
    this.#buildInfo();
    this.#buildList();
    this.#buildControls();

    this.#showAnimation(0);

    this.input.keyboard?.on('keydown-LEFT', () => this.#step(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.#step(1));
    this.input.keyboard?.on('keydown-SPACE', () => this.#togglePlay());
    this.input.keyboard?.on('keydown-ESC', () => this.#goBack());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.arena?.destroy();
    });
  }

  #buildStage() {
    const spotlight = this.add
      .image(GAME_WIDTH / 2, GROUND_Y - 40, FX_TEXTURES.flash)
      .setTint(COLORS.sunGlow)
      .setAlpha(0.22)
      .setScale(5.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.BG_NEAR + 2);

    this.tweens.add({
      targets: spotlight,
      alpha: { from: 0.16, to: 0.3 },
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(GAME_WIDTH / 2, 108, 'MOVE GALLERY', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '76px',
        fontStyle: 'bold',
        color: CSS_COLORS.gold,
        stroke: '#1a0f00',
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildCharacter() {
    const x = GAME_WIDTH * 0.5 + 130;
    this.shadow = this.add
      .image(x, GROUND_Y - 4, FX_TEXTURES.shadow)
      .setAlpha(0.45)
      .setDisplaySize(460, 112)
      .setDepth(DEPTH.SHADOW);

    this.sprite = this.add
      .sprite(x, GROUND_Y, `${TEXTURE_KEYS.MONKEY}-${ANIMS.IDLE}`)
      .setOrigin(SPRITE_ORIGIN.x, SPRITE_ORIGIN.y)
      .setScale(1.3)
      .setDepth(DEPTH.FIGHTER);

    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.autoAdvance && this.sprite.anims.currentAnim) {
        this.time.delayedCall(320, () => this.#step(1));
      }
    });
  }

  #buildInfo() {
    const x = GAME_WIDTH * 0.5 + 130;
    this.nameText = this.add
      .text(x, GROUND_Y + 92, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '58px',
        fontStyle: 'bold',
        color: CSS_COLORS.white,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    this.descText = this.add
      .text(x, GROUND_Y + 150, '', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '30px',
        color: CSS_COLORS.offWhite,
        align: 'center',
        wordWrap: { width: 900 },
      })
      .setOrigin(0.5)
      .setAlpha(0.8)
      .setDepth(DEPTH.UI);

    this.dataText = this.add
      .text(x, GROUND_Y + 214, '', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '28px',
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildList() {
    const x = 300;
    let y = 230;
    this.listEntries = ANIMATION_DATA.map((entry, index) => {
      const text = this.add
        .text(x, y, entry.label, {
          fontFamily: FONTS.PRIMARY,
          fontSize: '34px',
          color: CSS_COLORS.offWhite,
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.UI)
        .setInteractive({ useHandCursor: true });

      text.on('pointerup', () => this.#showAnimation(index));
      text.on('pointerover', () => {
        if (index !== this.index) text.setColor(CSS_COLORS.gold);
        audio.play('uiHover', { throttleMs: 60 });
      });
      text.on('pointerout', () => {
        if (index !== this.index) text.setColor(CSS_COLORS.offWhite);
      });

      y += 62;
      return text;
    });

    this.add
      .text(x, 176, 'ANIMATIONS', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '30px',
        color: CSS_COLORS.gold,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.UI);

    slideIn(this.listEntries[0], { from: 20, duration: 200 });
  }

  #buildControls() {
    const y = GAME_HEIGHT - 110;

    this.prevButton = new Button(this, {
      x: GAME_WIDTH / 2 - 420,
      y,
      width: 220,
      height: 86,
      label: 'PREV',
      fontSize: 32,
      variant: 'ghost',
      onClick: () => this.#step(-1),
    }).setDepth(DEPTH.UI);

    // The original prototype's "next" button art, reused as the primary control.
    const nextImage = this.add
      .image(GAME_WIDTH / 2 - 60, y, TEXTURE_KEYS.NEXT)
      .setDisplaySize(300, 90)
      .setDepth(DEPTH.UI)
      .setInteractive({ useHandCursor: true });
    nextImage.on('pointerup', () => this.#step(1));
    nextImage.on('pointerover', () => {
      this.tweens.add({ targets: nextImage, scaleX: 1.06, scaleY: 1.06, duration: 120 });
      audio.play('uiHover', { throttleMs: 60 });
    });
    nextImage.on('pointerout', () => {
      this.tweens.add({ targets: nextImage, scaleX: 1, scaleY: 1, duration: 120 });
    });

    this.playButton = new Button(this, {
      x: GAME_WIDTH / 2 + 190,
      y,
      width: 200,
      height: 86,
      label: 'PAUSE',
      fontSize: 32,
      variant: 'ghost',
      onClick: () => this.#togglePlay(),
    }).setDepth(DEPTH.UI);

    this.loopButton = new Button(this, {
      x: GAME_WIDTH / 2 + 410,
      y,
      width: 200,
      height: 86,
      label: 'LOOP: ON',
      fontSize: 28,
      variant: 'ghost',
      onClick: () => this.#toggleLoop(),
    }).setDepth(DEPTH.UI);

    this.speedButton = new Button(this, {
      x: GAME_WIDTH / 2 + 640,
      y,
      width: 220,
      height: 86,
      label: 'SPEED 1x',
      fontSize: 30,
      variant: 'ghost',
      onClick: () => this.#cycleSpeed(),
    }).setDepth(DEPTH.UI);

    new Button(this, {
      x: 220,
      y: GAME_HEIGHT - 110,
      width: 220,
      height: 86,
      label: 'BACK',
      fontSize: 32,
      variant: 'ghost',
      onClick: () => this.#goBack(),
    })
      .setDepth(DEPTH.UI)
      .appear(200);
  }

  /* --------------------------------- logic --------------------------------- */

  #showAnimation(index) {
    const total = ANIMATION_DATA.length;
    this.index = ((index % total) + total) % total;
    const definition = ANIMATION_DATA[this.index];
    const textureKey = `${TEXTURE_KEYS.MONKEY}-${definition.key}`;

    const frameCount = sortedFrameNames(this, textureKey).length;
    const duration = frameCount > 0 ? (frameCount / definition.frameRate) * 1000 : 0;

    this.sprite.setTexture(textureKey);
    this.sprite.setOrigin(SPRITE_ORIGIN.x, SPRITE_ORIGIN.y);
    this.sprite.play({ key: definition.key, repeat: definition.loop || this.loop ? -1 : 0 }, false);
    this.sprite.anims.timeScale = SPEEDS[this.speedIndex];

    this.nameText.setText(definition.label);
    this.descText.setText(definition.description);
    this.dataText.setText(
      `${frameCount} frames · ${definition.frameRate} fps · ${(duration / 1000).toFixed(2)}s · ${
        definition.loop ? 'loops' : 'plays once'
      }`,
    );

    popIn(this.nameText, { from: 0.9, to: 1, duration: 220 });
    pulse(this.sprite, { amount: 1.06, duration: 160, baseScale: 1.3 });

    this.listEntries.forEach((entry, i) => {
      entry.setColor(i === this.index ? CSS_COLORS.gold : CSS_COLORS.offWhite);
      entry.setAlpha(i === this.index ? 1 : 0.65);
    });

    audio.play('uiClick', { volume: 0.6 });
    fadeIn(this.descText, { duration: 240, from: 0.2 });
  }

  #step(delta) {
    this.#showAnimation(this.index + delta);
  }

  #togglePlay() {
    if (!this.sprite.anims.currentAnim) return;
    if (this.sprite.anims.isPaused) {
      this.sprite.anims.resume();
      this.playButton.setLabel('PAUSE');
    } else {
      this.sprite.anims.pause();
      this.playButton.setLabel('PLAY');
    }
    audio.play('uiClick', { volume: 0.7 });
  }

  #toggleLoop() {
    this.loop = !this.loop;
    this.loopButton.setLabel(`LOOP: ${this.loop ? 'ON' : 'OFF'}`);
    this.#showAnimation(this.index);
  }

  #cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    const speed = SPEEDS[this.speedIndex];
    this.sprite.anims.timeScale = speed;
    this.speedButton.setLabel(`SPEED ${speed}x`);
    audio.play('uiClick', { volume: 0.7 });
  }

  #goBack() {
    audio.play('uiBack');
    this.cameras.main.fadeOut(220, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.MENU);
    });
  }
}
