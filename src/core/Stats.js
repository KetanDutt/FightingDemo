import { getJSON, setJSON } from './Storage.js';

const STORAGE_KEY = 'stats';

const DEFAULT_STATS = {
  matches: 0,
  wins: 0,
  losses: 0,
  roundsWon: 0,
  knockouts: 0,
  bestCombo: 0,
  totalDamage: 0,
  totalScore: 0,
  bestScore: 0,
  /** Play time in seconds. */
  playTime: 0,
};

function sanitise(raw) {
  const stats = { ...DEFAULT_STATS, ...(raw && typeof raw === 'object' ? raw : {}) };
  Object.keys(DEFAULT_STATS).forEach((key) => {
    const value = Number(stats[key]);
    stats[key] = Number.isFinite(value) && value >= 0 ? value : DEFAULT_STATS[key];
  });
  return stats;
}

class StatsManager {
  constructor() {
    this.values = sanitise(getJSON(STORAGE_KEY, null));
  }

  get(key) {
    return this.values[key];
  }

  add(key, amount = 1) {
    this.values[key] = Math.max(0, (Number(this.values[key]) || 0) + amount);
    return this.values[key];
  }

  bump(key, value) {
    if (Number(value) > Number(this.values[key] || 0)) this.values[key] = Number(value);
    return this.values[key];
  }

  /** Records the outcome of a completed match and returns the updated stats. */
  recordMatch({
    won,
    roundsWon = 0,
    knockouts = 0,
    bestCombo = 0,
    damage = 0,
    score = 0,
    playTime = 0,
  }) {
    this.add('matches', 1);
    if (won) this.add('wins', 1);
    else this.add('losses', 1);
    this.add('roundsWon', roundsWon);
    this.add('knockouts', knockouts);
    this.add('totalDamage', Math.round(damage));
    this.add('totalScore', Math.round(score));
    this.add('playTime', Math.round(playTime));
    this.bump('bestCombo', bestCombo);
    this.bump('bestScore', Math.round(score));
    this.save();
    return this.values;
  }

  save() {
    setJSON(STORAGE_KEY, this.values);
  }

  reset() {
    this.values = sanitise(null);
    this.save();
    return this.values;
  }
}

export const stats = new StatsManager();
