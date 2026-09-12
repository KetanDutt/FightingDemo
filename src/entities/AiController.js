import { AI_PROFILES, ATTACKS } from '../config/balance.js';
import { chance, clamp, randFloat, weightedPick } from '../utils/math.js';

/**
 * How the AI reads the player. Tendencies start at these priors and converge
 * towards the real numbers as the round goes on, so early decisions are sane
 * and late decisions are personal.
 */
const READ_PRIORS = { blocking: 0.22, airborne: 0.08, attacking: 0.25 };
/** Observation time (ms) a prior is worth, i.e. how fast the AI adapts. */
const READ_WEIGHT = 7000;

const IDLE_INTENT = { moveX: 0, jump: false, block: false, attack: null };

/**
 * Opponent brain.
 *
 * A small utility driven state machine: pick a plan (approach / retreat /
 * attack / block / jump / wait), commit to it for the reaction window, then
 * re-evaluate. Difficulty only changes the profile numbers, so tuning is data
 * driven and easy to balance.
 */
export class AiController {
  constructor(fighter, opponent, options = {}) {
    this.fighter = fighter;
    this.opponent = opponent;
    this.profile = AI_PROFILES[options.difficulty] ?? AI_PROFILES.normal;
    this.plan = 'wait';
    this.planTimer = 0;
    this.reactionTimer = 0;
    this.blockTimer = 0;
    this.pendingAttack = null;
    this.attackGrace = 0;
    this.attackCooldown = 0;
    this.comboQueued = false;
    /** Accumulated observation of the player (ms spent doing each thing). */
    this.reads = { observed: 0, blocking: 0, airborne: 0, attacking: 0 };
    /** Profile after adaptation is applied — this is what the brain uses. */
    this.live = { ...this.profile };
  }

  setDifficulty(difficulty) {
    this.profile = AI_PROFILES[difficulty] ?? AI_PROFILES.normal;
    this.live = { ...this.profile };
    return this;
  }

  reset() {
    this.plan = 'wait';
    this.planTimer = this.profile.reaction;
    this.reactionTimer = 0;
    this.blockTimer = 0;
    this.pendingAttack = null;
    this.attackGrace = 0;
    this.attackCooldown = 0;
    this.comboQueued = false;
    this.reads = { observed: 0, blocking: 0, airborne: 0, attacking: 0 };
    this.live = { ...this.profile };
  }

  #towards() {
    const { fighter, opponent } = this;
    return opponent.x > fighter.x ? 1 : -1;
  }

  /**
   * Watches what the player is doing. Cheap: a few accumulators ticked by dt.
   * Only counts time where the opponent could actually act, so round intros,
   * hitstun and KOs do not skew the read.
   */
  #observe(dt) {
    const { opponent } = this;
    if (!opponent || opponent.isKO) return;
    this.reads.observed += dt;
    if (opponent.isBlocking) this.reads.blocking += dt;
    if (opponent.airborneHeight > 40) this.reads.airborne += dt;
    if (opponent.isAttacking) this.reads.attacking += dt;
  }

  /** Smoothed tendency: starts at `READ_PRIORS[key]`, converges on reality. */
  #tendency(key) {
    const prior = READ_PRIORS[key];
    const total = this.reads.observed + READ_WEIGHT;
    return (this.reads[key] + prior * READ_WEIGHT) / total;
  }

  /**
   * Rebuilds `live` from the difficulty profile plus what we have learned
   * about this particular player. Everything is clamped, so adaptation can
   * shift the fight's feel but never break the difficulty contract
   * (easy stays easier than normal stays easier than hard).
   */
  #adapt() {
    const base = this.profile;
    const blockRate = this.#tendency('blocking');
    const airRate = this.#tendency('airborne');
    const attackRate = this.#tendency('attacking');

    const turtle = blockRate - READ_PRIORS.blocking;
    const pressure = attackRate - READ_PRIORS.attacking;
    const flighty = airRate - READ_PRIORS.airborne;

    this.live = {
      ...base,
      // Turtles get pressured (chip adds up); players who never threaten get
      // pushed on. A low block rate is never a reason to *back off*.
      aggression: clamp(base.aggression + Math.max(0, turtle) * 1.1 - pressure * 0.5, 0.08, 0.9),
      // Players who throw lots of moves get guarded against.
      blockChance: clamp(base.blockChance + pressure * 0.7, 0.05, 0.85),
      punishChance: clamp(base.punishChance + pressure * 0.5, 0.05, 0.9),
      // Jumpers are given space, then punished on the way down.
      spacing: clamp(base.spacing + flighty * 900, 320, 720),
      attackWeights: this.#weights(turtle),
    };
    return this.live;
  }

  /** Shifts the move mix towards the heavy when the player blocks a lot. */
  #weights(turtle) {
    const base = this.profile.attackWeights;
    const shift = clamp(turtle * 1.6, -0.25, 0.4);
    const next = {
      punch: clamp(base.punch - shift * 0.8, 0.1, 0.8),
      headbutt: clamp(base.headbutt + shift * 0.2, 0.12, 0.6),
      stomp: clamp(base.stomp + shift * 0.6, 0.04, 0.7),
    };
    const total = next.punch + next.headbutt + next.stomp;
    next.punch /= total;
    next.headbutt /= total;
    next.stomp /= total;
    return next;
  }

  #choosePlan(distance) {
    const profile = this.#adapt();
    const { fighter, opponent } = this;
    const spacing = profile.spacing;

    // Still catching its breath: hold position instead of swinging.
    if (this.attackCooldown > 0) {
      this.plan = distance < spacing - 160 ? 'retreat' : 'wait';
      this.planTimer = this.attackCooldown;
      return;
    }

    if (fighter.healthRatio < profile.retreatHealth && chance(0.45)) {
      this.plan = 'retreat';
    } else if (opponent.isRecovering && distance < 520 && chance(profile.punishChance)) {
      this.plan = 'attack';
      this.pendingAttack = weightedPick(profile.attackWeights) ?? 'punch';
      this.attackGrace = 1200;
    } else if (opponent.isDown) {
      this.plan = 'wait';
    } else if (distance > spacing + 140) {
      this.plan = 'approach';
    } else if (distance < spacing - 130) {
      this.plan = chance(0.5) ? 'retreat' : 'attack';
      if (this.plan === 'attack') {
        this.pendingAttack = weightedPick(profile.attackWeights) ?? 'punch';
        this.attackGrace = 1200;
      }
    } else if (chance(profile.aggression)) {
      this.plan = 'attack';
      this.pendingAttack = weightedPick(profile.attackWeights) ?? 'punch';
      this.attackGrace = 1200;
    } else if (chance(profile.jumpChance)) {
      this.plan = 'jump';
    } else {
      this.plan = chance(0.5) ? 'wait' : 'retreat';
    }

    this.planTimer = profile.reaction + randFloat(0, profile.decisionJitter);
  }

  update(dt) {
    const { fighter, opponent } = this;
    if (!fighter || !opponent) return;
    this.#observe(dt);
    const profile = this.live;

    if (fighter.isKO || fighter.isDown || fighter.isStunned) {
      fighter.intent = { ...IDLE_INTENT };
      return;
    }

    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const distance = Math.abs(opponent.x - fighter.x);

    // 1. Committed block (reacting to a telegraphed attack).
    if (this.blockTimer > 0) {
      this.blockTimer -= dt;
      fighter.intent = { moveX: 0, jump: false, block: true, attack: null };
      return;
    }

    // 2. Reactive guard.
    if (this.reactionTimer > 0) this.reactionTimer = Math.max(0, this.reactionTimer - dt);
    if (
      opponent.isAttacking &&
      distance < 560 &&
      this.reactionTimer === 0 &&
      chance(profile.blockChance)
    ) {
      this.blockTimer = randFloat(240, 520);
      this.reactionTimer = profile.reaction;
      fighter.intent = { moveX: 0, jump: false, block: true, attack: null };
      return;
    }

    // 3. Combo follow-up: chain another attack if the last one connected.
    if (
      fighter.attack?.hasHit &&
      !this.comboQueued &&
      this.attackCooldown === 0 &&
      chance(profile.comboChance)
    ) {
      this.pendingAttack = weightedPick(profile.attackWeights) ?? 'punch';
      this.attackGrace = 900;
      this.comboQueued = true;
    }
    if (!fighter.attack) this.comboQueued = false;

    // 4. Execute a queued attack as soon as we are able and in range.
    if (this.pendingAttack) {
      this.attackGrace -= dt;
      const reach = (ATTACKS[this.pendingAttack]?.reach ?? 320) + 120;
      if (fighter.canAct && distance <= reach) {
        fighter.intent = { ...IDLE_INTENT, attack: this.pendingAttack };
        this.pendingAttack = null;
        this.attackGrace = 0;
        this.attackCooldown = profile.attackCooldown;
        this.plan = 'wait';
        this.planTimer = Math.max(profile.reaction * 0.6, profile.attackCooldown);
        return;
      }
      if (this.attackGrace <= 0) this.pendingAttack = null;
    }

    // 5. Pick a new plan when the current one expires.
    this.planTimer -= dt;
    if (this.planTimer <= 0) this.#choosePlan(distance);

    // 6. Run the plan.
    const towards = this.#towards();
    switch (this.plan) {
      case 'approach':
        fighter.intent = { ...IDLE_INTENT, moveX: towards };
        break;
      case 'retreat':
        fighter.intent = { ...IDLE_INTENT, moveX: -towards };
        break;
      case 'jump':
        fighter.intent = { ...IDLE_INTENT, jump: true, moveX: towards };
        this.plan = 'approach';
        this.planTimer = profile.reaction;
        break;
      case 'attack': {
        if (!this.pendingAttack) {
          this.pendingAttack = weightedPick(profile.attackWeights) ?? 'punch';
          this.attackGrace = 1200;
        }
        // Close the gap until the queued move can actually reach.
        const ideal = (ATTACKS[this.pendingAttack]?.reach ?? 320) + 40;
        fighter.intent = { ...IDLE_INTENT, moveX: distance > ideal ? towards : 0 };
        break;
      }
      case 'wait':
      default:
        fighter.intent = { ...IDLE_INTENT };
        break;
    }
  }
}
