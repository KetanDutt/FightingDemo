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
import { COLORS, CSS_COLORS, getSkin } from '../config/palette.js';
import { Arena } from '../systems/Arena.js';
import { Vfx } from '../systems/Vfx.js';
import { Button } from '../ui/Button.js';
import { MenuNav } from '../ui/MenuNav.js';
import { FX_TEXTURES } from '../utils/textures.js';
import { bob, fadeIn, popIn, slideIn } from '../utils/fx.js';
import { formatAccuracy } from '../utils/math.js';
import { audio } from '../audio/index.js';
import { settings } from '../core/Settings.js';
import { stats } from '../core/Stats.js';

/**
 * End of match screen: winner call-out, match statistics and the usual
 * rematch / menu options.
 */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.RESULTS });
  }

  init(data = {}) {
    this.winner = data.winner ?? 'player';
    this.score = data.score ?? 0;
    this.rounds = data.rounds ?? { player: 0, enemy: 0 };
    this.matchStats = data.matchStats ?? {
      damageDealt: 0,
      damageTaken: 0,
      maxCombo: 0,
      knockouts: 0,
    };
    this.config = data.config ?? {
      mode: MODE.ARCADE,
      difficulty: 'normal',
      playerSkin: 'classic',
      enemySkin: 'ember',
    };
  }

  create() {
    this.arena = new Arena(this, { reducedMotion: settings.get('reducedMotion') });
    this.vfx = new Vfx(this, {
      quality: settings.get('particleQuality'),
      reducedMotion: settings.get('reducedMotion'),
    });

    this.cameras.main.fadeIn(320, 13, 18, 32);

    this.#buildWinner();
    this.#buildStats();
    this.#buildButtons();

    audio.playMusic('menu');
    audio.play(this.winner === 'player' ? 'matchWin' : 'matchLose', { volume: 0.9 });

    if (this.winner === 'player') {
      this.time.addEvent({
        delay: 420,
        loop: true,
        callback: () => {
          if (!this.scene) return;
          this.vfx.celebrate(Phaser.Math.Between(300, GAME_WIDTH - 300), 200, 14);
        },
      });
    }

    this.input.keyboard?.on('keydown-ESC', () => this.#toMenu());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.arena?.destroy();
      this.vfx?.destroy();
    });
  }

  #buildWinner() {
    const victory = this.winner === 'player';
    const title = victory ? 'VICTORY!' : this.winner === 'draw' ? 'DRAW' : 'DEFEATED';
    const color = victory
      ? CSS_COLORS.gold
      : this.winner === 'draw'
        ? CSS_COLORS.offWhite
        : CSS_COLORS.red;

    const titleText = this.add
      .text(GAME_WIDTH / 2, 170, title, {
        fontFamily: FONTS.DISPLAY,
        fontSize: '132px',
        fontStyle: 'bold',
        color,
        stroke: '#1a0f00',
        strokeThickness: 16,
        shadow: { offsetX: 0, offsetY: 12, color: '#000000', blur: 24, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
    popIn(titleText, { from: 0.6, to: 1, duration: 520, ease: 'Back.easeOut' });
    bob(titleText, { offset: -12, duration: 2400 });

    // Portrait of the winning fighter.
    const skin = getSkin(victory ? this.config.playerSkin : this.config.enemySkin);
    const portrait = this.add
      .sprite(GAME_WIDTH / 2, GROUND_Y + 40, `${TEXTURE_KEYS.MONKEY}-${ANIMS.IDLE}`)
      .setOrigin(SPRITE_ORIGIN.x, SPRITE_ORIGIN.y)
      .setScale(1.5)
      .setTint(skin.tint)
      .setDepth(DEPTH.FIGHTER)
      .setAlpha(0.92);
    portrait.play({ key: ANIMS.IDLE, repeat: -1 });
    if (victory) {
      this.time.delayedCall(700, () => {
        if (!portrait.scene) return;
        portrait.play({ key: ANIMS.STOMP, repeat: 0 });
        audio.play('swingHeavy', { volume: 0.5 });
        portrait.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          portrait.play({ key: ANIMS.IDLE, repeat: -1 });
        });
      });
    }

    const shadow = this.add
      .image(GAME_WIDTH / 2, GROUND_Y, FX_TEXTURES.shadow)
      .setAlpha(0.4)
      .setDisplaySize(520, 120)
      .setDepth(DEPTH.SHADOW);
    fadeIn(shadow, { duration: 400 });

    this.add
      .text(
        GAME_WIDTH / 2,
        268,
        victory ? `${skin.name} takes the crown` : 'Better luck next round',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '40px',
          color: CSS_COLORS.offWhite,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setDepth(DEPTH.UI);
  }

  #buildStats() {
    const panelWidth = 760;
    const panelHeight = 300;
    const x = GAME_WIDTH / 2;
    const y = 470;

    const panel = this.add.graphics().setDepth(DEPTH.UI);
    panel.fillStyle(0x000000, 0.4);
    panel.fillRoundedRect(
      x - panelWidth / 2 + 6,
      y - panelHeight / 2 + 8,
      panelWidth,
      panelHeight,
      30,
    );
    panel.fillStyle(COLORS.panel, 0.94);
    panel.fillRoundedRect(x - panelWidth / 2, y - panelHeight / 2, panelWidth, panelHeight, 30);
    panel.lineStyle(4, COLORS.gold, 0.6);
    panel.strokeRoundedRect(x - panelWidth / 2, y - panelHeight / 2, panelWidth, panelHeight, 30);
    slideIn(panel, { from: 40, duration: 320, delay: 200 });

    const rows = [
      ['Rounds won', `${this.rounds.player} — ${this.rounds.enemy}`],
      ['Damage dealt', `${Math.round(this.matchStats.damageDealt)}`],
      ['Damage taken', `${Math.round(this.matchStats.damageTaken)}`],
      ['Best combo', `${this.matchStats.maxCombo} hits`],
      ['Accuracy', formatAccuracy(this.matchStats.attacksLanded, this.matchStats.attacksThrown)],
      ['Match score', `${Math.round(this.score)}`],
    ];

    rows.forEach(([label, value], index) => {
      const rowY = y - 100 + index * 52;
      const left = this.add
        .text(x - panelWidth / 2 + 48, rowY, label, {
          fontFamily: FONTS.PRIMARY,
          fontSize: '32px',
          color: CSS_COLORS.offWhite,
        })
        .setOrigin(0, 0.5)
        .setAlpha(0.8)
        .setDepth(DEPTH.UI);

      const right = this.add
        .text(x + panelWidth / 2 - 48, rowY, value, {
          fontFamily: FONTS.DISPLAY,
          fontSize: '34px',
          fontStyle: 'bold',
          color: CSS_COLORS.gold,
        })
        .setOrigin(1, 0.5)
        .setDepth(DEPTH.UI);

      slideIn(left, { from: 20, axis: 'x', duration: 260, delay: 260 + index * 60 });
      slideIn(right, { from: 20, axis: 'x', duration: 260, delay: 280 + index * 60 });
    });

    const record = stats.values;
    this.add
      .text(
        GAME_WIDTH / 2,
        y + 190,
        `Career · ${record.wins}W / ${record.losses}L  ·  Best combo ${record.bestCombo}  ·  Best score ${record.bestScore}`,
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '28px',
          color: CSS_COLORS.muted,
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildButtons() {
    const rematch = new Button(this, {
      x: GAME_WIDTH / 2 - 220,
      y: GAME_HEIGHT - 130,
      width: 360,
      height: 96,
      label: 'REMATCH',
      icon: '🥊',
      fontSize: 38,
      variant: 'primary',
      onClick: () => this.#rematch(),
    })
      .setDepth(DEPTH.UI)
      .appear(420);

    const menu = new Button(this, {
      x: GAME_WIDTH / 2 + 220,
      y: GAME_HEIGHT - 130,
      width: 360,
      height: 96,
      label: 'MAIN MENU',
      icon: '🏠',
      fontSize: 38,
      variant: 'ghost',
      onClick: () => this.#toMenu(),
    })
      .setDepth(DEPTH.UI)
      .appear(480);

    this.nav = new MenuNav(this, { items: [rematch, menu] });
  }

  #rematch() {
    audio.play('uiConfirm');
    this.cameras.main.fadeOut(260, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.FIGHT, this.config);
    });
  }

  #toMenu() {
    audio.play('uiBack');
    this.cameras.main.fadeOut(260, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.MENU);
    });
  }
}
