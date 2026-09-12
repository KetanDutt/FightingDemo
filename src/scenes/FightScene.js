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
import { pulse } from '../utils/fx.js';
import { bus } from '../core/EventBus.js';
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
      playerSkin: data.playerSkin ?? settings.get('lastSkin') ?? 'classic',
      enemySkin: data.enemySkin ?? 'ember',
    };
    this.roundNumber = 0;
    this.roundWins = { player: 0, enemy: 0 };
    this.roundState = ROUND_STATE.INTRO;
    this.timeLeft = ROUND_RULES.time * 1000;
    this.hitStop = 0;
    this.timeScale = 1;
    this.isPaused = false;
    this.matchOver = false;
    this.pendingAction = null;
    this.matchStats = {
      damageDealt: 0,
      damageTaken: 0,
      maxCombo: 0,
      knockouts: 0,
      attacksThrown: 0,
      attacksLanded: 0,
      startedAt: this.time?.now ?? 0,
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
    });

    this.input.keyboard?.on('keydown-R', () => {
      if (this.matchConfig.mode === MODE.TRAINING) this.#resetPositions();
    });

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
    const wantsTouch = settings.get('showTouchControls') || this.sys.game.device.input.touch;
    this.touchControls = null;
    if (!wantsTouch) return;

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

    this.touchControls = [this.joyPad, this.actionButtons];
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

    this.#showBanner(`ROUND ${this.roundNumber}`, 'Ready…', 1000, () => {
      this.#showBanner('FIGHT!', '', 620, () => {
        this.roundState = ROUND_STATE.FIGHT;
        this.player.unlock();
        this.enemy.unlock();
        audio.play('fight');
        this.cameraFx?.flash(0xffffff, 120, 0.25);
      });
    });
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
    }

    const matchOver =
      this.matchConfig.mode !== MODE.TRAINING &&
      (this.roundWins.player >= ROUND_RULES.roundsToWin ||
        this.roundWins.enemy >= ROUND_RULES.roundsToWin ||
        this.roundNumber >= ROUND_RULES.maxRounds);

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
      won: winner === 'player',
      roundsWon: this.roundWins.player,
      knockouts: this.matchStats.knockouts,
      bestCombo: this.matchStats.maxCombo,
      damage: this.matchStats.damageDealt,
      score,
      playTime,
    });

    audio.stopMusic(0.6);
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

  #showBanner(main, sub = '', hold = 1000, onComplete = null) {
    this.bannerContainer?.destroy();

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
    this.time.delayedCall(duration * scale, () => {
      this.timeScale = 1;
      this.tweens.timeScale = 1;
      this.fighters?.forEach((fighter) => {
        if (fighter?.sprite?.anims) fighter.sprite.anims.timeScale = 1;
      });
      onComplete?.();
    });
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
      this.ai?.update(dt);
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
    audio.play('uiConfirm');
    pulse(this.player, { amount: 1.02, duration: 150, baseScale: 1 });
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
    this.scene.stop(SCENES.HUD);
    this.scene.start(SCENES.FIGHT, this.matchConfig);
  }

  quitToMenu() {
    audio.play('uiBack');
    audio.stopMusic(0.4);
    this.scene.stop(SCENES.HUD);
    this.cameras.main.fadeOut(240, 13, 18, 32);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.MENU);
    });
  }

  #cleanup() {
    this.game.events.off(Phaser.Core.Events.BLUR, this.#onBlur, this);
    if (this.resumeHandler) this.events.off(Phaser.Scenes.Events.RESUME, this.resumeHandler, this);
    this.inputManager?.dispose();
    this.combat?.reset();
    this.arena?.destroy();
    this.vfx?.destroy();
    this.floatingText?.destroy();
    this.joyPad?.releaseAll?.();
    if (this.scene.isActive(SCENES.HUD)) this.scene.stop(SCENES.HUD);
  }
}
