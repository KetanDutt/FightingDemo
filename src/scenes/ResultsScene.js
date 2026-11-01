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
import { sectionLabel, titleText } from '../ui/text.js';
import { FX_TEXTURES } from '../utils/textures.js';
import { bob, fadeIn, popIn, slideIn, tweenNumber } from '../utils/fx.js';
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

    this.cameras.main.fadeIn(320, 11, 15, 26);

    this.#buildWinner();
    this.#buildStats();
    this.#buildButtons();

    audio.playMusic('menu');
    audio.play(
      this.winner === 'player' ? 'matchWin' : this.winner === 'draw' ? 'fanfare' : 'matchLose',
      { volume: 0.9 },
    );

    if (this.winner === 'player' && !settings.get('reducedMotion')) {
      this.time.addEvent({
        delay: 420,
        loop: true,
        callback: () => {
          if (!this.scene?.sys?.isActive()) return;
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

    const heading = titleText(this, GAME_WIDTH / 2, 168, title, { size: 128, color }).setDepth(
      DEPTH.UI,
    );
    popIn(heading, { from: 0.6, to: 1, duration: 520, ease: 'Back.easeOut' });
    if (!settings.get('reducedMotion')) bob(heading, { offset: -12, duration: 2400 });

    // Portrait of the winning fighter, off to the side where the stats panel
    // doesn't bury it. Draws show your own fighter. x=330 keeps the whole
    // (wide, trimmed) art board inside the left canvas edge.
    const skin = getSkin(this.winner === 'enemy' ? this.config.enemySkin : this.config.playerSkin);
    const portrait = this.add
      .sprite(330, GROUND_Y + 40, `${TEXTURE_KEYS.MONKEY}-${ANIMS.IDLE}`)
      .setOrigin(SPRITE_ORIGIN.x, SPRITE_ORIGIN.y)
      .setScale(1.15)
      .setTint(skin.tint)
      .setDepth(DEPTH.FIGHTER)
      .setAlpha(0.95);
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
      .image(330, GROUND_Y, FX_TEXTURES.shadow)
      .setAlpha(0.4)
      .setDisplaySize(400, 96)
      .setDepth(DEPTH.SHADOW);
    fadeIn(shadow, { duration: 400 });

    this.add
      .text(
        GAME_WIDTH / 2,
        262,
        victory
          ? `${skin.name} takes the crown`
          : this.winner === 'draw'
            ? 'Dead even — run it back'
            : 'Better luck next round',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '32px',
          fontStyle: '400',
          color: CSS_COLORS.muted,
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildStats() {
    const panelWidth = 760;
    const panelHeight = 396;
    const x = GAME_WIDTH / 2;
    const y = 486;

    const panel = this.add.graphics().setDepth(DEPTH.UI);
    panel.fillStyle(COLORS.panel, 0.96);
    panel.fillRoundedRect(x - panelWidth / 2, y - panelHeight / 2, panelWidth, panelHeight, 18);
    panel.lineStyle(2, COLORS.border, 1);
    panel.strokeRoundedRect(x - panelWidth / 2, y - panelHeight / 2, panelWidth, panelHeight, 18);
    slideIn(panel, { from: 40, duration: 320, delay: 200 });

    // Section header inside the panel.
    const header = sectionLabel(
      this,
      x - panelWidth / 2 + 44,
      y - panelHeight / 2 + 52,
      'Match stats',
      {
        align: 'left',
      },
    ).setDepth(DEPTH.UI);
    slideIn(header, { from: 20, axis: 'x', duration: 260, delay: 240 });

    const rows = [
      ['Rounds won', `${this.rounds.player} — ${this.rounds.enemy}`],
      ['Damage dealt', `${Math.round(this.matchStats.damageDealt)}`],
      ['Damage taken', `${Math.round(this.matchStats.damageTaken)}`],
      ['Best combo', `${this.matchStats.maxCombo} hits`],
      ['Accuracy', formatAccuracy(this.matchStats.attacksLanded, this.matchStats.attacksThrown)],
      ['Match score', `${Math.round(this.score)}`],
    ];

    const rowsTop = y - panelHeight / 2 + 92;
    const rowStep = 46;

    rows.forEach(([label, value], index) => {
      const rowY = rowsTop + index * rowStep;

      // Hairline separator between rows (not above the first).
      if (index > 0) {
        const separator = this.add.graphics().setDepth(DEPTH.UI);
        separator.lineStyle(1.5, COLORS.border, 0.7);
        separator.lineBetween(
          x - panelWidth / 2 + 44,
          rowY - rowStep / 2,
          x + panelWidth / 2 - 44,
          rowY - rowStep / 2,
        );
      }

      const left = this.add
        .text(x - panelWidth / 2 + 44, rowY, label, {
          fontFamily: FONTS.PRIMARY,
          fontSize: '27px',
          fontStyle: '500',
          color: CSS_COLORS.muted,
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.UI);

      const right = this.add
        .text(x + panelWidth / 2 - 44, rowY, value, {
          fontFamily: FONTS.DISPLAY,
          fontSize: '36px',
          fontStyle: '800',
          letterSpacing: 1,
          color: CSS_COLORS.gold,
        })
        .setOrigin(1, 0.5)
        .setDepth(DEPTH.UI);

      slideIn(left, { from: 20, axis: 'x', duration: 260, delay: 260 + index * 60 });
      slideIn(right, { from: 20, axis: 'x', duration: 260, delay: 280 + index * 60 });

      // Animate score counting up for the last row, ticking as it climbs.
      if (label === 'Match score') {
        this.scoreDisplay = right;
        right.setText('0');
        let lastTick = 0;
        tweenNumber(this, {
          from: 0,
          to: this.score,
          duration: 1200,
          delay: 300 + index * 60,
          ease: 'Quad.easeOut',
          onUpdate: (value) => {
            if (!this.scoreDisplay?.scene) return;
            this.scoreDisplay.setText(`${Math.round(value)}`);
            if (value - lastTick >= 250) {
              lastTick = value;
              audio.play('tick', { volume: 0.5 });
            }
          },
        });
      }
    });

    const record = stats.values;
    this.add
      .text(
        GAME_WIDTH / 2,
        y + panelHeight / 2 + 36,
        `Career · ${record.wins}W / ${record.losses}L · Best combo ${record.bestCombo} · Best score ${record.bestScore}`,
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '26px',
          fontStyle: '500',
          color: CSS_COLORS.muted,
        },
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
  }

  #buildButtons() {
    const rematch = new Button(this, {
      x: GAME_WIDTH / 2 - 220,
      y: GAME_HEIGHT - 120,
      width: 360,
      height: 92,
      label: 'Rematch',
      icon: 'rematch',
      fontSize: 36,
      variant: 'primary',
      onClick: () => this.#rematch(),
    })
      .setDepth(DEPTH.UI)
      .appear(420);

    const menu = new Button(this, {
      x: GAME_WIDTH / 2 + 220,
      y: GAME_HEIGHT - 120,
      width: 360,
      height: 92,
      label: 'Main menu',
      icon: 'home',
      fontSize: 36,
      variant: 'ghost',
      onClick: () => this.#toMenu(),
    })
      .setDepth(DEPTH.UI)
      .appear(480);

    this.nav = new MenuNav(this, { items: [rematch, menu] });
  }

  #rematch() {
    audio.play('uiConfirm');
    audio.play('transition', { volume: 0.4 });
    this.cameras.main.fadeOut(260, 11, 15, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.FIGHT, this.config);
    });
  }

  #toMenu() {
    audio.play('uiBack');
    audio.play('transition', { volume: 0.35 });
    this.cameras.main.fadeOut(260, 11, 15, 26);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.MENU);
    });
  }
}
