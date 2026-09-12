import { settings } from '../core/Settings.js';
import { bus } from '../core/EventBus.js';
import { EVENTS } from '../config/constants.js';
import { MusicEngine } from './Music.js';
import { SFX } from './sfx.js';
import { createNoiseBuffer } from './synth.js';

/**
 * High level audio facade used by the rest of the game.
 *
 * Browsers block audio until the user interacts with the page, so the context
 * is created lazily inside `unlock()` which is wired to the first
 * pointer/key/touch event by `main.js`.
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.music = null;
    this.noiseBuffer = null;
    this.throttle = new Map();
    this.failed = false;

    bus.on(EVENTS.SETTINGS_CHANGED, () => this.applyVolumes());
  }

  get enabled() {
    return !this.failed && !settings.get('muted');
  }

  /** Creates / resumes the audio context. Safe to call on every gesture. */
  unlock() {
    if (this.failed) return false;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return false;
        }
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.master);
        this.musicGain.connect(this.master);

        this.noiseBuffer = createNoiseBuffer(this.ctx, 1.5);
        this.music = new MusicEngine(this.ctx, this.musicGain, this.noiseBuffer);
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch (error) {
      console.warn('[audio] unavailable:', error);
      this.failed = true;
      return false;
    }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sfxGain.gain.setTargetAtTime(settings.sfxVolume, now, 0.02);
    this.musicGain.gain.setTargetAtTime(settings.musicVolume, now, 0.06);
  }

  /**
   * Plays a named sound effect.
   * @param {string} name one of the keys in `sfx.js`
   * @param {{volume?:number, combo?:number, throttleMs?:number}} options
   */
  play(name, options = {}) {
    if (!this.enabled) return false;
    if (!this.unlock()) return false;

    const definition = SFX[name];
    if (!definition) {
      console.warn(`[audio] unknown sfx "${name}"`);
      return false;
    }

    const throttleMs = options.throttleMs ?? 20;
    const last = this.throttle.get(name) ?? -Infinity;
    const now = this.ctx.currentTime * 1000;
    if (now - last < throttleMs) return false;
    this.throttle.set(name, now);

    try {
      definition({
        ctx: this.ctx,
        dest: this.sfxGain,
        noise: this.noiseBuffer,
        at: this.ctx.currentTime + 0.001,
        level: options.volume ?? 1,
        combo: options.combo ?? 1,
      });
      return true;
    } catch (error) {
      console.warn(`[audio] failed to play "${name}"`, error);
      return false;
    }
  }

  playMusic(track = 'menu') {
    if (!this.enabled) return;
    if (!this.unlock()) return;
    if (this.music.isPlaying && this.music.track === track) return;
    this.music.start(track);
  }

  stopMusic(fade = 0.8) {
    this.music?.stop(fade);
  }

  duckMusic(level = 0.25) {
    this.music?.duck(level);
  }

  unduckMusic() {
    this.music?.unduck();
  }

  /** Called when the tab loses focus so audio does not play in the background. */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}

export const audio = new AudioManager();
export { SFX } from './sfx.js';
