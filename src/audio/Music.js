import { noise, tone } from './synth.js';

/**
 * Tiny look-ahead step sequencer.
 *
 * Music is generated (no audio files) and scheduled ahead of time so timing
 * does not depend on `setInterval` jitter. Two tracks ship with the game:
 *   - `menu`: slow, airy pad + sparse arpeggio
 *   - `battle`: driving kick/snare/hat + bass + lead
 */

const A_MINOR_PENTATONIC = [220.0, 261.63, 293.66, 329.63, 392.0]; // A3 C4 D4 E4 G4
const BASS = [110.0, 130.81, 146.83, 164.81]; // A2 C3 D3 E3

const TRACKS = {
  menu: {
    bpm: 92,
    steps: 16,
    gain: 0.5,
    kick: [],
    snare: [],
    hat: [],
    bass: [0, 6, 10],
    bassNotes: [0, 2, 1],
    lead: [0, 5, 8, 13],
    leadNotes: [4, 3, 2, 1],
    pad: true,
  },
  battle: {
    bpm: 138,
    steps: 16,
    gain: 0.62,
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    bass: [0, 3, 6, 8, 11, 14],
    bassNotes: [0, 0, 2, 1, 1, 3],
    lead: [0, 2, 4, 7, 9, 12, 14],
    leadNotes: [4, 3, 2, 3, 4, 1, 2],
    pad: false,
  },
};

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.14;

export class MusicEngine {
  constructor(ctx, destination, noiseBuffer) {
    this.ctx = ctx;
    this.buffer = noiseBuffer;
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);

    this.track = null;
    this.config = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this.fadeTarget = 0;
  }

  get isPlaying() {
    return this.timer !== null;
  }

  start(trackName = 'menu', fade = 1.2) {
    const config = TRACKS[trackName] ?? TRACKS.menu;
    if (this.isPlaying && this.track === trackName) return;

    this.stop(0.35);
    this.track = trackName;
    this.config = config;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.fadeTarget = config.gain;

    // Smooth fade in
    this.output.gain.cancelScheduledValues(this.ctx.currentTime);
    this.output.gain.setValueAtTime(Math.max(0.0001, this.output.gain.value), this.ctx.currentTime);
    this.output.gain.linearRampToValueAtTime(this.fadeTarget, this.ctx.currentTime + fade);

    this.timer = setInterval(() => this.#scheduler(), LOOKAHEAD_MS);
    this.#scheduler();
  }

  stop(fade = 0.8) {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(Math.max(0.0001, this.output.gain.value), now);
    this.output.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
    this.track = null;
  }

  /** Ducks the music (used for KOs and pause). */
  duck(level = 0.25, time = 0.2) {
    if (!this.isPlaying) return;
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.output.gain.linearRampToValueAtTime(Math.max(0.0001, this.fadeTarget * level), now + time);
  }

  unduck(time = 0.4) {
    if (!this.isPlaying) return;
    const now = this.ctx.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.output.gain.linearRampToValueAtTime(this.fadeTarget, now + time);
  }

  #scheduler() {
    if (!this.config || this.ctx.state === 'closed') return;
    const secondsPerStep = 60 / this.config.bpm / 4; // 16th notes
    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this.#scheduleStep(this.step, this.nextNoteTime, secondsPerStep);
      this.nextNoteTime += secondsPerStep;
      this.step = (this.step + 1) % (this.config.steps * 4); // 4 bar loop
    }
  }

  #scheduleStep(step, time, secondsPerStep) {
    const { config, output } = this;
    const index = step % config.steps;
    const bar = Math.floor(step / config.steps);

    if (config.kick.includes(index)) {
      tone(this.ctx, output, {
        type: 'sine',
        freq: 150,
        freqEnd: 45,
        at: time,
        duration: 0.22,
        peak: 0.5,
        attack: 0.002,
      });
    }

    if (config.snare.includes(index)) {
      noise(this.ctx, output, this.buffer, {
        at: time,
        duration: 0.16,
        peak: 0.24,
        filter: 'bandpass',
        freq: 1900,
        q: 0.7,
      });
      tone(this.ctx, output, {
        type: 'triangle',
        freq: 220,
        freqEnd: 150,
        at: time,
        duration: 0.1,
        peak: 0.1,
      });
    }

    if (config.hat.includes(index)) {
      noise(this.ctx, output, this.buffer, {
        at: time,
        duration: 0.05,
        peak: 0.09,
        filter: 'highpass',
        freq: 7000,
      });
    }

    const bassSlot = config.bass.indexOf(index);
    if (bassSlot !== -1) {
      const noteIndex = config.bassNotes[bassSlot % config.bassNotes.length];
      tone(this.ctx, output, {
        type: 'square',
        freq: BASS[noteIndex % BASS.length] * (bar % 2 === 1 && index > 8 ? 1.5 : 1),
        at: time,
        duration: secondsPerStep * 1.6,
        peak: 0.16,
        attack: 0.005,
      });
    }

    const leadSlot = config.lead.indexOf(index);
    if (leadSlot !== -1) {
      const noteIndex = config.leadNotes[leadSlot % config.leadNotes.length];
      const octave = bar % 2 === 1 ? 2 : 1;
      tone(this.ctx, output, {
        type: 'triangle',
        freq: A_MINOR_PENTATONIC[noteIndex % A_MINOR_PENTATONIC.length] * octave,
        at: time,
        duration: secondsPerStep * 1.4,
        peak: 0.1,
        attack: 0.004,
      });
    }

    if (config.pad && index === 0) {
      [220, 261.63, 329.63].forEach((freq) => {
        tone(this.ctx, output, {
          type: 'sine',
          freq,
          at: time,
          duration: secondsPerStep * config.steps * 0.95,
          peak: 0.07,
          attack: 0.4,
          hold: 0.2,
        });
      });
    }
  }
}
