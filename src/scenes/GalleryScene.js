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
import { sectionLabel, titleText } from '../ui/text.js';
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

    this.arena = new Arena(this, { reducedMotion: settings.get('reducedMotion') });
    this.cameras.main.fadeIn(260, 11, 15, 26);

    this.#buildStage();
    this.#buildCharacter();
    this.#buildInfo();
    this.#buildList();
    this.#buildControls();

    this.#showAnimation(0);

    this.input.keyboard?.on('keydown-LEFT', () => this.#step(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.#step(1));
    this.input.keyboard?.on('keydown-UP', () => this.#step(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.#step(1));
    this.input.keyboard?.on('keydown-SPACE', () => this.#togglePlay());
    this.input.keyboard?.on('keydown-L', () => this.#toggleLoop());
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

    if (!settings.get('reducedMotion')) {
      this.tweens.add({
        targets: spotlight,
        alpha: { from: 0.16, to: 0.3 },
        duration: 3200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    titleText(this, GAME_WIDTH / 2, 108, 'Move gallery', { size: 76 }).setDepth(DEPTH.UI);
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
  }

  #buildInfo() {
    // Top-right column. The old spot (below the fighter, GROUND_Y+150/214)
    // sat past the bottom canvas edge and under the control row, so the
    // description and frame data were clipped off-screen.
    const x = GAME_WIDTH - 290;
    this.nameText = this.add
      .text(x, 180, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '56px',
        fontStyle: '800',
        letterSpacing: 2,
        color: CSS_COLORS.white,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    this.descText = this.add
      .text(x, 296, '', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '27px',
        fontStyle: '400',
        color: CSS_COLORS.muted,
        align: 'center',
        wordWrap: { width: 470 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    this.dataText = this.add
      .text(x, 388, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '30px',
        fontStyle: '700',
        letterSpacing: 1,
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildList() {
    const x = 300;
    let y = 236;
    this.listMarkers = [];
    this.listEntries = ANIMATION_DATA.map((entry, index) => {
      // Amber slash marker shown on the selected row (signature tick).
      const marker = this.add.graphics().setDepth(DEPTH.UI);
      marker.fillStyle(COLORS.gold, 1);
      marker.beginPath();
      marker.moveTo(x - 30, y - 11);
      marker.lineTo(x - 22, y - 11);
      marker.lineTo(x - 27, y + 11);
      marker.lineTo(x - 35, y + 11);
      marker.closePath();
      marker.fillPath();
      marker.setVisible(false);
      this.listMarkers.push(marker);

      const text = this.add
        .text(x, y, entry.label, {
          fontFamily: FONTS.PRIMARY,
          fontSize: '32px',
          fontStyle: '500',
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

      y += 60;
      return text;
    });

    sectionLabel(this, x - 35, 182, 'Animations', { align: 'left' }).setDepth(DEPTH.UI);

    this.listEntries.forEach((entry, index) => {
      slideIn(entry, { from: 20, axis: 'x', duration: 200, delay: index * 35 });
    });
  }

  #buildControls() {
    const y = GAME_HEIGHT - 110;

    this.prevButton = new Button(this, {
      x: GAME_WIDTH / 2 - 420,
      y,
      width: 220,
      height: 86,
      label: 'Prev',
      icon: 'back',
      fontSize: 32,
      variant: 'ghost',
      onClick: () => this.#step(-1),
    }).setDepth(DEPTH.UI);

    // Primary control: the same flat Button component as every other menu,
    // with a vector "next" icon (the old next.png bitmap art is retired).
    this.nextButton = new Button(this, {
      x: GAME_WIDTH / 2 - 60,
      y,
      width: 300,
      height: 90,
      label: 'Next',
      icon: 'next',
      fontSize: 34,
      variant: 'primary',
      onClick: () => this.#step(1),
    }).setDepth(DEPTH.UI);

    this.playButton = new Button(this, {
      x: GAME_WIDTH / 2 + 190,
      y,
      width: 200,
      height: 86,
      label: 'Pause',
      icon: 'pause',
      fontSize: 32,
      variant: 'ghost',
      onClick: () => this.#togglePlay(),
    }).setDepth(DEPTH.UI);

    this.loopButton = new Button(this, {
      x: GAME_WIDTH / 2 + 410,
      y,
      width: 200,
      height: 86,
      label: 'Loop: on',
      fontSize: 28,
      variant: 'ghost',
      onClick: () => this.#toggleLoop(),
    }).setDepth(DEPTH.UI);

    this.speedButton = new Button(this, {
      x: GAME_WIDTH / 2 + 640,
      y,
      width: 220,
      height: 86,
      label: 'Speed 1x',
      fontSize: 30,
      variant: 'ghost',
      onClick: () => this.#cycleSpeed(),
    }).setDepth(DEPTH.UI);

    new Button(this, {
      x: 220,
      y: GAME_HEIGHT - 110,
      width: 220,
      height: 86,
      label: 'Back',
      icon: 'back',
      fontSize: 32,
      variant: 'ghost',
      onClick: () => this.#goBack(),
    })
      .setDepth(DEPTH.UI)
      .appear(200);

    this.add
      .text(
        GAME_WIDTH / 2 + 130,
        GAME_HEIGHT - 26,
        '↑ ↓ / ← → browse · SPACE play / pause · L loop · ESC back',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '24px',
          fontStyle: '400',
          color: CSS_COLORS.muted,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setDepth(DEPTH.UI);
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

    this.nameText.setText(definition.label.toUpperCase());
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
    this.listMarkers?.forEach((marker, i) => marker.setVisible(i === this.index));

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
      this.playButton.setLabel('Pause').setIcon('pause');
    } else {
      this.sprite.anims.pause();
      this.playButton.setLabel('Play').setIcon('play');
    }
    audio.play('uiClick', { volume: 0.7 });
  }

  #toggleLoop() {
    this.loop = !this.loop;
    this.loopButton.setLabel(`Loop: ${this.loop ? 'on' : 'off'}`);
    this.#showAnimation(this.index);
  }

  #cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    const speed = SPEEDS[this.speedIndex];
    this.sprite.anims.timeScale = speed;
    this.speedButton.setLabel(`Speed ${speed}x`);
    audio.play('uiClick', { volume: 0.7 });
  }

  #goBack() {
    audio.play('uiBack');
    audio.play('transition', { volume: 0.3 });
    this.cameras.main.fadeOut(220, 11, 15, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.MENU);
    });
  }
}
