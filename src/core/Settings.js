import { EVENTS } from '../config/constants.js';
import { getBool, getJSON, getNumber, setJSON } from './Storage.js';
import { bus } from './EventBus.js';

const STORAGE_KEY = 'settings';

export const DEFAULT_SETTINGS = {
  /** 0..1 */
  masterVolume: 0.8,
  sfxVolume: 0.85,
  musicVolume: 0.45,
  muted: false,
  /** Camera shake intensity multiplier (0 disables shake). */
  screenShake: 1,
  /** Reduces flashing, shaking and particle counts. */
  reducedMotion: false,
  /** Particle quality: 0 = off, 1 = normal, 2 = high. */
  particleQuality: 1,
  difficulty: 'normal',
  /** Force the on-screen controls even on desktop (useful for touch laptops). */
  showTouchControls: false,
  showFps: false,
  lastSkin: 'classic',
};

function sanitise(raw) {
  const settings = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  settings.masterVolume = clamp01(settings.masterVolume);
  settings.sfxVolume = clamp01(settings.sfxVolume);
  settings.musicVolume = clamp01(settings.musicVolume);
  settings.screenShake = Math.min(1, Math.max(0, Number(settings.screenShake) || 0));
  settings.particleQuality = [0, 1, 2].includes(Number(settings.particleQuality))
    ? Number(settings.particleQuality)
    : 1;
  if (!['easy', 'normal', 'hard'].includes(settings.difficulty)) settings.difficulty = 'normal';
  settings.muted = Boolean(settings.muted);
  settings.reducedMotion = Boolean(settings.reducedMotion);
  settings.showTouchControls = Boolean(settings.showTouchControls);
  settings.showFps = Boolean(settings.showFps);
  settings.lastSkin = typeof settings.lastSkin === 'string' ? settings.lastSkin : 'classic';
  return settings;
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

class SettingsManager {
  constructor() {
    this.values = sanitise(getJSON(STORAGE_KEY, null));
  }

  get(key) {
    return this.values[key];
  }

  /** Updates one or more settings, persists them and notifies listeners. */
  set(keyOrPatch, maybeValue) {
    const patch =
      typeof keyOrPatch === 'string' ? { [keyOrPatch]: maybeValue } : (keyOrPatch ?? {});
    const next = sanitise({ ...this.values, ...patch });
    const changed = Object.keys(next).filter((key) => next[key] !== this.values[key]);
    if (changed.length === 0) return this.values;
    this.values = next;
    setJSON(STORAGE_KEY, next);
    bus.emit(EVENTS.SETTINGS_CHANGED, { settings: next, changed });
    return this.values;
  }

  toggle(key) {
    return this.set(key, !this.values[key]);
  }

  /** Effective SFX volume taking mute + master into account. */
  get sfxVolume() {
    return this.values.muted ? 0 : this.values.masterVolume * this.values.sfxVolume;
  }

  get musicVolume() {
    return this.values.muted ? 0 : this.values.masterVolume * this.values.musicVolume;
  }

  get shakingEnabled() {
    return !this.values.reducedMotion && this.values.screenShake > 0;
  }

  reset() {
    this.values = sanitise(null);
    setJSON(STORAGE_KEY, this.values);
    bus.emit(EVENTS.SETTINGS_CHANGED, { settings: this.values, changed: Object.keys(this.values) });
    return this.values;
  }
}

export const settings = new SettingsManager();

// Keep supporting the plain helpers (used by legacy save files / debugging).
export const readSetting = (key) => getNumber(key, getBool(key, DEFAULT_SETTINGS[key]));
