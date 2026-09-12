/**
 * AI behaviour tests.
 *
 * `AiController` deliberately has no Phaser dependency (it only reads balance
 * data and writes an `intent` object), so it can be driven with two plain
 * objects — no headless browser needed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AiController } from '../../src/entities/AiController.js';
import { AI_PROFILES } from '../../src/config/balance.js';

/** Minimal stand-in for a `Fighter`. */
function makeFighter(x) {
  return {
    x,
    hp: 100,
    maxHealth: 100,
    healthRatio: 1,
    airborneHeight: 0,
    isBlocking: false,
    isAttacking: false,
    isRecovering: false,
    isKO: false,
    isDown: false,
    isStunned: false,
    canAct: true,
    attack: null,
    intent: {},
  };
}

/**
 * Runs the brain for `ms` milliseconds of simulated time, applying `behaviour`
 * to the opponent on every step (so the AI "sees" a player who always blocks,
 * always attacks, …).
 */
function simulate(controller, fighter, opponent, ms, behaviour = () => {}) {
  const step = 50;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    behaviour(opponent, elapsed);
    controller.update(step);
    fighter.intent = fighter.intent ?? {};
  }
}

const setup = (difficulty = 'normal') => {
  const fighter = makeFighter(700);
  const opponent = makeFighter(1100);
  const controller = new AiController(fighter, opponent, { difficulty });
  controller.reset();
  return { fighter, opponent, controller };
};

test('AI uses the difficulty profile it was given', () => {
  assert.equal(
    new AiController(makeFighter(0), makeFighter(1), { difficulty: 'easy' }).profile,
    AI_PROFILES.easy,
  );
  assert.equal(
    new AiController(makeFighter(0), makeFighter(1), { difficulty: 'hard' }).profile,
    AI_PROFILES.hard,
  );
  // Unknown difficulties fall back to normal rather than exploding.
  assert.equal(new AiController(makeFighter(0), makeFighter(1), {}).profile, AI_PROFILES.normal);
});

test('difficulty profiles stay ordered', () => {
  const { easy, normal, hard } = AI_PROFILES;
  assert.ok(easy.reaction > normal.reaction && normal.reaction > hard.reaction);
  assert.ok(easy.aggression < normal.aggression && normal.aggression < hard.aggression);
  assert.ok(
    easy.attackCooldown > normal.attackCooldown && normal.attackCooldown > hard.attackCooldown,
  );
});

test('adaptation never breaks the tuning bounds', () => {
  const { controller, fighter, opponent } = setup('hard');
  simulate(controller, fighter, opponent, 30000, (o) => {
    o.isBlocking = true;
    o.isAttacking = true;
    o.airborneHeight = 200;
  });

  const live = controller.live;
  assert.ok(live.aggression >= 0.08 && live.aggression <= 0.9, 'aggression is clamped');
  assert.ok(live.blockChance >= 0.05 && live.blockChance <= 0.85, 'block chance is clamped');
  assert.ok(live.punishChance >= 0.05 && live.punishChance <= 0.9, 'punish chance is clamped');
  assert.ok(live.spacing >= 320 && live.spacing <= 720, 'spacing is clamped');

  const weights = live.attackWeights;
  const total = weights.punch + weights.headbutt + weights.stomp;
  assert.ok(Math.abs(total - 1) < 1e-9, 'adapted weights still sum to 1');
  assert.ok(
    weights.punch > 0 && weights.headbutt > 0 && weights.stomp > 0,
    'no move becomes impossible',
  );
});

test('a turtling player gets pressured with heavier moves', () => {
  const { controller, fighter, opponent } = setup('normal');
  const base = AI_PROFILES.normal;

  simulate(controller, fighter, opponent, 30000, (o) => {
    o.isBlocking = true;
    o.isAttacking = false;
    o.airborneHeight = 0;
  });

  assert.ok(
    controller.live.aggression > base.aggression,
    'the AI attacks more when the player only blocks',
  );
  assert.ok(
    controller.live.attackWeights.stomp > base.attackWeights.stomp,
    'the AI favours the heavy (most chip) against a turtle',
  );
});

test('an aggressive player gets guarded against', () => {
  const { controller, fighter, opponent } = setup('normal');
  const base = AI_PROFILES.normal;

  simulate(controller, fighter, opponent, 30000, (o) => {
    o.isBlocking = false;
    o.isAttacking = true;
    o.airborneHeight = 0;
  });

  assert.ok(controller.live.blockChance > base.blockChance, 'the AI blocks more against pressure');
  assert.ok(
    controller.live.punishChance > base.punishChance,
    'the AI punishes more against pressure',
  );
});

test('a jumper is given more space', () => {
  const { controller, fighter, opponent } = setup('normal');
  const base = AI_PROFILES.normal;

  simulate(controller, fighter, opponent, 30000, (o) => {
    o.isBlocking = false;
    o.isAttacking = false;
    o.airborneHeight = 220;
  });

  assert.ok(controller.live.spacing > base.spacing, 'the AI backs off to catch landings');
});

test('adaptation preserves the difficulty ordering', () => {
  const reads = (difficulty) => {
    const { controller, fighter, opponent } = setup(difficulty);
    simulate(controller, fighter, opponent, 30000, (o) => {
      o.isBlocking = true;
      o.isAttacking = true;
      o.airborneHeight = 0;
    });
    return controller.live;
  };

  const easy = reads('easy');
  const normal = reads('normal');
  const hard = reads('hard');

  assert.ok(easy.aggression < normal.aggression, 'easy stays less aggressive than normal');
  assert.ok(normal.aggression < hard.aggression, 'normal stays less aggressive than hard');
  assert.ok(easy.blockChance < hard.blockChance, 'easy still blocks less than hard');
});

test('the AI never writes an intent while it is out of action', () => {
  const { controller, fighter, opponent } = setup('hard');
  fighter.isKO = true;
  fighter.intent = { moveX: 1, jump: true, block: true, attack: 'stomp' };

  controller.update(16);

  assert.deepEqual(fighter.intent, { moveX: 0, jump: false, block: false, attack: null });
  assert.equal(opponent.intent.attack, undefined);
});
