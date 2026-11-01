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
import { AI_PROFILES, ROUND_RULES } from '../config/balance.js';
import { COLORS, CSS_COLORS, SKINS, getSkin } from '../config/palette.js';
import { Arena } from '../systems/Arena.js';
import { Button } from '../ui/Button.js';
import { MenuNav } from '../ui/MenuNav.js';
import { sectionLabel, titleText } from '../ui/text.js';
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
    // Defaults: Challenger skill, first to 3 rounds (both persisted, so a
    // deliberate player choice sticks across sessions).
    this.difficulty = settings.get('difficulty') ?? DIFFICULTY.NORMAL;
    this.roundCount = settings.get('roundCount') ?? 'bo5';
    this.dummy = 'cpu';
    this.playerSkinId = settings.get('lastSkin');
    this.enemySkinId = this.#contrastingSkin(this.playerSkinId);
  }

  #contrastingSkin(skinId) {
    const index = SKINS.findIndex((skin) => skin.id === skinId);
    return SKINS[(index + 3) % SKINS.length].id;
  }

  create() {
    this.arena = new Arena(this, { reducedMotion: settings.get('reducedMotion') });
    this.cameras.main.fadeIn(280, 11, 15, 26);

    this.#buildHeader();
    this.#buildPreviews();
    this.#buildSkinPicker();
    this.#buildDifficultyPicker();
    this.#buildDummyPicker();
    this.#buildRoundPicker();
    this.#buildFooter();

    this.input.keyboard?.on('keydown-ENTER', () => this.#startFight());
    this.input.keyboard?.on('keydown-ESC', () => this.#goBack());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.arena?.destroy();
    });
  }

  #buildHeader() {
    const title = titleText(
      this,
      GAME_WIDTH / 2,
      124,
      this.mode === MODE.TRAINING ? 'Training setup' : 'Choose your fighter',
      { size: 80 },
    ).setDepth(DEPTH.UI);
    popIn(title, { from: 0.8, to: 1, duration: 360 });

    this.modeText = this.add
      .text(
        GAME_WIDTH / 2,
        204,
        this.mode === MODE.TRAINING
          ? 'No timer, no knockouts — practise freely.'
          : 'First to win the round count below · 60 seconds per round',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '30px',
          fontStyle: '400',
          color: CSS_COLORS.muted,
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildPreviews() {
    this.playerPreview = this.#createPreview(GAME_WIDTH * 0.29, 1);
    this.enemyPreview = this.#createPreview(GAME_WIDTH * 0.7, -1);
    this.#refreshPreviews();

    // Label rows sit between the fighters' feet (GROUND_Y) and the canvas
    // edge — keep both rows high enough that nothing clips at y 1080.
    this.add
      .text(GAME_WIDTH * 0.29, GROUND_Y + 66, 'YOU', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '40px',
        fontStyle: '800',
        letterSpacing: 3,
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    this.enemyLabel = this.add
      .text(GAME_WIDTH * 0.7, GROUND_Y + 66, 'OPPONENT', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '40px',
        fontStyle: '800',
        letterSpacing: 3,
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
      .text(GAME_WIDTH * 0.29, GROUND_Y + 112, playerSkin.name.toUpperCase(), {
        fontFamily: FONTS.DISPLAY,
        fontSize: '32px',
        fontStyle: '700',
        letterSpacing: 2,
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    if (this.enemySkinName) this.enemySkinName.destroy();
    this.enemySkinName = this.add
      .text(GAME_WIDTH * 0.7, GROUND_Y + 112, enemySkin.name.toUpperCase(), {
        fontFamily: FONTS.DISPLAY,
        fontSize: '32px',
        fontStyle: '700',
        letterSpacing: 2,
        color: CSS_COLORS.muted,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildSkinPicker() {
    const label = sectionLabel(this, GAME_WIDTH / 2, 428, 'Fighter skin').setDepth(DEPTH.UI);
    fadeIn(label, { duration: 300, delay: 120 });

    this.skinButtons = SKINS.map((skin, index) => {
      const x = GAME_WIDTH / 2 + (index - (SKINS.length - 1) / 2) * 150;
      const y = 512;
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
        this.tweens.add({ targets: container, scaleX: 1.12, scaleY: 1.12, duration: 120 });
        audio.play('uiHover', { throttleMs: 60 });
      });
      zone.on('pointerout', () => {
        const rest = skin.id === this.playerSkinId ? 1.06 : 1;
        this.tweens.add({ targets: container, scaleX: rest, scaleY: rest, duration: 120 });
      });

      return { skin, swatch, border, container, zone };
    });

    this.#paintSkinButtons();
  }

  #paintSkinButtons() {
    this.skinButtons.forEach(({ skin, swatch, border, container }) => {
      const selected = skin.id === this.playerSkinId;
      swatch.clear();
      swatch.fillStyle(Phaser.Display.Color.HexStringToColor(skin.swatch).color, 1);
      swatch.fillRoundedRect(-52, -52, 104, 104, 16);

      border.clear();
      border.lineStyle(selected ? 4 : 2.5, selected ? COLORS.gold : COLORS.border, 1);
      border.strokeRoundedRect(-56, -56, 112, 112, 18);
      // Keep the hover tween's rest scale honest when selection changes.
      this.tweens.killTweensOf(container);
      container.setScale(selected ? 1.06 : 1);
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

    const label = sectionLabel(this, GAME_WIDTH / 2, 612, 'Opponent skill').setDepth(DEPTH.UI);
    fadeIn(label, { duration: 300, delay: 200 });

    this.difficultyButtons = [DIFFICULTY.EASY, DIFFICULTY.NORMAL, DIFFICULTY.HARD].map(
      (key, index) => {
        const profile = AI_PROFILES[key];
        const button = new Button(this, {
          x: GAME_WIDTH / 2 + (index - 1) * 340,
          y: 716,
          width: 310,
          height: 100,
          label: profile.label,
          fontSize: 34,
          variant: 'ghost',
          onClick: () => this.#selectDifficulty(key),
        }).setDepth(DEPTH.UI);
        button.appear(200 + index * 70);
        return { key, button };
      },
    );

    this.difficultyHint = this.add
      .text(GAME_WIDTH / 2, 798, '', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '26px',
        fontStyle: '500',
        color: CSS_COLORS.offWhite,
        stroke: CSS_COLORS.bg,
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    this.#paintDifficulty();
    if (this.difficultyHint) slideIn(this.difficultyHint, { from: 24, duration: 300, delay: 340 });
  }

  #buildRoundPicker() {
    if (this.mode === MODE.TRAINING) return;

    const label = sectionLabel(this, GAME_WIDTH / 2, 858, 'Rounds').setDepth(DEPTH.UI);
    fadeIn(label, { duration: 300, delay: 260 });

    this.roundButtons = ROUND_RULES.roundOptions.map((option, index) => {
      const button = new Button(this, {
        x: GAME_WIDTH / 2 + (index - 1) * 200,
        y: 920,
        width: 180,
        height: 62,
        label: option.label,
        fontSize: 26,
        variant: 'ghost',
        onClick: () => this.#selectRoundCount(option.id),
      }).setDepth(DEPTH.UI);
      button.appear(320 + index * 60);
      return { id: option.id, button };
    });

    this.#paintRoundPicker();
  }

  #paintRoundPicker() {
    this.roundButtons?.forEach(({ id, button }) => {
      button.setSelected(id === this.roundCount);
    });
  }

  #selectRoundCount(id) {
    this.roundCount = id;
    settings.set('roundCount', id);
    audio.play('uiClick', { volume: 0.8 });
    this.#paintRoundPicker();
  }

  #paintDifficulty() {
    this.difficultyButtons?.forEach(({ key, button }) => {
      button.setSelected(key === this.difficulty);
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

  #buildDummyPicker() {
    if (this.mode !== MODE.TRAINING) return;

    const label = sectionLabel(this, GAME_WIDTH / 2, 612, 'Training dummy').setDepth(DEPTH.UI);
    fadeIn(label, { duration: 300, delay: 200 });

    this.dummyButtons = [
      { id: 'cpu', label: 'Spars back', hint: 'The dummy fights back — practise under pressure.' },
      {
        id: 'still',
        label: 'Stands still',
        hint: 'The dummy plants its feet — drill combos freely.',
      },
    ].map((option, index) => {
      const button = new Button(this, {
        x: GAME_WIDTH / 2 + (index - 0.5) * 340,
        y: 716,
        width: 310,
        height: 100,
        label: option.label,
        fontSize: 30,
        variant: 'ghost',
        onClick: () => this.#selectDummy(option.id),
      }).setDepth(DEPTH.UI);
      button.appear(200 + index * 70);
      return { id: option.id, hint: option.hint, button };
    });

    this.dummyHint = this.add
      .text(GAME_WIDTH / 2, 798, '', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '26px',
        fontStyle: '500',
        color: CSS_COLORS.offWhite,
        stroke: CSS_COLORS.bg,
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);

    this.#paintDummy();
    if (this.dummyHint) slideIn(this.dummyHint, { from: 24, duration: 300, delay: 340 });
  }

  #paintDummy() {
    this.dummyButtons?.forEach(({ id, button }) => {
      button.setSelected(id === this.dummy);
    });
    const current = this.dummyButtons?.find((entry) => entry.id === this.dummy);
    if (this.dummyHint && current) this.dummyHint.setText(current.hint);
  }

  #selectDummy(id) {
    this.dummy = id;
    audio.play('uiClick', { volume: 0.8 });
    this.#paintDummy();
  }

  #buildFooter() {
    // Corner anchors: the centre-bottom lanes stay free for the preview
    // labels (YOU / skin names), which otherwise collide with the buttons.
    const back = new Button(this, {
      x: 260,
      y: GAME_HEIGHT - 70,
      width: 300,
      height: 92,
      label: 'Back',
      icon: 'back',
      fontSize: 34,
      variant: 'ghost',
      onClick: () => this.#goBack(),
    })
      .setDepth(DEPTH.UI)
      .appear(420);

    const fight = new Button(this, {
      x: GAME_WIDTH - 240,
      y: GAME_HEIGHT - 70,
      width: 340,
      height: 92,
      label: 'Fight!',
      icon: 'fight',
      fontSize: 40,
      variant: 'primary',
      onClick: () => this.#startFight(),
    })
      .setDepth(DEPTH.UI)
      .appear(480);

    // One navigation list: difficulty/dummy, round count, then the footer.
    this.nav = new MenuNav(this, {
      items: [
        ...(this.difficultyButtons ?? []).map((entry) => entry.button),
        ...(this.dummyButtons ?? []).map((entry) => entry.button),
        ...(this.roundButtons ?? []).map((entry) => entry.button),
        back,
        fight,
      ],
      startIndex: this.difficultyButtons?.findIndex((entry) => entry.key === this.difficulty) ?? 0,
    });
  }

  #goBack() {
    audio.play('uiBack');
    this.cameras.main.fadeOut(220, 11, 15, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.MENU);
    });
  }

  #startFight() {
    if (this.transitioning) return;
    this.transitioning = true;
    audio.play('uiConfirm');
    audio.play('transition', { volume: 0.45 });
    this.cameras.main.fadeOut(280, 11, 15, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.FIGHT, {
        mode: this.mode,
        difficulty: this.difficulty,
        roundCount: this.roundCount,
        playerSkin: this.playerSkinId,
        enemySkin: this.enemySkinId,
        dummy: this.dummy,
      });
    });
  }
}
