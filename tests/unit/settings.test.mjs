/**
 * Settings default tests.
 *
 * `Settings.js` pulls in the event bus (Phaser), so these boot the same
 * headless DOM environment the smoke test uses before importing the module.
 * Storage falls back to its in-memory map inside jsdom, so defaults are
 * asserted against a pristine profile.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessEnvironment } from '../helpers/headless.mjs';

await createHeadlessEnvironment();

const { DEFAULT_SETTINGS, settings } = await import('../../src/core/Settings.js');
const { AI_PROFILES, ROUND_RULES } = await import('../../src/config/balance.js');
const { DIFFICULTY } = await import('../../src/config/constants.js');

test('fighter menu defaults: Challenger skill, first to 3 rounds', () => {
  assert.equal(DEFAULT_SETTINGS.difficulty, DIFFICULTY.NORMAL, 'default difficulty is Challenger');
  assert.equal(DEFAULT_SETTINGS.roundCount, 'bo5', 'default round count is FIRST TO 3');
});

test('sanitise restores the new defaults for junk values', () => {
  for (const bad of ['nonsense', 42, null, true]) {
    const next = settings.set({ difficulty: bad, roundCount: bad });
    assert.equal(next.difficulty, 'normal', `difficulty ${String(bad)} → normal`);
    assert.equal(next.roundCount, 'bo5', `roundCount ${String(bad)} → bo5`);
  }
});

test('default selector resolves to the FIRST TO 3 rules', () => {
  const rules = ROUND_RULES.forSelector(DEFAULT_SETTINGS.roundCount);
  assert.equal(rules.id, 'bo5');
  assert.equal(rules.roundsToWin, 3);
  assert.equal(rules.maxRounds, 5);
  // Missing/unknown selectors fall back to the same default option.
  assert.equal(ROUND_RULES.forSelector(undefined).id, 'bo5');
  assert.equal(ROUND_RULES.forSelector('nope').id, 'bo5');
});

test('buffed AI profiles stay strictly difficulty ordered', () => {
  const { easy, normal, hard } = AI_PROFILES;
  // Time knobs: higher = slower/easier, so they must *shrink* with skill.
  const shrink = ['reaction', 'decisionJitter', 'attackCooldown'];
  shrink.forEach((knob) => {
    assert.ok(easy[knob] > normal[knob], `easy.${knob} > normal.${knob}`);
    assert.ok(normal[knob] > hard[knob], `normal.${knob} > hard.${knob}`);
  });
  // Every other numeric knob grows with difficulty…
  const grow = [
    'aggression',
    'blockChance',
    'punishChance',
    'comboChance',
    'jumpChance',
    'retreatHealth',
  ];
  grow.forEach((knob) => {
    assert.ok(easy[knob] < normal[knob], `easy.${knob} < normal.${knob}`);
    assert.ok(normal[knob] < hard[knob], `normal.${knob} < hard.${knob}`);
  });
  // …while preferred spacing shrinks (the AI closes in as it gets smarter).
  assert.ok(easy.spacing > normal.spacing && normal.spacing > hard.spacing);
  Object.values(AI_PROFILES).forEach((profile) => {
    const total = Object.values(profile.attackWeights).reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-6, `${profile.label} attack weights sum to 1`);
  });
});
