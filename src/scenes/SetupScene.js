import Phaser from 'phaser';
import {
  ANIMS,
  DEPTH,
  DIFFICULTY,
  FONTS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  MODE,
  SCENES,
  SPRITE_ORIGIN,
  TEXTURE_KEYS,
} from '../config/constants.js';
import { AI_PROFILES } from '../config/balance.js';
import { COLORS, CSS_COLORS, SKINS, getSkin } from '../config/palette.js';
import { Arena } from '../systems/Arena.js';
import { Button } from '../ui/Button.js';
import { MenuNav } from '../ui/MenuNav.js';
import { FX_TEXTURES } from '../utils/textures.js';
import { fadeIn, popIn, pulse, slideIn } from '../utils/fx.js';
import { audio } from '../audio/index.js';
import { settings } from '../core/Settings.js';

/**
 * Pre-match setup: fighter skin, opponent difficulty and mode summary.
 */
export class SetupScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.SETUP });
  }

  init(data = {}) {
    this.mode = data.mode ?? MODE.ARCADE;
    this.difficulty = settings.get('difficulty');
    this.playerSkinId = settings.get('lastSkin');
    this.enemySkinId = this.#contrastingSkin(this.playerSkinId);
  }

  #contrastingSkin(skinId) {
    const index = SKINS.findIndex((skin) => skin.id === skinId);
    return SKINS[(index + 3) % SKINS.length].id;
  }

  create() {
    this.arena = new Arena(this, { reducedMotion: settings.get('reducedMotion') });
    this.cameras.main.fadeIn(280, 13, 18, 32);

    this.#buildHeader();
    this.#buildPreviews();
    this.#buildSkinPicker();
    this.#buildDifficultyPicker();
    this.#buildFooter();

    this.input.keyboard?.on('keydown-ENTER', () => this.#startFight());
    this.input.keyboard?.on('keydown-ESC', () => this.#goBack());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.arena?.destroy();
    });
  }

  #buildHeader() {
    const title = this.add
      .text(
        GAME_WIDTH / 2,
        130,
        this.mode === MODE.TRAINING ? 'TRAINING SETUP' : 'CHOOSE YOUR FIGHTER',
        {
          fontFamily: FONTS.DISPLAY,
          fontSize: '82px',
          fontStyle: 'bold',
          color: CSS_COLORS.gold,
          stroke: '#1a0f00',
          strokeThickness: 12,
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
    popIn(title, { from: 0.8, to: 1, duration: 360 });

    this.modeText = this.add
      .text(
        GAME_WIDTH / 2,
        212,
        this.mode === MODE.TRAINING
          ? 'No timer, no knockouts — practise freely.'
          : 'Best of 3 rounds · 60 seconds per round',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '34px',
          color: CSS_COLORS.offWhite,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.8)
      .setDepth(DEPTH.UI);
  }

  #buildPreviews() {
    this.playerPreview = this.#createPreview(GAME_WIDTH * 0.29, 1);
    this.enemyPreview = this.#createPreview(GAME_WIDTH * 0.71, -1);
    this.#refreshPreviews();

    this.add
      .text(GAME_WIDTH * 0.29, GROUND_Y + 92, 'YOU', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '40px',
        fontStyle: 'bold',
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    this.enemyLabel = this.add
      .text(GAME_WIDTH * 0.71, GROUND_Y + 92, 'OPPONENT', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '40px',
        fontStyle: 'bold',
        color: CSS_COLORS.red,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #createPreview(x, facing) {
    const container = this.add.container(x, GROUND_Y).setDepth(DEPTH.FIGHTER);
    const shadow = this.add
      .image(0, -4, FX_TEXTURES.shadow)
      .setAlpha(0.42)
      .setDisplaySize(430, 105)
      .setDepth(DEPTH.SHADOW);
    const sprite = this.add
      .sprite(0, 0, `${TEXTURE_KEYS.MONKEY}-${ANIMS.IDLE}`)
      .setOrigin(SPRITE_ORIGIN.x, SPRITE_ORIGIN.y)
      .setScale(1.15 * facing, 1.15);
    sprite.play({ key: ANIMS.IDLE, repeat: -1 });
    container.add([shadow, sprite]);
    return { container, sprite, shadow };
  }

  #refreshPreviews() {
    const playerSkin = getSkin(this.playerSkinId);
    const enemySkin = getSkin(this.enemySkinId);

    this.playerPreview.sprite.setTint(playerSkin.tint);
    this.enemyPreview.sprite.setTint(enemySkin.tint);
    this.playerName?.destroy();
    this.playerName = this.add
      .text(GAME_WIDTH * 0.29, GROUND_Y + 148, playerSkin.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: '32px',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    if (this.enemySkinName) this.enemySkinName.destroy();
    this.enemySkinName = this.add
      .text(GAME_WIDTH * 0.71, GROUND_Y + 148, enemySkin.name, {
        fontFamily: FONTS.PRIMARY,
        fontSize: '32px',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildSkinPicker() {
    const label = this.add
      .text(GAME_WIDTH / 2, 430, 'FIGHTER SKIN', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '36px',
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
    fadeIn(label, { duration: 300, delay: 120 });

    this.skinButtons = SKINS.map((skin, index) => {
      const x = GAME_WIDTH / 2 + (index - (SKINS.length - 1) / 2) * 150;
      const y = 510;
      const container = this.add.container(x, y).setDepth(DEPTH.UI);

      const swatch = this.add.graphics();
      const border = this.add.graphics();
      container.add([swatch, border]);

      const zone = this.add
        .zone(0, 0, 120, 120)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      container.add(zone);

      zone.on('pointerup', () => this.#selectSkin(skin.id));
      zone.on('pointerover', () => {
        this.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 120 });
        audio.play('uiHover', { throttleMs: 60 });
      });
      zone.on('pointerout', () => {
        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 });
      });

      return { skin, swatch, border, container, zone };
    });

    this.#paintSkinButtons();
  }

  #paintSkinButtons() {
    this.skinButtons.forEach(({ skin, swatch, border }) => {
      const selected = skin.id === this.playerSkinId;
      swatch.clear();
      swatch.fillStyle(0x000000, 0.35);
      swatch.fillRoundedRect(-52, -46, 104, 104, 24);
      swatch.fillStyle(Phaser.Display.Color.HexStringToColor(skin.swatch).color, 1);
      swatch.fillRoundedRect(-56, -56, 104, 104, 24);
      swatch.fillStyle(0xffffff, 0.18);
      swatch.fillRoundedRect(-48, -50, 88, 40, 18);

      border.clear();
      border.lineStyle(selected ? 6 : 3, selected ? COLORS.gold : 0x8b93b0, selected ? 1 : 0.5);
      border.strokeRoundedRect(-56, -56, 104, 104, 24);
    });
  }

  #selectSkin(skinId) {
    if (this.playerSkinId === skinId) return;
    this.playerSkinId = skinId;
    this.enemySkinId = this.#contrastingSkin(skinId);
    settings.set('lastSkin', skinId);
    audio.play('uiClick', { volume: 0.8 });
    this.#paintSkinButtons();
    this.#refreshPreviews();

    this.playerPreview.sprite.play({ key: ANIMS.PUNCH, repeat: 0 });
    this.playerPreview.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.playerPreview?.sprite?.play({ key: ANIMS.IDLE, repeat: -1 });
    });
    audio.play('swingLight', { volume: 0.5 });
    pulse(this.playerPreview.container, { amount: 1.08, duration: 140, baseScale: 1 });
  }

  #buildDifficultyPicker() {
    if (this.mode === MODE.TRAINING) {
      this.difficulty = DIFFICULTY.NORMAL;
      return;
    }

    const label = this.add
      .text(GAME_WIDTH / 2, 640, 'OPPONENT SKILL', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '36px',
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
    fadeIn(label, { duration: 300, delay: 200 });

    this.difficultyButtons = [DIFFICULTY.EASY, DIFFICULTY.NORMAL, DIFFICULTY.HARD].map(
      (key, index) => {
        const profile = AI_PROFILES[key];
        const button = new Button(this, {
          x: GAME_WIDTH / 2 + (index - 1) * 340,
          y: 730,
          width: 310,
          height: 104,
          label: profile.label.toUpperCase(),
          fontSize: 34,
          variant: 'ghost',
          onClick: () => this.#selectDifficulty(key),
        }).setDepth(DEPTH.UI);
        button.appear(260 + index * 70);
        return { key, button };
      },
    );

    this.difficultyHint = this.add
      .text(GAME_WIDTH / 2, 810, '', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '28px',
        color: CSS_COLORS.offWhite,
      })
      .setOrigin(0.5)
      .setAlpha(0.75)
      .setDepth(DEPTH.UI);

    this.#paintDifficulty();
    if (this.difficultyHint) slideIn(this.difficultyHint, { from: 24, duration: 300, delay: 380 });
  }

  #paintDifficulty() {
    this.difficultyButtons?.forEach(({ key, button }) => {
      button.setAlpha(key === this.difficulty ? 1 : 0.45);
    });
    const profile = AI_PROFILES[this.difficulty];
    if (this.difficultyHint) {
      this.difficultyHint.setText(
        `Reaction ${profile.reaction}ms · Guard ${Math.round(profile.blockChance * 100)}% · Aggression ${Math.round(
          profile.aggression * 100,
        )}%`,
      );
    }
  }

  #selectDifficulty(key) {
    this.difficulty = key;
    settings.set('difficulty', key);
    audio.play('uiClick', { volume: 0.8 });
    this.#paintDifficulty();
  }

  #buildFooter() {
    const back = new Button(this, {
      x: GAME_WIDTH / 2 - 200,
      y: GAME_HEIGHT - 110,
      width: 300,
      height: 92,
      label: 'BACK',
      fontSize: 34,
      variant: 'ghost',
      onClick: () => this.#goBack(),
    })
      .setDepth(DEPTH.UI)
      .appear(420);

    const fight = new Button(this, {
      x: GAME_WIDTH / 2 + 200,
      y: GAME_HEIGHT - 110,
      width: 380,
      height: 92,
      label: 'FIGHT!',
      icon: '🔥',
      fontSize: 40,
      variant: 'danger',
      onClick: () => this.#startFight(),
    })
      .setDepth(DEPTH.UI)
      .appear(480);

    // One navigation list: the three difficulty buttons, then the footer.
    this.nav = new MenuNav(this, {
      items: [...(this.difficultyButtons ?? []).map((entry) => entry.button), back, fight],
      startIndex: this.difficultyButtons?.findIndex((entry) => entry.key === this.difficulty) ?? 0,
    });
  }

  #goBack() {
    audio.play('uiBack');
    this.cameras.main.fadeOut(220, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.MENU);
    });
  }

  #startFight() {
    if (this.transitioning) return;
    this.transitioning = true;
    audio.play('uiConfirm');
    this.cameras.main.fadeOut(280, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.FIGHT, {
        mode: this.mode,
        difficulty: this.difficulty,
        playerSkin: this.playerSkinId,
        enemySkin: this.enemySkinId,
      });
    });
  }
}
