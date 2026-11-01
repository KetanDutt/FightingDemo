import Phaser from 'phaser';
import { DEPTH, EVENTS, FONTS, GAME_WIDTH, MODE, SCENES } from '../config/constants.js';
import { COLORS, CSS_COLORS, colorblindFill, getSkin } from '../config/palette.js';
import { ROUND_RULES } from '../config/balance.js';
import { Bar } from '../ui/Bar.js';
import { drawIcon } from '../ui/Icon.js';
import { hexCss } from '../ui/text.js';
import { pulse, shakeObject, slideIn } from '../utils/fx.js';
import { bus, on } from '../core/EventBus.js';
import { audio } from '../audio/index.js';
import { settings } from '../core/Settings.js';

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
    this.roundsToWin = data.roundsToWin ?? ROUND_RULES.roundsToWin;
    this.round = 1;
    this.wins = { player: 0, enemy: 0 };
    this.lastCriticalSecond = null;
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
    const barY = 100;
    const colorblind = settings.get('colorblindMode');

    this.playerGroup = this.add.container(0, 0).setDepth(DEPTH.UI);
    this.enemyGroup = this.add.container(0, 0).setDepth(DEPTH.UI);

    this.playerBar = new Bar(this, {
      x: 560,
      y: barY,
      width: 700,
      height: 46,
      fillColor: colorblindFill(COLORS.green, colorblind),
      lagColor: COLORS.gold,
      flip: false,
    });

    this.enemyBar = new Bar(this, {
      x: GAME_WIDTH - 560,
      y: barY,
      width: 700,
      height: 46,
      fillColor: colorblindFill(COLORS.red, colorblind),
      lagColor: COLORS.gold,
      flip: true,
    });

    // Name plate above the bar, in the fighter's skin accent.
    const nameStyle = {
      fontFamily: FONTS.DISPLAY,
      fontSize: '44px',
      fontStyle: '800',
      letterSpacing: 2,
    };

    const playerLabel = this.add
      .text(180, 46, this.playerName.toUpperCase(), {
        ...nameStyle,
        color: hexCss(this.playerSkin.accent),
      })
      .setOrigin(0, 0.5);

    const enemyLabel = this.add
      .text(GAME_WIDTH - 180, 46, this.enemyName.toUpperCase(), {
        ...nameStyle,
        color: hexCss(this.enemySkin.accent),
      })
      .setOrigin(1, 0.5);

    this.playerGroup.add([this.playerBar, playerLabel]);
    this.enemyGroup.add([this.enemyBar, enemyLabel]);

    // Combo call-outs
    this.playerCombo = this.add
      .text(180, barY + 100, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '46px',
        fontStyle: '800',
        letterSpacing: 1,
        color: CSS_COLORS.gold,
        stroke: CSS_COLORS.bg,
        strokeThickness: 6,
      })
      .setOrigin(0, 0.5)
      .setAlpha(0)
      .setDepth(DEPTH.UI);

    this.enemyCombo = this.add
      .text(GAME_WIDTH - 180, barY + 100, '', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '46px',
        fontStyle: '800',
        letterSpacing: 1,
        color: CSS_COLORS.red,
        stroke: CSS_COLORS.bg,
        strokeThickness: 6,
      })
      .setOrigin(1, 0.5)
      .setAlpha(0)
      .setDepth(DEPTH.UI);
  }

  #buildTimer() {
    this.timerGroup = this.add.container(0, 0).setDepth(DEPTH.UI);

    // Quiet dark plate; the border only turns red when time runs low.
    this.plate = this.add.graphics();
    this.#drawPlate(COLORS.border);

    this.timerText = this.add
      .text(GAME_WIDTH / 2, 76, String(ROUND_RULES.time), {
        fontFamily: FONTS.DISPLAY,
        fontSize: '84px',
        fontStyle: '800',
        color: CSS_COLORS.white,
      })
      .setOrigin(0.5);

    this.roundText = this.add
      .text(GAME_WIDTH / 2, 130, 'ROUND 1', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '24px',
        fontStyle: '600',
        letterSpacing: 4,
        color: CSS_COLORS.gold,
      })
      .setOrigin(0.5);

    this.timerGroup.add([this.plate, this.timerText, this.roundText]);
  }

  #drawPlate(borderColor) {
    this.plate.clear();
    this.plate.fillStyle(COLORS.ink, 0.82);
    this.plate.fillRoundedRect(GAME_WIDTH / 2 - 120, 26, 240, 122, 14);
    this.plate.lineStyle(2, borderColor, 1);
    this.plate.strokeRoundedRect(GAME_WIDTH / 2 - 120, 26, 240, 122, 14);
  }

  #buildPips() {
    // Diamond pips below the health bar — the signature round marker.
    this.pips = { player: [], enemy: [] };
    for (let i = 0; i < this.roundsToWin; i += 1) {
      const makePip = (x) =>
        this.add
          .rectangle(x, 162, 20, 20, COLORS.shadow, 0.5)
          .setAngle(45)
          .setStrokeStyle(3, COLORS.gold, 0.7)
          .setDepth(DEPTH.UI);
      this.pips.player.push(makePip(180 + i * 42));
      this.pips.enemy.push(makePip(GAME_WIDTH - 180 - i * 42));
    }
  }

  #buildPauseButton() {
    const group = this.add.container(GAME_WIDTH - 62, 226).setDepth(DEPTH.UI);

    const disc = this.add.graphics();
    const drawDisc = (hover) => {
      disc.clear();
      disc.fillStyle(COLORS.ink, 0.82);
      disc.fillCircle(0, 0, 30);
      disc.lineStyle(2, hover ? COLORS.gold : COLORS.border, 1);
      disc.strokeCircle(0, 0, 30);
    };
    drawDisc(false);

    const icon = this.add.graphics();
    drawIcon(icon, 'pause', 24, COLORS.offWhite, 0.9);

    const zone = this.add.zone(0, 0, 72, 72).setOrigin(0.5);
    zone.setInteractive({ useHandCursor: true });

    zone.on('pointerup', () => {
      audio.play('uiClick');
      const fight = this.scene.get(SCENES.FIGHT);
      fight?.togglePause?.();
    });
    zone.on('pointerover', () => drawDisc(true));
    zone.on('pointerout', () => drawDisc(false));

    group.add([disc, icon, zone]);
    this.pauseButton = group;
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
    this.#drawPlate(critical ? COLORS.red : COLORS.border);
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

  #onRoundEnd({ winner, playerWins, enemyWins }) {
    this.wins.player = playerWins ?? this.wins.player;
    this.wins.enemy = enemyWins ?? this.wins.enemy;
    this.#refreshPips();
    // Pop the freshly-filled pip for the round's winner.
    const pip = winner === 'draw' ? null : this.pips?.[winner]?.[this.wins[winner] - 1];
    if (pip?.scene) {
      pip.setScale(0.4).setAlpha(0.2);
      this.tweens.add({
        targets: pip,
        scale: 1,
        alpha: 1,
        duration: 320,
        ease: 'Back.easeOut',
      });
    }
  }

  #refreshPips() {
    // Won pips are solid gold; the deciding pip glows faintly on match point.
    const paint = (pips, wins) => {
      pips?.forEach((pip, index) => {
        if (index < wins) {
          pip.setFillStyle(COLORS.gold, 1);
        } else if (index === wins && wins + 1 >= this.roundsToWin) {
          pip.setFillStyle(COLORS.gold, 0.35);
        } else {
          pip.setFillStyle(COLORS.shadow, 0.5);
        }
      });
    };
    paint(this.pips?.player, this.wins.player);
    paint(this.pips?.enemy, this.wins.enemy);
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
    const labels = ['', '', '2 HITS!', '3 HITS!', '4 HITS!', '5 HITS!', '6 HITS!'];
    const label = count <= 6 ? labels[count] : `${count} HIT COMBO!`;
    target.setText(label);
    target.setAlpha(1);
    target.setScale(0.5);
    this.tweens.killTweensOf(target);
    // Dramatic pop-in with overshoot
    this.tweens.add({ targets: target, scale: 1, duration: 280, ease: 'Back.easeOut' });
    // Shake for high combos
    if (count >= 4) {
      const intensity = Math.min(8, 3 + count);
      this.tweens.add({
        targets: target,
        x: { from: target.x - intensity, to: target.x + intensity },
        duration: 50,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    }
    this.tweens.add({ targets: target, alpha: 0, delay: 1400, duration: 400 });
  }

  #fadeOut() {
    this.cameras.main.fadeOut(420, 11, 15, 26);
  }

  #cleanup() {
    this.subscriptions?.forEach((unsubscribe) => unsubscribe());
    this.subscriptions = [];
    bus.off('hud:fadeOut', this.#fadeOut, this);
  }
}
