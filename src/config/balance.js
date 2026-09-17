/**
 * Gameplay tuning.
 *
 * Everything a designer would want to twiddle lives here: fighter physics,
 * attack frame data, AI behaviour and round rules. Distances are in design
 * pixels (1920x1080); times are in milliseconds.
 *
 * Frame data follows fighting game convention:
 *   startup  -> time before the hitbox becomes active
 *   active   -> time the hitbox can connect
 *   recovery -> time before the attacker can act again
 */

export const FIGHTER_STATS = {
  maxHealth: 100,
  /** Walking towards the opponent (px/s). */
  walkForwardSpeed: 330,
  /** Walking away from the opponent (px/s). */
  walkBackSpeed: 250,
  /** Baked-into-art jump animation length (ms). */
  jumpDuration: 780,
  /** Extra time stuck on landing after a jump (ms). */
  landRecovery: 130,
  /** Time spent lying on the floor after a knock down (ms). */
  downDuration: 900,
  /** Fraction of the idle body used as the hurt box. */
  hurtbox: { widthScale: 0.7, heightScale: 0.94 },
  /** Height (px above the feet) above which an attack whiffs. */
  airborneDodgeHeight: 90,
  /** Push apart when fighters overlap. */
  pushSpeed: 220,
};

/**
 * Attacks. `reach` is the distance from the fighter centre to the centre of
 * the hit box, `halfWidth` its half size. `band` is the vertical slice
 * (relative to the feet, negative = above) the hit box covers.
 */
export const ATTACKS = {
  punch: {
    key: 'punch',
    label: 'Punch',
    input: 'Light',
    anim: 'punch',
    damage: 7,
    chipDamage: 1,
    startup: 110,
    active: 130,
    recovery: 260,
    reach: 300,
    halfWidth: 155,
    band: { top: -340, bottom: -70 },
    knockback: 60,
    hitstun: 260,
    blockstun: 170,
    lunge: 40,
    shake: 0.004,
    hitStop: 55,
    knockDown: false,
    sfx: { swing: 'swingLight', hit: 'hitLight' },
    vfx: 'spark',
  },
  headbutt: {
    key: 'headbutt',
    label: 'Headbutt',
    input: 'Medium',
    anim: 'head',
    damage: 11,
    chipDamage: 1.5,
    startup: 150,
    active: 140,
    recovery: 250,
    reach: 330,
    halfWidth: 165,
    band: { top: -300, bottom: -30 },
    knockback: 115,
    hitstun: 320,
    blockstun: 200,
    lunge: 90,
    shake: 0.006,
    hitStop: 75,
    knockDown: false,
    sfx: { swing: 'swingMedium', hit: 'hitMedium' },
    vfx: 'spark',
  },
  stomp: {
    key: 'stomp',
    label: 'Stomp',
    input: 'Heavy',
    anim: 'stomp',
    damage: 17,
    chipDamage: 2,
    startup: 210,
    active: 170,
    recovery: 353,
    reach: 360,
    halfWidth: 180,
    band: { top: -250, bottom: 60 },
    knockback: 210,
    hitstun: 460,
    blockstun: 260,
    lunge: 120,
    shake: 0.011,
    hitStop: 110,
    knockDown: true,
    sfx: { swing: 'swingHeavy', hit: 'hitHeavy' },
    vfx: 'heavy',
  },
};

export const ATTACK_ORDER = ['punch', 'headbutt', 'stomp'];

export const BLOCK = {
  /** Pushback applied to the defender on a blocked hit. */
  pushback: 130,
};

export const COMBO = {
  /** A hit lands inside this window to extend the combo (ms). */
  window: 1200,
  /** Damage lost per extra hit in a combo. */
  scalingPerHit: 0.08,
  /** Combo length beyond which scaling stops growing. */
  scalingCap: 6,
  /** Minimum damage fraction after scaling. */
  minScale: 0.4,
};

export const ROUND_RULES = {
  /** Seconds on the clock. */
  time: 60,
  /** Rounds needed to win the match (best of 3). */
  roundsToWin: 2,
  /** Hard cap so a match can never run forever. */
  maxRounds: 3,
  /** Time before the round becomes interactive (ms). */
  introDuration: 2100,
  /** Pause after a KO before the next round (ms). */
  endDuration: 2600,
  /** Slow motion scale + duration used for KOs. */
  koSlowMotion: { scale: 0.25, duration: 1100 },
  /** Selectable round counts ("best of N"): the win target and match cap. */
  roundOptions: [
    { id: 'first', label: 'FIRST TO 1', roundsToWin: 1, maxRounds: 1 },
    { id: 'bo3', label: 'FIRST TO 2', roundsToWin: 2, maxRounds: 3 },
    { id: 'bo5', label: 'FIRST TO 3', roundsToWin: 3, maxRounds: 5 },
  ],
  /** Turn a stored selector ('first'|'bo3'|'bo5') into concrete rules. */
  forSelector: (selector) =>
    ROUND_RULES.roundOptions.find((option) => option.id === selector) ??
    ROUND_RULES.roundOptions[2],
};

export const CAMERA_FX = {
  shakeOnHit: 0.006,
  shakeOnHeavyHit: 0.014,
  shakeOnKo: 0.022,
  zoomPunch: 1.02,
};

/**
 * AI behaviour per difficulty.
 *  - reaction: delay before the AI answers a new situation (ms)
 *  - aggression: chance to attack when in range
 *  - blockChance: chance to block a telegraphed attack
 *  - punishChance: chance to attack a recovering opponent
 *  - spacing: preferred distance to keep (design px)
 *  - attackCooldown: minimum pause between the AI's own attacks (ms). This is
 *    the main "how hard does it hit back" knob.
 *
 * Invariants (asserted by tests/unit/ai.test.mjs and the balance tests):
 * easy.reaction > normal.reaction > hard.reaction, aggression/blockChance
 * strictly ordered, attack weights sum to 1.
 */
export const AI_PROFILES = {
  easy: {
    label: 'Rookie',
    reaction: 740,
    decisionJitter: 340,
    aggression: 0.22,
    blockChance: 0.15,
    punishChance: 0.12,
    comboChance: 0.05,
    spacing: 580,
    attackCooldown: 950,
    retreatHealth: 0.22,
    jumpChance: 0.05,
    attackWeights: { punch: 0.62, headbutt: 0.26, stomp: 0.12 },
  },
  normal: {
    label: 'Challenger',
    reaction: 400,
    decisionJitter: 200,
    aggression: 0.46,
    blockChance: 0.36,
    punishChance: 0.38,
    comboChance: 0.24,
    spacing: 440,
    attackCooldown: 450,
    retreatHealth: 0.24,
    jumpChance: 0.1,
    attackWeights: { punch: 0.46, headbutt: 0.32, stomp: 0.22 },
  },
  hard: {
    label: 'Ape King',
    reaction: 170,
    decisionJitter: 100,
    aggression: 0.84,
    blockChance: 0.58,
    punishChance: 0.7,
    comboChance: 0.56,
    spacing: 330,
    attackCooldown: 150,
    retreatHealth: 0.3,
    jumpChance: 0.16,
    attackWeights: { punch: 0.28, headbutt: 0.36, stomp: 0.36 },
  },
};

export const SCORING = {
  /** Points per point of health left at the end of the match. */
  pointsPerHealth: 10,
  pointsPerRound: 500,
  pointsPerCombo: 25,
  timeBonusPerSecond: 5,
  /** Awarded for finishing the match without taking a scratch. */
  perfectBonus: 750,
  /** Flat bonus for winning the match (the biggest single term on purpose). */
  winBonus: 1000,
};
