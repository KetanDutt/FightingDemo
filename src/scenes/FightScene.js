import Phaser from 'phaser';
import {
  ARENA,
  DEPTH,
  DIFFICULTY,
  EVENTS,
  FONTS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  MODE,
  ROUND_STATE,
  SCENES,
} from '../config/constants.js';
import { CAMERA_FX, FIGHTER_STATS, ROUND_RULES, SCORING } from '../config/balance.js';
import { COLORS, CSS_COLORS, getSkin } from '../config/palette.js';
import { Arena } from '../systems/Arena.js';
import { Vfx } from '../systems/Vfx.js';
import { CameraFx } from '../systems/CameraFx.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { judgeTimeout } from '../systems/combatMath.js';
import { FloatingText } from '../systems/FloatingText.js';
import { InputManager } from '../systems/InputManager.js';
import { Fighter } from '../entities/Fighter.js';
import { AiController } from '../entities/AiController.js';
import { JoyPad } from '../ui/JoyPad.js';
import { ActionButtons } from '../ui/ActionButtons.js';
import { ControlsHint } from '../ui/ControlsHint.js';
import { pulse } from '../utils/fx.js';
import { vibrate } from '../utils/haptics.js';
import { bus, on } from '../core/EventBus.js';
import { audio } from '../audio/index.js';
import { settings } from '../core/Settings.js';
import { stats } from '../core/Stats.js';

/**
 * The match itself.
 *
 * Responsibilities: build the arena and the two fighters, drive the round
 * state machine (intro → fight → KO → next round → results), pipe input into
 * the player fighter and let the combat system resolve hits.
 */
export class FightScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.FIGHT });
  }

  init(data = {}) {
    this.matchConfig = {
      mode: data.mode ?? MODE.ARCADE,
      difficulty: data.difficulty ?? settings.get('difficulty') ?? DIFFICULTY.NORMAL,
      roundCount: data.roundCount ?? settings.get('roundCount') ?? 'bo5',
      playerSkin: data.playerSkin ?? settings.get('lastSkin') ?? 'classic',
      enemySkin: data.enemySkin ?? 'ember',
      /** Training only: 'cpu' spars back, 'still' stands there for drills. */
      dummy: data.dummy ?? 'cpu',
    };
    this.isStillDummy =
      this.matchConfig.mode === MODE.TRAINING && this.matchConfig.dummy === 'still';
    this.roundRules = ROUND_RULES.forSelector(this.matchConfig.roundCount);
    this.roundNumber = 0;
    this.roundWins = { player: 0, enemy: 0 };
    this.roundState = ROUND_STATE.INTRO;
    this.timeLeft = ROUND_RULES.time * 1000;
    this.hitStop = 0;
    this.timeScale = 1;
    this.isPaused = false;
    this.matchOver = false;
    this.pendingAction = null;
    // On-screen controls: touch buttons for touch devices, keyboard legend
    // for everyone else. `touchDetected` latches the first touch tap so
    // hybrid laptops switch over as soon as the screen is actually touched.
    this.touchDetected = false;
    this.touchIntroShown = false;
    this.lastTouchMode = null;
    this.settingsUnsub = null;
    this.matchStats = {
      damageDealt: 0,
      damageTaken: 0,
      maxCombo: 0,
      knockouts: 0,
      attacksThrown: 0,
      attacksLanded: 0,
      startedAt: 0, // set properly in create() when this.time is ready
    };
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d1220');
    this.arena = new Arena(this, { reducedMotion: settings.get('reducedMotion') });
    this.vfx = new Vfx(this, {
      quality: settings.get('particleQuality'),
      reducedMotion: settings.get('reducedMotion'),
    });
    this.cameraFx = new CameraFx(this, this.arena);
    this.floatingText = new FloatingText(this);

    this.#createFighters();
    this.#createSystems();
    this.#createTouchControls();
    this.#createDebug();

    this.combat = new CombatSystem(this, {
      vfx: this.vfx,
      floatingText: this.floatingText,
      cameraFx: this.cameraFx,
      onHit: (info) => this.#onHit(info),
    });

    this.inputManager = new InputManager(this, { onPause: () => this.togglePause() });

    this.scene.launch(SCENES.HUD, {
      mode: this.matchConfig.mode,
      playerName: 'YOU',
      enemyName: this.ai?.profile?.label?.toUpperCase() ?? 'RIVAL',
      playerSkin: this.matchConfig.playerSkin,
      enemySkin: this.matchConfig.enemySkin,
      roundsToWin: this.roundRules.roundsToWin,
    });

    this.input.keyboard?.on('keydown-R', () => {
      if (this.matchConfig.mode === MODE.TRAINING) this.#resetPositions();
    });
    this.input.keyboard?.on('keydown-H', () => {
      if (!this.controlsHint?.visible) return;
      audio.play('uiClick', { volume: 0.6 });
      this.controlsHint.toggle();
    });

    // A first touch tap switches hybrid devices over to the touch controls.
    this.firstTouchHandler = (pointer) => {
      if (pointer?.wasTouch && !this.touchDetected) {
        this.touchDetected = true;
        this.#updateControlVisibility();
      }
    };
    this.input.on('pointerdown', this.firstTouchHandler);
    this.settingsUnsub = on(EVENTS.SETTINGS_CHANGED, () => this.#updateControlVisibility());

    // Auto pause when the tab loses focus.
    this.game.events.on(Phaser.Core.Events.BLUR, this.#onBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#cleanup());
    this.events.once(Phaser.Scenes.Events.PAUSE, () => {
      this.arena?.setAmbientPaused(true);
      audio.duckMusic(0.15);
    });
    this.resumeHandler = () => {
      this.isPaused = false;
      this.arena?.setAmbientPaused(false);
      audio.unduckMusic();
      this.inputManager?.clear();
      const action = this.pendingAction;
      this.pendingAction = null;
      if (action === 'restart') this.restartMatch();
      else if (action === 'quit') this.quitToMenu();
    };
    this.events.on(Phaser.Scenes.Events.RESUME, this.resumeHandler, this);

    this.matchStats.startedAt = this.time.now;
    audio.playMusic('battle');
    this.cameras.main.fadeIn(320, 13, 18, 32);

    this.time.delayedCall(340, () => this.#startRound());
  }

  /* --------------------------------- setup --------------------------------- */

  #createFighters() {
    const centerX = GAME_WIDTH / 2;
    const half = ARENA.startSeparation / 2;

    this.player = new Fighter(this, {
      x: centerX - half,
      facing: 1,
      skin: getSkin(this.matchConfig.playerSkin),
      name: 'YOU',
      isPlayer: true,
      vfx: this.vfx,
      onEvent: (type, payload) => this.#onFighterEvent('player', type, payload),
    });

    this.enemy = new Fighter(this, {
      x: centerX + half,
      facing: -1,
      skin: getSkin(this.matchConfig.enemySkin),
      name: 'RIVAL',
      isPlayer: false,
      vfx: this.vfx,
      onEvent: (type, payload) => this.#onFighterEvent('enemy', type, payload),
    });

    this.fighters = [this.player, this.enemy];
  }

  #createSystems() {
    this.ai = new AiController(this.enemy, this.player, {
      difficulty: this.matchConfig.difficulty,
    });
  }

  #createTouchControls() {
    // Touch devices get the d-pad + action buttons; keyboard devices get the
    // controls legend instead. Both are built up front and toggled live so
    // the settings panel (and a first touch tap) can switch mid-match.
    this.joyPad = new JoyPad(this, {
      x: 280,
      y: GAME_HEIGHT - 190,
      scale: 0.72,
      onDirection: (direction, isDown) => this.inputManager?.setTouchDirection(direction, isDown),
    }).setDepth(DEPTH.UI + 10);

    this.actionButtons = new ActionButtons(this, {
      x: GAME_WIDTH - 420,
      y: GAME_HEIGHT - 200,
      onAction: (action, isDown) => this.inputManager?.setTouchAction(action, isDown),
    }).setDepth(DEPTH.UI + 10);

    this.controlsHint = new ControlsHint(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 70,
      training: this.matchConfig.mode === MODE.TRAINING,
      onToggle: () => audio.play('uiClick', { volume: 0.5 }),
    }).setDepth(DEPTH.UI + 5);

    this.touchControls = [this.joyPad, this.actionButtons];
    this.#updateControlVisibility();
  }

  /** Touch mode: forced setting, touch-capable hardware, or a first tap. */
  #isTouchMode() {
    return (
      settings.get('showTouchControls') || this.sys.game.device.input.touch || this.touchDetected
    );
  }

  #updateControlVisibility() {
    const touchMode = this.#isTouchMode();
    this.joyPad?.setVisible(touchMode);
    this.actionButtons?.setVisible(touchMode);
    if (!touchMode) {
      // Never leave a held direction behind when the buttons hide.
      this.joyPad?.releaseAll();
      this.actionButtons?.releaseAll();
    }

    const showHint = settings.get('showControlsHint');
    this.controlsHint?.setVisible(showHint);
    // Collapse the legend while the touch buttons own the screen; expand it
    // for keyboards. Only auto-switch when the mode itself changed, so a
    // manual collapse (H / click) survives unrelated setting changes.
    if (showHint && this.controlsHint && touchMode !== this.lastTouchMode) {
      this.controlsHint.setExpanded(!touchMode, { silent: true });
    }
    this.lastTouchMode = touchMode;

    if (touchMode) this.#showTouchIntro();
  }

  /** One short toast so first-time touch players learn the layout. */
  #showTouchIntro() {
    if (this.touchIntroShown) return;
    this.touchIntroShown = true;
    const tip = this.add
      .text(
        GAME_WIDTH / 2,
        300,
        '◀ ▶ move · ▲ jump · ▼ block · tap PUNCH / HEAD / STOMP to attack',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '30px',
          color: CSS_COLORS.offWhite,
          stroke: '#0b0f1a',
          strokeThickness: 6,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(DEPTH.UI + 5);
    this.tweens.add({ targets: tip, alpha: 0.9, duration: 400, delay: 900 });
    this.tweens.add({
      targets: tip,
      alpha: 0,
      duration: 800,
      delay: 6000,
      onComplete: () => tip.destroy(),
    });
  }

  #createDebug() {
    if (!settings.get('showFps')) return;
    this.fpsText = this.add
      .text(24, 24, '', {
        fontFamily: FONTS.PRIMARY,
        fontSize: '26px',
        color: CSS_COLORS.green,
      })
      .setDepth(DEPTH.BANNER);
    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        if (this.fpsText?.scene)
          this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
      },
    });
  }

  /* ------------------------------- round flow ------------------------------- */

  #startRound() {
    this.roundNumber += 1;
    this.roundState = ROUND_STATE.INTRO;
    this.timeLeft = ROUND_RULES.time * 1000;
    this.hitStop = 0;
    this.timeScale = 1;
    this.tweens.timeScale = 1;

    const centerX = GAME_WIDTH / 2;
    const half = ARENA.startSeparation / 2;
    this.player.reset(centerX - half, 1);
    this.enemy.reset(centerX + half, -1);
    this.player.lock();
    this.enemy.lock();
    this.ai?.reset();
    this.combat?.reset();

    bus.emit(EVENTS.ROUND_START, {
      round: this.roundNumber,
      playerWins: this.roundWins.player,
      enemyWins: this.roundWins.enemy,
    });
    bus.emit(EVENTS.HEALTH_CHANGED, { side: 'player', ratio: 1, hp: this.player.hp });
    bus.emit(EVENTS.HEALTH_CHANGED, { side: 'enemy', ratio: 1, hp: this.enemy.hp });
    bus.emit(EVENTS.TIMER_CHANGED, { msLeft: this.timeLeft, seconds: ROUND_RULES.time });

    audio.play('roundStart');
    audio.play('transition', { volume: 0.35 });

    this.#revealFighters();

    const matchPoint =
      this.matchConfig.mode !== MODE.TRAINING &&
      (this.roundWins.player + 1 >= this.roundRules.roundsToWin ||
        this.roundWins.enemy + 1 >= this.roundRules.roundsToWin);

    this.#showBanner(
      `ROUND ${this.roundNumber}`,
      matchPoint ? 'MATCH POINT' : 'Ready…',
      1000,
      () => {
        this.#showBanner('FIGHT!', '', 620, () => {
          this.roundState = ROUND_STATE.FIGHT;
          this.player.unlock();
          this.enemy.unlock();
          audio.play('fight');
          this.cameraFx?.flash(0xffffff, 120, 0.25);
          this.cameraFx?.zoomPunch(1.03, 300);
        });
      },
    );
  }

  #endRound(winner, reason = 'ko') {
    if (this.roundState === ROUND_STATE.ENDING || this.roundState === ROUND_STATE.OVER) return;
    this.roundState = ROUND_STATE.ENDING;

    const playerWon = winner === 'player';
    const isDraw = winner === 'draw';

    if (!isDraw) this.roundWins[winner] += 1;

    bus.emit(EVENTS.ROUND_END, {
      winner,
      reason,
      round: this.roundNumber,
      playerWins: this.roundWins.player,
      enemyWins: this.roundWins.enemy,
    });

    // Celebration / defeat feedback.
    if (!isDraw) {
      const victor = playerWon ? this.player : this.enemy;
      victor.celebrate();
      this.vfx?.burst(victor.x, GROUND_Y - 200, { count: 26, tint: COLORS.gold });
      audio.play(playerWon ? 'roundWin' : 'matchLose', { volume: 0.9 });

      // Perfect round: the victor went untouched. Worth shouting about.
      if (reason === 'ko' && victor.healthRatio >= 1) {
        this.time.delayedCall(300, () => this.#spawnCallout('PERFECT!', { y: GAME_HEIGHT * 0.5 }));
        this.vfx?.burst(GAME_WIDTH / 2, GROUND_Y - 300, { count: 42, tint: COLORS.gold });
        audio.play('fanfare', { volume: 0.9 });
      }
    }

    if (reason === 'time') this.time.delayedCall(240, () => this.#spawnCallout('TIME'));

    const matchOver =
      this.matchConfig.mode !== MODE.TRAINING &&
      (this.roundWins.player >= this.roundRules.roundsToWin ||
        this.roundWins.enemy >= this.roundRules.roundsToWin ||
        this.roundNumber >= this.roundRules.maxRounds);

    // A KO that ends the match is a "finish" — same beat, bigger call.
    const isFinish =
      !isDraw && reason === 'ko' && matchOver && this.matchConfig.mode !== MODE.TRAINING;

    const bannerText = isFinish
      ? 'FINISH!'
      : isDraw
        ? 'DRAW'
        : this.matchConfig.mode === MODE.TRAINING
          ? 'RESET'
          : matchOver
            ? playerWon
              ? 'YOU WIN!'
              : 'YOU LOSE'
            : playerWon
              ? 'ROUND WIN'
              : 'ROUND LOST';

    this.#showBanner(
      bannerText,
      isFinish
        ? playerWon
          ? 'Match over'
          : 'Better luck next time'
        : isDraw
          ? 'Time up'
          : reason === 'time'
            ? 'Time up'
            : 'K.O.',
      1400,
    );

    if (isFinish) {
      this.cameraFx?.shake(0.6, 320);
      this.vfx?.burst(GAME_WIDTH / 2, GROUND_Y - 260, { count: 34, tint: COLORS.gold });
    }

    this.time.delayedCall(ROUND_RULES.endDuration, () => {
      if (matchOver) {
        this.#finishMatch(playerWon ? 'player' : isDraw ? 'draw' : 'enemy');
      } else if (this.matchConfig.mode === MODE.TRAINING) {
        this.#startRound();
      } else {
        this.#startRound();
      }
    });
  }

  #finishMatch(winner) {
    if (this.matchOver) return;
    this.matchOver = true;
    this.roundState = ROUND_STATE.OVER;

    const score = this.#calculateScore(winner);
    const playTime = ((this.time?.now ?? 0) - (this.matchStats.startedAt ?? 0)) / 1000;
    stats.recordMatch({
      won: winner === 'player' ? true : winner === 'draw' ? null : false,
      roundsWon: this.roundWins.player,
      knockouts: this.matchStats.knockouts,
      bestCombo: this.matchStats.maxCombo,
      damage: this.matchStats.damageDealt,
      score,
      playTime,
    });

    audio.stopMusic(0.6);
    audio.play('transition', { volume: 0.35 });
    bus.emit('hud:fadeOut');

    this.cameras.main.fadeOut(520, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.RESULTS, {
        winner,
        score,
        rounds: { ...this.roundWins },
        matchStats: { ...this.matchStats },
        config: this.matchConfig,
      });
    });
  }

  /** See `SCORING` in config/balance.js for the numbers. */
  #calculateScore(winner) {
    const healthBonus = Math.round(
      this.player.healthRatio * FIGHTER_STATS.maxHealth * SCORING.pointsPerHealth,
    );
    const roundBonus = this.roundWins.player * SCORING.pointsPerRound;
    const comboBonus = this.matchStats.maxCombo * SCORING.pointsPerCombo;
    const timeBonus = Math.max(0, Math.floor(this.timeLeft / 1000)) * SCORING.timeBonusPerSecond;
    const perfect = this.player.healthRatio >= 1 ? SCORING.perfectBonus : 0;
    const winBonus = winner === 'player' ? SCORING.winBonus : 0;
    return healthBonus + roundBonus + comboBonus + timeBonus + perfect + winBonus;
  }

  /* --------------------------------- banners -------------------------------- */

  /**
   * Golden floating call-out for match beats ("KO!", "TIME", "PERFECT") that
   * lands just above the fighters and fades without stealing the whole
   * screen the way the round banners do.
   */
  #spawnCallout(text, options = {}) {
    if (settings.get('reducedMotion'))
      return this.floatingText?.spawn(GAME_WIDTH / 2, GAME_HEIGHT * 0.34, text, {
        color: options.color ?? CSS_COLORS.gold,
        fontSize: 92,
        rise: 90,
        duration: 900,
      });

    const { color = CSS_COLORS.gold, x = GAME_WIDTH / 2, y = GAME_HEIGHT * 0.34 } = options;

    this.vfx?.ring(x, y, { color: 0xfff3a8, endScale: 3.2, duration: 540, alpha: 0.8 });
    this.vfx?.flash(x, y, { color: 0xffffff, scale: 2.2, duration: 220, alpha: 0.6 });

    const callout = this.add
      .text(x, y, text, {
        fontFamily: FONTS.DISPLAY,
        fontSize: '150px',
        fontStyle: 'bold',
        color,
        stroke: '#1a0f00',
        strokeThickness: 18,
        shadow: { offsetX: 0, offsetY: 10, color: '#000000', blur: 22, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.BANNER)
      .setAlpha(0)
      .setScale(2.6);

    this.tweens.add({
      targets: callout,
      alpha: 1,
      scale: 1,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: callout,
          scale: 1.06,
          duration: 620,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.tweens.add({
              targets: callout,
              alpha: 0,
              y: y - 60,
              duration: 340,
              ease: 'Quad.easeIn',
              onComplete: () => callout.destroy(),
            });
          },
        });
      },
    });
    return callout;
  }

  /**
   * Round-intro reveal: fighters pin in from their corners, the camera settles
   * from a tight push-in, and the round pitch is laid over the top.
   */
  #revealFighters() {
    const introDelay = 340;
    const reveal = (fighter, delay) => {
      const fromX = fighter.x + fighter.facing * 70;
      fighter.setAlpha(0);
      fighter.x = fromX;
      this.tweens.add({
        targets: fighter,
        x: fighter.startX,
        alpha: 1,
        duration: 520,
        delay,
        ease: 'Cubic.easeOut',
      });
    };
    reveal(this.player, introDelay);
    reveal(this.enemy, introDelay + 90);

    // Settle from a tight push-in for a little drama behind the banner.
    this.cameraFx?.zoomTo(1.14, 1);
    this.time.delayedCall(introDelay, () => this.cameraFx?.zoomTo(1, 620));
  }

  #showBanner(main, sub = '', hold = 1000, onComplete = null) {
    if (this.bannerContainer) {
      this.tweens.killTweensOf(this.bannerContainer);
      this.bannerContainer.destroy();
      this.bannerContainer = null;
    }

    const container = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT * 0.38).setDepth(DEPTH.BANNER);

    const mainText = this.add
      .text(0, 0, main, {
        fontFamily: FONTS.DISPLAY,
        fontSize: '140px',
        fontStyle: 'bold',
        color: CSS_COLORS.gold,
        stroke: '#1a0f00',
        strokeThickness: 18,
        shadow: { offsetX: 0, offsetY: 12, color: '#000000', blur: 24, fill: true },
      })
      .setOrigin(0.5);

    container.add(mainText);

    if (sub) {
      const subText = this.add
        .text(0, 110, sub, {
          fontFamily: FONTS.PRIMARY,
          fontSize: '46px',
          color: CSS_COLORS.offWhite,
        })
        .setOrigin(0.5)
        .setAlpha(0.9);
      container.add(subText);
    }

    container.setScale(2.4);
    container.setAlpha(0);

    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 320,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: container,
          scale: 1.12,
          duration: hold * 0.5,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.tweens.add({
              targets: container,
              alpha: 0,
              scale: 1.6,
              duration: 260,
              ease: 'Quad.easeIn',
              onComplete: () => {
                container.destroy();
                if (this.bannerContainer === container) this.bannerContainer = null;
                onComplete?.();
              },
            });
          },
        });
      },
    });

    this.bannerContainer = container;
    return container;
  }

  /* --------------------------------- events -------------------------------- */

  #onFighterEvent(side, type, payload) {
    switch (type) {
      case 'hurt':
      case 'blocked': {
        const fighter = side === 'player' ? this.player : this.enemy;
        bus.emit(EVENTS.HEALTH_CHANGED, { side, ratio: fighter.healthRatio, hp: fighter.hp });
        if (side === 'enemy') this.matchStats.damageDealt += payload.damage ?? 0;
        else this.matchStats.damageTaken += payload.damage ?? 0;
        break;
      }
      case 'attack':
        // Accuracy is a player-facing stat: how often did my swings connect?
        if (side === 'player') this.matchStats.attacksThrown += 1;
        break;
      case 'ko':
        this.#onKnockOut(side);
        break;
      case 'reset':
        bus.emit(EVENTS.HEALTH_CHANGED, {
          side,
          ratio: 1,
          hp: side === 'player' ? this.player.hp : this.enemy.hp,
        });
        break;
      default:
        break;
    }
  }

  #onHit({ attacker, defender, damage, blocked, combo }) {
    if (attacker === this.player && !blocked) {
      this.matchStats.maxCombo = Math.max(this.matchStats.maxCombo, combo ?? 0);
      this.matchStats.attacksLanded += 1;
    }
    void defender;
    void damage;
  }

  #onKnockOut(side) {
    audio.play('ko');
    audio.duckMusic(0.2);
    vibrate([60, 40, 90]);
    this.matchStats.knockouts += side === 'enemy' ? 1 : 0;

    // Dramatic slow motion + zoom on the KO.
    this.#setSlowMotion(ROUND_RULES.koSlowMotion.scale, ROUND_RULES.koSlowMotion.duration, () => {
      audio.unduckMusic();
    });
    this.cameraFx?.shake(CAMERA_FX.shakeOnKo, 520);
    this.cameraFx?.zoomTo(1.08, 480);
    this.cameraFx?.flash(0xffffff, 220, 0.5);

    const loser = side === 'player' ? this.player : this.enemy;
    this.vfx?.burst(loser.x, GROUND_Y - 180, { count: 30, tint: COLORS.red });
    this.time.delayedCall(300, () => this.cameraFx?.zoomTo(1, 420));

    // Big KO call-out lands just as the slow-motion starts to breathe.
    this.time.delayedCall(180, () => this.#spawnCallout('K.O.', { color: CSS_COLORS.gold }));

    if (this.matchConfig.mode === MODE.TRAINING) {
      // Training never ends: stand back up and keep going.
      this.time.delayedCall(1600, () => {
        if (!this.scene || this.matchOver) return;
        loser.reset(loser.startX, loser.startFacing);
        bus.emit(EVENTS.HEALTH_CHANGED, { side, ratio: 1, hp: loser.hp });
      });
      return;
    }

    this.time.delayedCall(420, () => this.#endRound(side === 'player' ? 'enemy' : 'player', 'ko'));
  }

  #setSlowMotion(scale, duration, onComplete = null) {
    this.timeScale = scale;
    this.tweens.timeScale = scale;
    this.fighters.forEach((fighter) => {
      fighter.sprite.anims.timeScale = scale;
    });
    this.time.delayedCall(duration, () => {
      this.#restoreTimeScale(260);
      this.fighters?.forEach((fighter) => {
        if (fighter?.sprite?.anims) fighter.sprite.anims.timeScale = 1;
      });
      onComplete?.();
    });
  }

  /**
   * Eases `tweens.timeScale` back up to 1 after slow-motion so a KO sequence
   * never snaps from 0.25× to full speed. Stepped with the scene clock
   * (`time` is not scaled by the tween manager), so it always finishes even
   * if the scene transitions away mid-restore.
   */
  #restoreTimeScale(duration = 260) {
    const running = () => this.scene?.sys?.isActive?.() && this.tweens;
    if (!running()) {
      this.timeScale = 1;
      this.tweens.timeScale = 1;
      return;
    }
    this.timeScale = 1;
    const from = this.tweens.timeScale;
    const steps = 6;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      this.time.delayedCall(duration * t, () => {
        if (!running()) return;
        const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
        this.tweens.timeScale = from + (1 - from) * eased;
      });
    }
    this.time.delayedCall(duration + 16, () => {
      if (running()) this.tweens.timeScale = 1;
    });
  }

  /**
   * Red pulsing vignette + heartbeat tick when the player's health is
   * critical. Reduced motion skips it entirely (no flashing, no pulsing).
   */
  #updateHealthVignette() {
    if (!this.player || settings.get('reducedMotion')) return;
    const ratio = this.player.healthRatio;
    if (ratio > 0.25 || ratio <= 0 || this.roundState !== ROUND_STATE.FIGHT) {
      this.vignetteOverlay?.setAlpha(0);
      return;
    }

    if (!this.vignetteOverlay) {
      this.vignetteOverlay = this.add.graphics().setDepth(DEPTH.OVERLAY - 1);
      this.vignetteOverlay.fillStyle(0xff0000, 1);
      this.vignetteOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.vignetteOverlay.setBlendMode(Phaser.BlendModes.ADD);
    }
    const intensity = (1 - ratio / 0.25) * 0.12;
    const pulseWave = 0.75 + 0.25 * Math.sin((this.time?.now ?? 0) / 300);
    this.vignetteOverlay.setAlpha(intensity * pulseWave);

    // One soft tick per second while critical.
    const now = this.time?.now ?? 0;
    if (now - (this.lastHeartbeat ?? -Infinity) >= 1000) {
      this.lastHeartbeat = now;
      audio.play('tick', { volume: 0.45 });
    }
  }

  #onBlur() {
    if (this.roundState === ROUND_STATE.FIGHT && !this.isPaused && !this.matchOver) {
      this.togglePause();
    }
  }

  /* --------------------------------- update --------------------------------- */

  update(time, delta) {
    if (!this.player || !this.enemy) return;

    this.inputManager?.update();

    const rawDelta = Math.min(delta, 50); // clamp huge tab-switch deltas
    const frozen = this.hitStop > 0;
    if (frozen) this.hitStop = Math.max(0, this.hitStop - rawDelta);

    const dt = frozen ? 0 : rawDelta * this.timeScale;
    const interactive = this.roundState === ROUND_STATE.FIGHT && !this.isPaused;

    // ---- input ----
    if (interactive) {
      const intent = this.inputManager?.read() ?? {
        moveX: 0,
        jump: false,
        block: false,
        attack: null,
      };
      this.player.intent = intent;
      if (this.isStillDummy) {
        // Training dummy: plant feet, take notes, take punches.
        this.enemy.intent = { moveX: 0, jump: false, block: false, attack: null };
      } else {
        this.ai?.update(dt);
      }
    } else {
      this.player.intent = { moveX: 0, jump: false, block: false, attack: null };
      this.enemy.intent = { moveX: 0, jump: false, block: false, attack: null };
    }

    // ---- fighters ----
    this.player.update(dt, { opponent: this.enemy });
    this.enemy.update(dt, { opponent: this.player });
    this.#separateFighters(dt);

    // ---- combat ----
    this.combat?.update(dt);
    if (interactive) {
      const hitStop = this.combat?.resolve(this.player, this.enemy) ?? 0;
      if (hitStop > this.hitStop) this.hitStop = hitStop;
    }

    // ---- health vignette (red tint when critical health) ----
    this.#updateHealthVignette();

    // ---- clock ----
    if (interactive && this.matchConfig.mode !== MODE.TRAINING) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      const seconds = Math.ceil(this.timeLeft / 1000);
      if (seconds !== this.lastBroadcastSecond) {
        this.lastBroadcastSecond = seconds;
        bus.emit(EVENTS.TIMER_CHANGED, { msLeft: this.timeLeft, seconds });
        if (seconds <= 5 && seconds > 0) audio.play('countdown', { volume: 0.8 });
      }
      if (this.timeLeft <= 0) this.#resolveTimeout();
    }
  }

  /** Keeps the fighters from standing inside each other. */
  #separateFighters(dt) {
    const { player, enemy } = this;
    if (!player || !enemy) return;
    const diff = enemy.x - player.x;
    const distance = Math.abs(diff);
    if (distance >= ARENA.minSeparation || distance === 0) return;

    const overlap = (ARENA.minSeparation - distance) / 2;
    const direction = Math.sign(diff) || 1;
    player.push(-direction * overlap, dt * 3);
    enemy.push(direction * overlap, dt * 3);
  }

  #resolveTimeout() {
    if (this.roundState !== ROUND_STATE.FIGHT) return;
    const winner = judgeTimeout(this.player.healthRatio, this.enemy.healthRatio);
    audio.play('ko', { volume: 0.7 });
    this.#endRound(winner, 'time');
  }

  #resetPositions() {
    const centerX = GAME_WIDTH / 2;
    const half = ARENA.startSeparation / 2;
    this.player.reset(centerX - half, 1);
    this.enemy.reset(centerX + half, -1);
    this.timeLeft = ROUND_RULES.time * 1000;
    audio.play('softHit', { volume: 0.9 });
    audio.play('uiConfirm', { volume: 0.7 });
    pulse(this.player, { amount: 1.02, duration: 150, baseScale: 1 });
    pulse(this.enemy, { amount: 1.02, duration: 150, baseScale: 1 });
  }

  /* ---------------------------------- pause --------------------------------- */

  togglePause() {
    if (this.matchOver || this.isPaused) return;
    this.isPaused = true;
    audio.play('uiClick');
    this.scene.pause();
    this.scene.launch(SCENES.PAUSE, { from: SCENES.FIGHT });
  }

  restartMatch() {
    audio.play('uiConfirm');
    audio.play('transition', { volume: 0.4 });
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.FIGHT, this.matchConfig);
  }

  quitToMenu() {
    audio.play('uiBack');
    audio.play('transition', { volume: 0.4 });
    audio.stopMusic(0.4);
    this.scene.stop(SCENES.HUD);
    this.cameras.main.fadeOut(240, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.MENU);
    });
  }

  #cleanup() {
    this.settingsUnsub?.();
    this.settingsUnsub = null;
    if (this.firstTouchHandler) {
      this.input?.off('pointerdown', this.firstTouchHandler);
      this.firstTouchHandler = null;
    }
    this.game.events.off(Phaser.Core.Events.BLUR, this.#onBlur, this);
    if (this.resumeHandler) this.events.off(Phaser.Scenes.Events.RESUME, this.resumeHandler, this);
    this.inputManager?.dispose();
    this.combat?.reset();
    this.arena?.destroy();
    this.vfx?.destroy();
    this.floatingText?.destroy();
    this.vignetteOverlay?.destroy();
    this.joyPad?.releaseAll?.();
    if (this.scene.isActive(SCENES.HUD)) this.scene.stop(SCENES.HUD);
  }
}
