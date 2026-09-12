/**
 * Tiny, defensive wrapper around `localStorage`.
 *
 * Browsers throw when storage is disabled (private mode, embedded webviews,
 * disabled cookies), so every call falls back to an in-memory map instead of
 * crashing the game.
 */

const PREFIX = 'monkey-mayhem:v1:';

const memory = new Map();
let available = null;

function probe() {
  try {
    const probeKey = `${PREFIX}__probe__`;
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function isAvailable() {
  if (available === null) {
    available = probe();
  }
  return available;
}

export function getRaw(key) {
  if (isAvailable()) {
    try {
      return window.localStorage.getItem(PREFIX + key);
    } catch {
      /* fall through */
    }
  }
  return memory.has(key) ? memory.get(key) : null;
}

export function setRaw(key, value) {
  memory.set(key, value);
  if (isAvailable()) {
    try {
      window.localStorage.setItem(PREFIX + key, value);
    } catch {
      /* quota or security errors are non fatal */
    }
  }
}

export function removeRaw(key) {
  memory.delete(key);
  if (isAvailable()) {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  }
}

export function getJSON(key, fallback = null) {
  const raw = getRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function setJSON(key, value) {
  try {
    setRaw(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getNumber(key, fallback = 0) {
  const raw = getRaw(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function getBool(key, fallback = false) {
  const raw = getRaw(key);
  if (raw === null) return fallback;
  return raw === 'true' || raw === '1';
}

/** Clears every value owned by this game. */
export function clearAll() {
  memory.clear();
  if (!isAvailable()) return;
  try {
    const doomed = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}
