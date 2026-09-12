import Phaser from 'phaser';
import {
  ANIMS,
  ARENA,
  DEPTH,
  FIGHTER_SCALE,
  FIGHTER_STATE,
  GROUND_Y,
  SPRITE_ANCHOR,
  SPRITE_ORIGIN,
  TEXTURE_KEYS,
} from '../config/constants.js';
import { ATTACKS, BLOCK, FIGHTER_STATS } from '../config/balance.js';
import { FX_TEXTURES } from '../utils/textures.js';
import { getFrameBody } from '../utils/frames.js';
import { clamp } from '../utils/math.js';
import { audio } from '../audio/index.js';

const WALK_STEP_INTERVAL = 340;

/**
 * A fighter.
 *
 * The sprite sheets bake a lot of motion into the frames themselves (the jump
 * arc, the stomp leap), so the container itself always stays on the ground and
 * gameplay reads the current frame's position back through
 * `getFrameBody()`. That keeps hit boxes honest without hand authored
 * collision data.
 */
export class Fighter extends Phaser.GameObjects.Container {
  constructor(scene, config = {}) {
    const {
      x = 640,
      facing = 1,
      skin = null,
      name = 'Fighter',
      isPlayer = false,
      onEvent = null,
      vfx = null,
    } = config;

    super(scene, x, GROUND_Y);

    this.fighterName = name;
    this.skin = skin;
    this.isPlayer = isPlayer;
    this.onEvent = onEvent;
    this.vfx = vfx;

    this.setScale(FIGHTER_SCALE);
    this.setDepth(DEPTH.FIGHTER);

    this.maxHealth = FIGHTER_STATS.maxHealth;
    this.hp = this.maxHealth;
    this.facing = facing;
    this.startX = x;
    this.startFacing = facing;

    this.state = FIGHTER_STATE.IDLE;
    this.stateElapsed = 0;
    this.hitstunTimer = 0;
    this.blockstunTimer = 0;
    this.downTimer = 0;
    this.getUpTimer = 0;
    this.jumpTimer = 0;
    this.landRecovery = 0;
    this.stepTimer = 0;
    this.attack = null;
    this.pendingKnockDown = false;
    this.velocityX = 0;
    this.isKO = false;
    this.intent = { moveX: 0, jump: false, block: false, attack: null };
    this.frameBody = {
      offsetX: 0,
      feetOffsetY: 0,
      halfWidth: SPRITE_ANCHOR.halfWidth,
      height: SPRITE_ANCHOR.height,
    };

    this.sprite = scene.add
      .sprite(0, 0, `${TEXTURE_KEYS.MONKEY}-${ANIMS.IDLE}`)
      .setOrigin(SPRITE_ORIGIN.x, SPRITE_ORIGIN.y);
    if (skin?.tint) this.sprite.setTint(skin.tint);

    this.shadow = scene.add
      .image(0, -4, FX_TEXTURES.shadow)
      .setAlpha(0.45)
      .setDepth(DEPTH.SHADOW)
      .setDisplaySize(SPRITE_ANCHOR.halfWidth * 2.1, 96);

    this.add([this.shadow, this.sprite]);
    this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });

    scene.add.existing(this);
  }

  /* --------------------------------- getters -------------------------------- */

  get isAttacking() {
    return Boolean(this.attack) && this.attack.phase !== 'recovery';
  }

  get isRecovering() {
    return Boolean(this.attack) && this.attack.phase === 'recovery';
  }

  get isBlocking() {
    return this.state === FIGHTER_STATE.BLOCK;
  }

  /**
   * Is the fighter protecting themselves right now?
   *
   * Holding the block button counts, and so does holding *away* from the
   * opponent (the Street Fighter convention): backing off is a guard, so you
   * can retreat safely but you cannot attack out of it.
   */
  get isGuarding() {
    if (this.isKO || this.isDown || this.isStunned || this.attack) return false;
    if (this.airborneHeight > 0) return false;
    if (this.intent.attack) return false;
    if (this.intent.block) return true;
    return this.intent.moveX !== 0 && Math.sign(this.intent.moveX) !== Math.sign(this.facing);
  }

  get isStunned() {
    return this.hitstunTimer > 0 || this.blockstunTimer > 0;
  }

  get isDown() {
    return (
      this.state === FIGHTER_STATE.DOWN ||
      this.state === FIGHTER_STATE.GETUP ||
      this.state === FIGHTER_STATE.KO
    );
  }

  /** Height above the ground baked into the current frame. */
  get airborneHeight() {
    return Math.max(0, -this.frameBody.feetOffsetY * FIGHTER_SCALE);
  }

  get isInvulnerable() {
    return this.isDown || this.state === FIGHTER_STATE.GETUP;
  }

  get healthRatio() {
    return clamp(this.hp / this.maxHealth, 0, 1);
  }

  get canAct() {
    return (
      !this.isKO &&
      !this.isDown &&
      this.hitstunTimer <= 0 &&
      this.blockstunTimer <= 0 &&
      !this.attack &&
      this.landRecovery <= 0 &&
      this.state !== FIGHTER_STATE.JUMP &&
      this.state !== FIGHTER_STATE.LOCKED
    );
  }

  /* ---------------------------------- update -------------------------------- */

  /**
   * @param {number} dt milliseconds elapsed (already scaled by slow motion)
   * @param {{opponent?:Fighter}} ctx
   */
  update(dt, ctx = {}) {
    if (this.state === FIGHTER_STATE.KO) {
      this.#updateVisual();
      return;
    }

    this.#updateTimers(dt);
    this.#updatePhysics(dt);
    this.#updateState(dt, ctx);
    this.#updateVisual();
  }

  #updateTimers(dt) {
    if (this.hitstunTimer > 0) {
      this.hitstunTimer = Math.max(0, this.hitstunTimer - dt);
      if (this.hitstunTimer === 0) this.#resolveHitStun();
    }
    if (this.blockstunTimer > 0) this.blockstunTimer = Math.max(0, this.blockstunTimer - dt);
    if (this.landRecovery > 0) this.landRecovery = Math.max(0, this.landRecovery - dt);
    if (this.jumpTimer > 0) {
      this.jumpTimer = Math.max(0, this.jumpTimer - dt);
      if (this.jumpTimer === 0) this.#land();
    }
    if (this.getUpTimer > 0) {
      this.getUpTimer = Math.max(0, this.getUpTimer - dt);
      if (this.getUpTimer === 0) this.#finishGetUp();
    }
    if (this.downTimer > 0) {
      this.downTimer = Math.max(0, this.downTimer - dt);
      if (this.downTimer === 0) this.#startGetUp();
    }
    if (this.attack) this.#updateAttack(dt);
    this.stateElapsed += dt;
  }

  #updatePhysics(dt) {
    const seconds = dt / 1000;

    if (this.velocityX !== 0) {
      this.x += this.velocityX * seconds;
      // Exponential-ish friction.
      this.velocityX -= this.velocityX * Math.min(1, seconds * 7);
      if (Math.abs(this.velocityX) < 4) this.velocityX = 0;
    }

    this.x = clamp(this.x, ARENA.left, ARENA.right);
  }

  #updateState(dt, ctx) {
    if (this.state === FIGHTER_STATE.LOCKED) {
      this.intent = { moveX: 0, jump: false, block: false, attack: null };
      return;
    }

    // Facing follows the opponent unless we are mid action.
    if (ctx.opponent && this.canAct && !this.isStunned) {
      this.faceTowards(ctx.opponent.x);
    }

    if (this.isStunned) {
      if (this.state !== FIGHTER_STATE.HURT && this.hitstunTimer > 0)
        this.#setState(FIGHTER_STATE.HURT);
      return;
    }

    if (this.isDown) return;

    if (this.attack) return;

    if (this.state === FIGHTER_STATE.JUMP) {
      // Air control at reduced speed.
      const speed = FIGHTER_STATS.walkForwardSpeed * 0.55;
      this.x += this.intent.moveX * speed * (dt / 1000);
      this.x = clamp(this.x, ARENA.left, ARENA.right);
      return;
    }

    if (this.landRecovery > 0) return;

    const { moveX, jump, block, attack } = this.intent;

    if (attack) {
      this.startAttack(attack);
      return;
    }

    if (jump && this.canAct) {
      this.startJump();
      return;
    }

    if (block && this.canAct) {
      if (this.state !== FIGHTER_STATE.BLOCK) {
        this.#setState(FIGHTER_STATE.BLOCK);
        this.sprite.play({ key: ANIMS.BLOCK, repeat: -1 });
      }
      return;
    }

    if (this.state === FIGHTER_STATE.BLOCK && !block) {
      this.#setState(FIGHTER_STATE.IDLE);
      this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
      return;
    }

    if (moveX !== 0 && this.canAct) {
      const forward = moveX === this.facing;
      const state = forward ? FIGHTER_STATE.WALK_FORWARD : FIGHTER_STATE.WALK_BACK;
      const speed = forward ? FIGHTER_STATS.walkForwardSpeed : FIGHTER_STATS.walkBackSpeed;
      if (this.state !== state) {
        this.#setState(state);
        this.sprite.play({ key: forward ? ANIMS.MOVE_FORWARD : ANIMS.MOVE_BACK, repeat: -1 });
      }
      this.x += moveX * speed * (dt / 1000);
      this.x = clamp(this.x, ARENA.left, ARENA.right);

      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = WALK_STEP_INTERVAL;
        audio.play('step', { volume: 0.7 });
        this.vfx?.dustPuff(this.x - this.facing * 90, GROUND_Y + 6, {
          amount: 2,
          direction: this.facing,
        });
      }
      return;
    }

    if (this.state !== FIGHTER_STATE.IDLE) {
      this.#setState(FIGHTER_STATE.IDLE);
      this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
    }
  }

  #updateVisual() {
    this.frameBody = getFrameBody(this.sprite);
    const lift = this.airborneHeight;
    const shrink = clamp(1 - lift / 900, 0.35, 1);
    this.shadow.setAlpha(0.45 * shrink);
    this.shadow.setDisplaySize(SPRITE_ANCHOR.halfWidth * 2.1 * shrink, 96 * shrink);
    this.shadow.setVisible(!this.isKO || lift < 40);
  }

  /* --------------------------------- actions -------------------------------- */

  #setState(state) {
    this.state = state;
    this.stateElapsed = 0;
    this.onEvent?.('state', { fighter: this, state });
  }

  /** Turns to face a world X position. */
  faceTowards(x) {
    const desired = x >= this.x ? 1 : -1;
    if (desired !== this.facing) {
      this.facing = desired;
      this.setScale(FIGHTER_SCALE * desired, FIGHTER_SCALE);
    }
  }

  startAttack(key) {
    const def = ATTACKS[key];
    if (!def || !this.canAct) return false;

    this.attack = { def, elapsed: 0, phase: 'startup', hasHit: false, key };
    this.#setState(key);
    this.sprite.play({ key: def.anim, repeat: 0 });
    audio.play(def.sfx.swing, { volume: 0.9 });

    if (def.lunge > 0) {
      const distance = def.lunge * this.facing;
      this.scene.tweens.add({
        targets: this,
        x: clamp(this.x + distance, ARENA.left, ARENA.right),
        duration: def.startup + def.active,
        ease: 'Quad.easeOut',
      });
    }

    this.onEvent?.('attack', { fighter: this, key });
    return true;
  }

  #updateAttack(dt) {
    const attack = this.attack;
    if (!attack) return;
    const def = attack.def;
    attack.elapsed += dt;

    const activeEnd = def.startup + def.active;
    const totalEnd = activeEnd + def.recovery;

    if (attack.phase === 'startup' && attack.elapsed >= def.startup) {
      attack.phase = 'active';
    } else if (attack.phase === 'active' && attack.elapsed >= activeEnd) {
      attack.phase = 'recovery';
    } else if (attack.phase === 'recovery' && attack.elapsed >= totalEnd) {
      this.attack = null;
      this.#setState(FIGHTER_STATE.IDLE);
      this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
    }
  }

  /** Hit box for the current frame, or null when nothing can hit. */
  getAttackHitbox() {
    const attack = this.attack;
    if (!attack || attack.phase !== 'active' || attack.hasHit) return null;
    const def = attack.def;
    const lift = this.frameBody.feetOffsetY * FIGHTER_SCALE;
    const centerX = this.x + this.facing * def.reach * FIGHTER_SCALE;
    const centerY = GROUND_Y + lift + ((def.band.top + def.band.bottom) / 2) * FIGHTER_SCALE;
    const halfHeight = ((def.band.bottom - def.band.top) / 2) * FIGHTER_SCALE;
    return {
      x: centerX,
      y: centerY,
      halfWidth: def.halfWidth * FIGHTER_SCALE,
      halfHeight,
      def,
      attack,
    };
  }

  /** Body box used to receive hits. */
  getHurtbox() {
    const body = this.frameBody;
    const halfWidth =
      Math.min(body.halfWidth, SPRITE_ANCHOR.halfWidth * 1.15) *
      FIGHTER_STATS.hurtbox.widthScale *
      FIGHTER_SCALE;
    const height =
      Math.min(body.height, SPRITE_ANCHOR.height * 1.1) *
      FIGHTER_STATS.hurtbox.heightScale *
      FIGHTER_SCALE;
    const centerX = this.x + this.facing * body.offsetX * FIGHTER_SCALE;
    const bottom = GROUND_Y + body.feetOffsetY * FIGHTER_SCALE;
    return { x: centerX, halfWidth, top: bottom - height, bottom, height };
  }

  startJump() {
    if (this.state === FIGHTER_STATE.JUMP || !this.canAct) return false;
    this.#setState(FIGHTER_STATE.JUMP);
    this.jumpTimer = FIGHTER_STATS.jumpDuration;
    this.sprite.play({ key: ANIMS.JUMP, repeat: 0 });
    audio.play('jump');
    this.vfx?.dustPuff(this.x, GROUND_Y + 4, { amount: 5, scale: 1.2 });
    this.onEvent?.('jump', { fighter: this });
    return true;
  }

  #land() {
    this.landRecovery = FIGHTER_STATS.landRecovery;
    this.state = FIGHTER_STATE.IDLE;
    this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
    audio.play('land', { volume: 0.8 });
    this.vfx?.dustPuff(this.x, GROUND_Y + 6, { amount: 8, scale: 1.5 });
  }

  /* ---------------------------------- damage -------------------------------- */

  /**
   * Applies an incoming hit.
   * @returns {{damage:number, blocked:boolean, killed:boolean}}
   */
  receiveHit({ def, damage, from, blocked }) {
    const applied = blocked ? damage * BLOCK.chipScale : damage;
    this.hp = Math.max(0, this.hp - applied);

    if (blocked) {
      this.blockstunTimer = def.blockstun;
      this.velocityX += from.facing * BLOCK.pushback * 0.6;
      // Guarding by holding away? Snap into the guard pose so the block reads.
      if (this.state !== FIGHTER_STATE.BLOCK && !this.isKO) {
        this.#setState(FIGHTER_STATE.BLOCK);
        this.sprite.play({ key: ANIMS.BLOCK, repeat: -1 });
      }
      this.onEvent?.('blocked', { fighter: this, damage: applied });
    } else {
      this.attack = null;
      this.pendingKnockDown = def.knockDown || this.hp <= 0;
      this.hitstunTimer = def.hitstun;
      this.velocityX = from.facing * def.knockback;
      this.#setState(FIGHTER_STATE.HURT);
      this.sprite.play({ key: ANIMS.HIT, repeat: 0 });
      this.onEvent?.('hurt', { fighter: this, damage: applied });
    }

    if (this.hp <= 0) {
      this.#knockOut();
    }

    return { damage: applied, blocked, killed: this.hp <= 0 };
  }

  #knockOut() {
    if (this.isKO) return;
    this.isKO = true;
    this.hitstunTimer = 0;
    this.blockstunTimer = 0;
    this.attack = null;
    this.velocityX = 0;
    this.#setState(FIGHTER_STATE.KO);
    this.sprite.play({ key: ANIMS.DIE, repeat: 0 });
    this.scene.tweens.add({
      targets: this,
      y: GROUND_Y + 6,
      duration: 220,
      ease: 'Quad.easeOut',
    });
    this.onEvent?.('ko', { fighter: this });
  }

  /** Called when hit stun runs out: either get back up or fall over. */
  #resolveHitStun() {
    if (this.isKO) return;
    if (this.pendingKnockDown) {
      this.pendingKnockDown = false;
      this.#setState(FIGHTER_STATE.DOWN);
      this.downTimer = FIGHTER_STATS.downDuration;
      this.sprite.play({ key: ANIMS.DIE, repeat: 0 });
      return;
    }
    this.#setState(FIGHTER_STATE.IDLE);
    this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
  }

  #startGetUp() {
    this.#setState(FIGHTER_STATE.GETUP);
    this.getUpTimer = 1000;
    // Reversing the defeat animation gives a convincing get-up.
    this.sprite.playReverse({ key: ANIMS.DIE, repeat: 0 }, false);
  }

  #finishGetUp() {
    this.#setState(FIGHTER_STATE.IDLE);
    this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
  }

  /** Plays the little celebration hop after winning a round. */
  celebrate() {
    if (this.isKO) return;
    this.state = FIGHTER_STATE.VICTORY;
    this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
    this.scene.tweens.add({
      targets: this,
      y: GROUND_Y - 70,
      duration: 320,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.y = GROUND_Y;
      },
    });
  }

  /** Freezes the fighter (round intro / results). */
  lock() {
    this.state = FIGHTER_STATE.LOCKED;
    this.intent = { moveX: 0, jump: false, block: false, attack: null };
    this.attack = null;
    this.velocityX = 0;
    this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
  }

  /** Releases the fighter at the start of a round. */
  unlock() {
    if (this.state !== FIGHTER_STATE.LOCKED) return;
    this.intent = { moveX: 0, jump: false, block: false, attack: null };
    this.#setState(FIGHTER_STATE.IDLE);
    this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
  }

  /** Full reset for a new round. */
  reset(x = this.startX, facing = this.startFacing) {
    this.hp = this.maxHealth;
    this.isKO = false;
    this.attack = null;
    this.hitstunTimer = 0;
    this.blockstunTimer = 0;
    this.downTimer = 0;
    this.getUpTimer = 0;
    this.jumpTimer = 0;
    this.landRecovery = 0;
    this.velocityX = 0;
    this.pendingKnockDown = false;
    this.x = x;
    this.y = GROUND_Y;
    this.facing = facing;
    this.setScale(FIGHTER_SCALE * facing, FIGHTER_SCALE);
    this.setAlpha(1);
    this.state = FIGHTER_STATE.IDLE;
    this.sprite.play({ key: ANIMS.IDLE, repeat: -1 });
    this.onEvent?.('reset', { fighter: this });
  }

  /** Weak push used to keep fighters from overlapping. */
  push(direction, dt) {
    this.x += direction * FIGHTER_STATS.pushSpeed * (dt / 1000);
    this.x = clamp(this.x, ARENA.left, ARENA.right);
  }

  destroy(fromScene) {
    this.scene?.tweens?.killTweensOf(this);
    super.destroy(fromScene);
  }
}
