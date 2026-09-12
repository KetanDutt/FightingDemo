import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACKS,
  AI_PROFILES,
  COMBO,
  FIGHTER_STATS,
  ROUND_RULES,
} from '../../src/config/balance.js';
import {
  chipDamage,
  damageScale,
  judgeTimeout,
  scaledDamage,
} from '../../src/systems/combatMath.js';
import { ANIMATION_DATA } from '../../src/data/animations.js';
import { ANIMS } from '../../src/config/constants.js';

test('every attack has sane frame data', () => {
  Object.entries(ATTACKS).forEach(([key, attack]) => {
    assert.equal(attack.key, key, `${key} key matches its map entry`);
    assert.ok(attack.startup > 0, `${key} startup`);
    assert.ok(attack.active > 0, `${key} active`);
    assert.ok(attack.recovery > 0, `${key} recovery`);
    assert.ok(attack.damage > 0, `${key} damage`);
    assert.ok(attack.chipDamage <= attack.damage, `${key} chip is never bigger than the hit`);
    assert.ok(attack.reach > 0 && attack.reach < 600, `${key} reach is playable`);
    assert.ok(attack.band.top < attack.band.bottom, `${key} vertical band`);
    assert.ok(
      ANIMATION_DATA.some((entry) => entry.key === attack.anim),
      `${key} uses a real animation`,
    );
  });
});

test('heavier attacks hit harder and recover slower', () => {
  assert.ok(ATTACKS.punch.damage < ATTACKS.headbutt.damage);
  assert.ok(ATTACKS.headbutt.damage < ATTACKS.stomp.damage);
  assert.ok(ATTACKS.punch.recovery < ATTACKS.stomp.recovery);
  assert.ok(ATTACKS.stomp.knockback > ATTACKS.punch.knockback);
  assert.equal(ATTACKS.stomp.knockDown, true);
});

test('combo damage scaling is bounded', () => {
  assert.equal(damageScale(1), 1);
  assert.ok(damageScale(3) < 1);
  assert.ok(damageScale(50) >= COMBO.minScale, 'never scales below the floor');
  assert.equal(
    damageScale(999),
    1 - COMBO.scalingPerHit * COMBO.scalingCap,
    'scaling stops growing after the cap',
  );
  assert.ok(damageScale(999) >= COMBO.minScale);
  assert.equal(scaledDamage(ATTACKS.punch.damage, 1), ATTACKS.punch.damage);
  assert.ok(scaledDamage(ATTACKS.stomp.damage, 5) < ATTACKS.stomp.damage);
});

test('blocking turns a full hit into chip damage', () => {
  const chip = chipDamage(ATTACKS.stomp);
  assert.ok(chip > 0, 'blocks still take a little damage');
  assert.ok(chip < ATTACKS.stomp.damage * 0.5, 'but far less than a clean hit');
});

test('time outs are judged by remaining health', () => {
  assert.equal(judgeTimeout(0.5, 0.2), 'player');
  assert.equal(judgeTimeout(0.1, 0.4), 'enemy');
  assert.equal(judgeTimeout(0.3, 0.3), 'draw');
});

test('AI profiles get stricter with difficulty', () => {
  const { easy, normal, hard } = AI_PROFILES;
  assert.ok(easy.reaction > normal.reaction && normal.reaction > hard.reaction);
  assert.ok(easy.aggression < hard.aggression);
  assert.ok(easy.blockChance < hard.blockChance);
  Object.values(AI_PROFILES).forEach((profile) => {
    const total = Object.values(profile.attackWeights).reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-6, `${profile.label} attack weights sum to 1`);
  });
});

test('round rules describe a best-of-three match', () => {
  assert.equal(ROUND_RULES.roundsToWin, 2);
  assert.equal(ROUND_RULES.maxRounds, 3);
  assert.ok(ROUND_RULES.time > 0);
  assert.ok(ROUND_RULES.koSlowMotion.scale < 1, 'the KO runs in slow motion');
});

test('fighter stats keep hurt boxes smaller than the art', () => {
  assert.ok(FIGHTER_STATS.hurtbox.widthScale <= 1);
  assert.ok(FIGHTER_STATS.hurtbox.heightScale <= 1);
  assert.ok(FIGHTER_STATS.walkBackSpeed < FIGHTER_STATS.walkForwardSpeed);
  assert.ok(FIGHTER_STATS.airborneDodgeHeight > 0);
});

test('animation metadata covers the whole library', () => {
  const keys = ANIMATION_DATA.map((entry) => entry.key);
  Object.values(ANIMS).forEach((key) => assert.ok(keys.includes(key), `${key} is documented`));
  ANIMATION_DATA.forEach((entry) => {
    assert.ok(entry.label && entry.description, `${entry.key} has gallery text`);
    assert.ok(entry.frameRate >= 12 && entry.frameRate <= 60, `${entry.key} frame rate is sane`);
  });
});
