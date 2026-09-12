import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  approach,
  clamp,
  clamp01,
  createRandom,
  formatAccuracy,
  formatClock,
  inverseLerp,
  lerp,
  naturalCompare,
  pick,
  randInt,
  weightedPick,
} from '../../src/utils/math.js';

test('clamp keeps values inside the range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
  assert.equal(clamp01(0.5), 0.5);
  assert.equal(clamp01(2), 1);
});

test('lerp / inverseLerp round trip', () => {
  assert.equal(lerp(0, 10, 0.25), 2.5);
  assert.equal(inverseLerp(0, 10, 2.5), 0.25);
  assert.equal(inverseLerp(5, 5, 5), 0, 'guards against divide by zero');
});

test('approach moves at most maxDelta', () => {
  assert.equal(approach(0, 10, 3), 3);
  assert.equal(approach(0, 2, 3), 2);
  assert.equal(approach(0, -10, 3), -3);
});

test('randInt stays inside the inclusive range', () => {
  for (let i = 0; i < 200; i += 1) {
    const value = randInt(1, 6);
    assert.ok(value >= 1 && value <= 6, `${value} out of range`);
    assert.equal(value, Math.floor(value));
  }
  assert.ok(pick(['a', 'b', 'c']).length === 1);
});

test('naturalCompare orders numbered frames the way an artist expects', () => {
  const names = [
    'Idol_png_0034.png',
    'Idol_png_0001.png',
    'Idol_png_0003.png',
    'Idol_png_0002.png',
  ];
  assert.deepEqual(names.sort(naturalCompare), [
    'Idol_png_0001.png',
    'Idol_png_0002.png',
    'Idol_png_0003.png',
    'Idol_png_0034.png',
  ]);
});

test('weightedPick respects weights and tolerates empty maps', () => {
  assert.equal(weightedPick({ a: 0, b: 1 }), 'b');
  assert.equal(weightedPick({}), null);
  const random = createRandom(42);
  const counts = { light: 0, heavy: 0 };
  for (let i = 0; i < 500; i += 1) {
    const key = weightedPick({ light: 9, heavy: 1 }, random);
    counts[key] += 1;
  }
  assert.ok(counts.light > counts.heavy, 'the heavier weight should win most of the time');
});

test('createRandom is deterministic for the same seed', () => {
  const a = createRandom(1234);
  const b = createRandom(1234);
  for (let i = 0; i < 10; i += 1) {
    assert.equal(a(), b());
  }
  assert.notEqual(createRandom(1)(), createRandom(2)());
});

test('formatClock renders mm:ss', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(59_000), '0:59');
  assert.equal(formatClock(60_000), '1:00');
  assert.equal(formatClock(-100), '0:00');
});

test('formatAccuracy reports a percentage, or a dash with no data', () => {
  assert.equal(formatAccuracy(0, 0), '—');
  assert.equal(formatAccuracy(3, 0), '—');
  assert.equal(formatAccuracy(7, 10), '70%');
  assert.equal(formatAccuracy(2, 3), '67%');
  assert.equal(formatAccuracy(1, 1), '100%');
  // Never above 100% even if the counters disagree.
  assert.equal(formatAccuracy(12, 10), '100%');
});
