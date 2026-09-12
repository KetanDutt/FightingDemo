/** Small, allocation-free maths helpers shared by gameplay systems. */

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

export const clamp01 = (value) => clamp(value, 0, 1);

export const lerp = (a, b, t) => a + (b - a) * t;

export const inverseLerp = (a, b, value) => (b === a ? 0 : clamp01((value - a) / (b - a)));

export const roundTo = (value, step) => Math.round(value / step) * step;

export const randFloat = (min = 0, max = 1) => min + Math.random() * (max - min);

export const randInt = (min, max) => Math.floor(randFloat(min, max + 1));

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const chance = (probability) => Math.random() < probability;

/** Returns a random sign. */
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);

/** Moves `current` towards `target` by at most `maxDelta`. */
export function approach(current, target, maxDelta) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

/** Deterministic PRNG (mulberry32) — keeps procedural art stable between runs. */
export function createRandom(seed = 0x9e3779b9) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a key from an object of `{ key: weight }` pairs. */
export function weightedPick(weights, random = Math.random) {
  const entries = Object.entries(weights ?? {}).filter(([, weight]) => weight > 0);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** Compares two strings numerically ("monkey_002" < "monkey_010"). */
export function naturalCompare(a, b) {
  const pattern = /(\d+)/g;
  const left = String(a).split(pattern);
  const right = String(b).split(pattern);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const l = left[i];
    const r = right[i];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    const lNum = Number(l);
    const rNum = Number(r);
    const bothNumeric = !Number.isNaN(lNum) && !Number.isNaN(rNum) && i % 2 === 1;
    if (bothNumeric) {
      if (lNum !== rNum) return lNum - rNum;
    } else if (l !== r) {
      return l < r ? -1 : 1;
    }
  }
  return 0;
}

/** Formats milliseconds as `m:ss`. */
/** "63%" — how many of the player's attacks actually connected. */
export function formatAccuracy(landed = 0, thrown = 0) {
  if (!thrown) return '—';
  return `${Math.round((Math.min(landed, thrown) / thrown) * 100)}%`;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
