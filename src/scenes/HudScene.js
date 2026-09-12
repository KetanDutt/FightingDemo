import Phaser from 'phaser';
import { DEPTH, EVENTS, FONTS, GAME_WIDTH, MODE, SCENES } from '../config/constants.js';
import { COLORS, CSS_COLORS, getSkin } from '../config/palette.js';
import { ROUND_RULES } from '../config/balance.js';
import { Bar } from '../ui/Bar.js';
import { pulse, shakeObject, slideIn } from '../utils/fx.js';
import { bus, on } from '../core/EventBus.js';
import { audio } from '../audio/index.js';

/**
 * Heads up display.
 *
 * Runs as an overlay scene so the fight scene never has to worry about UI
 * layout: the two talk through the global event bus only.
 */
export class HudScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.HUD });
  }

  init(data = {}) {
    this.mode = data.mode ?? MODE.ARCADE;
    this.playerName = data.playerName ?? 'YOU';
    this.enemyName = data.enemyName ?? 'RIVAL';
    this.playerSkin = getSkin(data.playerSkin);
    this.enemySkin = getSkin(data.enemySkin);
    this.round = 1;
    this.wins = { player: 0, enemy: 0 };
  }

  create() {
    this.subscriptions = [];
    this.#buildBars();
    this.#buildTimer();
    this.#buildPips();
    this.#buildPauseButton();

    this.#subscribe(EVENTS.HEALTH_CHANGED, (payload) => this.#onHealth(payload));
    this.#subscribe(EVENTS.TIMER_CHANGED, (payload) => this.#onTimer(payload));
    this.#subscribe(EVENTS.ROUND_START, (payload) => this.#onRoundStart(payload));
    this.#subscribe(EVENTS.ROUND_END, (payload) => this.#onRoundEnd(payload));
    this.#subscribe(EVENTS.COMBO_CHANGED, (payload) => this.#onCombo(payload));

    bus.on('hud:fadeOut', this.#fadeOut, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#cleanup());

    slideIn(this.playerGroup, { from: -60, axis: 'y', duration: 300 });
    slideIn(this.enemyGroup, { from: -60, axis: 'y', duration: 300, delay: 80 });
    slideIn(this.timerGroup, { from: -60, axis: 'y', duration: 300, delay: 160 });
  }

  #subscribe(event, handler) {
    this.subscriptions.push(on(event, handler, this));
  }

  /* ---------------------------------- build --------------------------------- */

  #buildBars() {
    const barY = 96;

    this.playerGroup = this.add.container(0, 0).setDepth(DEPTH.UI);
    this.enemyGroup = this.add.container(0, 0).setDepth(DEPTH.UI);

    this.playerBar = new Bar(this, {
      x: 560,
      y: barY,
      width: 700,
      height: 46,
      fillColor: COLORS.green,
      lagColor: COLORS.gold,
      flip: false,
    });

    this.enemyBar = new Bar(this, {
      x: GAME_WIDTH - 560,
      y: barY,
      width: 700,
      height: 46,
      fillColor: COLORS.red,
      lagColor: COLORS.gold,
      flip: true,
    });

    const nameStyle = {
      fontFamily: FONTS.DISPLAY,
      fontSize: '46px',
      fontStyle: 'bold',
      color: CSS_COLORS.white,
      stroke: '#0b0f1a',
      strokeThickness: 8,
    };

    const playerLabel = this.add
      .text(180, barY - 4, this.playerName, nameStyle)
      .setOrigin(0, 0.5)
      .setTint(this.playerSkin.accent);

    const enemyLabel = this.add
      .text(GAME_WIDTH - 180, barY - 4, this.enemyName, nameStyle)
      .setOrigin(1, 0.5)
      .setTint(this.enemySkin.accent);

    this.playerGroup.add([this.playerBar, playerLabel]);
    this.enemyGroup.add([this.enemyBar, enemyLabel]);

    // Combo call-outs
    this.playerCombo = this.add
      .text(180, barY + 78, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '44px',
        fontStyle: 'bold',
        color: CSS_COLORS.gold,
        stroke: '#0b0f1a',
        strokeThickness: 8,
      })
      .setOrigin(0, 0.5)
      .setAlpha(0)
      .setDepth(DEPTH.UI);

    this.enemyCombo = this.add
      .text(GAME_WIDTH - 180, barY + 78, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '44px',
        fontStyle: 'bold',
        color: CSS_COLORS.red,
        stroke: '#0b0f1a',
        strokeThickness: 8,
      })
      .setOrigin(1, 0.5)
      .setAlpha(0)
      .setDepth(DEPTH.UI);
  }

  #buildTimer() {
    this.timerGroup = this.add.container(0, 0).setDepth(DEPTH.UI);

    const plate = this.add.graphics();
    plate.fillStyle(0x000000, 0.45);
    plate.fillRoundedRect(GAME_WIDTH / 2 - 130, 30, 260, 130, 26);
    plate.lineStyle(4, COLORS.gold, 0.8);
    plate.strokeRoundedRect(GAME_WIDTH / 2 - 130, 30, 260, 130, 26);

    this.timerText = this.add
      .text(GAME_WIDTH / 2, 82, String(ROUND_RULES.time), {
        fontFamily: FONTS.DISPLAY,
        fontSize: '82px',
        fontStyle: 'bold',
        color: CSS_COLORS.white,
        stroke: '#0b0f1a',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.roundText = this.add
      .text(GAME_WIDTH / 2, 178, 'ROUND 1', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '32px',
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5);

    this.timerGroup.add([plate, this.timerText, this.roundText]);
  }

  #buildPips() {
    this.pips = { player: [], enemy: [] };
    for (let i = 0; i < ROUND_RULES.roundsToWin; i += 1) {
      const playerPip = this.add
        .circle(180 + i * 46, 78, 16, 0x000000, 0.5)
        .setStrokeStyle(4, COLORS.gold, 0.7)
        .setDepth(DEPTH.UI);
      const enemyPip = this.add
        .circle(GAME_WIDTH - 180 - i * 46, 78, 16, 0x000000, 0.5)
        .setStrokeStyle(4, COLORS.gold, 0.7)
        .setDepth(DEPTH.UI);
      this.pips.player.push(playerPip);
      this.pips.enemy.push(enemyPip);
    }
  }

  #buildPauseButton() {
    const button = this.add
      .text(GAME_WIDTH - 60, 220, '⏸', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '46px',
        color: CSS_COLORS.white,
      })
      .setOrigin(0.5)
      .setAlpha(0.65)
      .setDepth(DEPTH.UI)
      .setInteractive({ useHandCursor: true });

    button.on('pointerup', () => {
      audio.play('uiClick');
      const fight = this.scene.get(SCENES.FIGHT);
      fight?.togglePause?.();
    });
    button.on('pointerover', () => button.setAlpha(1));
    button.on('pointerout', () => button.setAlpha(0.65));
    this.pauseButton = button;
  }

  /* --------------------------------- events -------------------------------- */

  #onHealth({ side, ratio }) {
    const bar = side === 'player' ? this.playerBar : this.enemyBar;
    if (!bar) return;
    const previous = bar.value;
    bar.setValue(ratio, { animate: true });
    bar.setDanger(ratio <= 0.25 && ratio > 0);
    if (ratio < previous) {
      bar.flash();
      shakeObject(side === 'player' ? this.playerGroup : this.enemyGroup, {
        intensity: 6,
        duration: 180,
      });
    }
  }

  #onTimer({ seconds }) {
    if (!this.timerText?.scene) return;
    if (this.mode === MODE.TRAINING) {
      this.timerText.setText('∞');
      return;
    }
    this.timerText.setText(String(Math.max(0, seconds)));
    const critical = seconds <= 10;
    this.timerText.setColor(critical ? CSS_COLORS.red : CSS_COLORS.white);
    if (critical && seconds !== this.lastCriticalSecond) {
      this.lastCriticalSecond = seconds;
      pulse(this.timerText, { amount: 1.18, duration: 150, baseScale: 1 });
    }
  }

  #onRoundStart({ round, playerWins, enemyWins }) {
    this.round = round;
    this.wins.player = playerWins;
    this.wins.enemy = enemyWins;
    if (this.roundText?.scene) this.roundText.setText(`ROUND ${round}`);
    this.#refreshPips();
    pulse(this.roundText, { amount: 1.15, duration: 180, baseScale: 1 });
  }

  #onRoundEnd() {
    this.#refreshPips();
  }

  #refreshPips() {
    this.pips?.player?.forEach((pip, index) => {
      pip.setFillStyle(
        index < this.wins.player ? COLORS.gold : 0x000000,
        index < this.wins.player ? 1 : 0.5,
      );
    });
    this.pips?.enemy?.forEach((pip, index) => {
      pip.setFillStyle(
        index < this.wins.enemy ? COLORS.gold : 0x000000,
        index < this.wins.enemy ? 1 : 0.5,
      );
    });
  }

  #onCombo({ count, side = 'player' }) {
    if (!this.playerCombo?.scene) return;
    if (!count || count < 2) {
      this.tweens.add({
        targets: side === 'enemy' ? this.enemyCombo : this.playerCombo,
        alpha: 0,
        duration: 200,
      });
      return;
    }
    const target = side === 'enemy' ? this.enemyCombo : this.playerCombo;
    target.setText(`${count} HIT COMBO`);
    target.setAlpha(1);
    target.setScale(0.7);
    this.tweens.killTweensOf(target);
    this.tweens.add({ targets: target, scale: 1, duration: 240, ease: 'Back.easeOut' });
    this.tweens.add({ targets: target, alpha: 0, delay: 1100, duration: 320 });
  }

  #fadeOut() {
    this.cameras.main.fadeOut(420, 13, 18, 32);
  }

  #cleanup() {
    this.subscriptions?.forEach((unsubscribe) => unsubscribe());
    this.subscriptions = [];
    bus.off('hud:fadeOut', this.#fadeOut, this);
  }
}
