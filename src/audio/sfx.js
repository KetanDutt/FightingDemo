import { crunch, noise, semitone, tone } from './synth.js';

/**
 * The sound library.
 *
 * Every entry receives `{ ctx, dest, noise, at, level }` and schedules its
 * nodes. Keep them short — these play dozens of times per round.
 */
export const SFX = {
  /* ------------------------------- UI ---------------------------------- */

  uiHover: ({ ctx, dest, at, level }) => {
    tone(ctx, dest, {
      type: 'sine',
      freq: 760,
      at,
      duration: 0.07,
      peak: 0.1 * level,
      decay: 0.06,
    });
  },

  uiClick: ({ ctx, dest, at, level }) => {
    tone(ctx, dest, {
      type: 'square',
      freq: 420,
      freqEnd: 780,
      at,
      duration: 0.09,
      peak: 0.16 * level,
    });
    tone(ctx, dest, { type: 'sine', freq: 1180, at: at + 0.02, duration: 0.08, peak: 0.1 * level });
  },

  uiBack: ({ ctx, dest, at, level }) => {
    tone(ctx, dest, {
      type: 'triangle',
      freq: 520,
      freqEnd: 240,
      at,
      duration: 0.14,
      peak: 0.16 * level,
    });
  },

  uiConfirm: ({ ctx, dest, at, level }) => {
    [523.25, 659.25, 783.99].forEach((freq, index) => {
      tone(ctx, dest, {
        type: 'triangle',
        freq,
        at: at + index * 0.06,
        duration: 0.16,
        peak: 0.15 * level,
      });
    });
  },

  uiDenied: ({ ctx, dest, at, level }) => {
    tone(ctx, dest, {
      type: 'square',
      freq: 200,
      freqEnd: 130,
      at,
      duration: 0.16,
      peak: 0.13 * level,
    });
  },

  /* ------------------------------ Swings ------------------------------- */

  swingLight: ({ ctx, dest, noise: buffer, at, level }) => {
    noise(ctx, dest, buffer, {
      at,
      duration: 0.13,
      peak: 0.24 * level,
      filter: 'bandpass',
      freq: 900,
      freqEnd: 3200,
      q: 1.4,
    });
  },

  swingMedium: ({ ctx, dest, noise: buffer, at, level }) => {
    noise(ctx, dest, buffer, {
      at,
      duration: 0.18,
      peak: 0.26 * level,
      filter: 'bandpass',
      freq: 600,
      freqEnd: 2400,
      q: 1.2,
    });
    tone(ctx, dest, {
      type: 'sine',
      freq: 260,
      freqEnd: 150,
      at,
      duration: 0.14,
      peak: 0.1 * level,
    });
  },

  swingHeavy: ({ ctx, dest, noise: buffer, at, level }) => {
    noise(ctx, dest, buffer, {
      at,
      duration: 0.28,
      peak: 0.3 * level,
      filter: 'bandpass',
      freq: 380,
      freqEnd: 1800,
      q: 1,
    });
    tone(ctx, dest, {
      type: 'sine',
      freq: 180,
      freqEnd: 90,
      at: at + 0.02,
      duration: 0.24,
      peak: 0.14 * level,
    });
  },

  /* ------------------------------- Hits -------------------------------- */

  hitLight: ({ ctx, dest, noise: buffer, at, level }) => {
    noise(ctx, dest, buffer, {
      at,
      duration: 0.1,
      peak: 0.3 * level,
      filter: 'lowpass',
      freq: 2600,
      freqEnd: 700,
    });
    tone(ctx, dest, {
      type: 'sine',
      freq: 220,
      freqEnd: 90,
      at,
      duration: 0.13,
      peak: 0.3 * level,
    });
  },

  hitMedium: ({ ctx, dest, noise: buffer, at, level }) => {
    noise(ctx, dest, buffer, {
      at,
      duration: 0.14,
      peak: 0.32 * level,
      filter: 'lowpass',
      freq: 2200,
      freqEnd: 500,
    });
    tone(ctx, dest, {
      type: 'sine',
      freq: 180,
      freqEnd: 70,
      at,
      duration: 0.18,
      peak: 0.34 * level,
    });
    tone(ctx, dest, {
      type: 'triangle',
      freq: 420,
      freqEnd: 240,
      at,
      duration: 0.1,
      peak: 0.14 * level,
    });
  },

  hitHeavy: ({ ctx, dest, noise: buffer, at, level }) => {
    crunch(ctx, dest, buffer, { at, duration: 0.26, peak: 0.34 * level, freq: 340, freqEnd: 80 });
    tone(ctx, dest, { type: 'sine', freq: 120, freqEnd: 45, at, duration: 0.3, peak: 0.4 * level });
  },

  block: ({ ctx, dest, noise: buffer, at, level }) => {
    [1180, 1760].forEach((freq, index) => {
      tone(ctx, dest, {
        type: 'triangle',
        freq,
        freqEnd: freq * 0.8,
        at: at + index * 0.008,
        duration: 0.16,
        peak: 0.13 * level,
      });
    });
    noise(ctx, dest, buffer, {
      at,
      duration: 0.1,
      peak: 0.2 * level,
      filter: 'highpass',
      freq: 2200,
      freqEnd: 4200,
    });
  },

  /* ----------------------------- Movement ------------------------------ */

  jump: ({ ctx, dest, at, level }) => {
    tone(ctx, dest, {
      type: 'sine',
      freq: 300,
      freqEnd: 680,
      at,
      duration: 0.19,
      peak: 0.16 * level,
    });
  },

  land: ({ ctx, dest, noise: buffer, at, level }) => {
    tone(ctx, dest, {
      type: 'sine',
      freq: 170,
      freqEnd: 60,
      at,
      duration: 0.18,
      peak: 0.24 * level,
    });
    noise(ctx, dest, buffer, {
      at,
      duration: 0.14,
      peak: 0.18 * level,
      filter: 'lowpass',
      freq: 900,
      freqEnd: 260,
    });
  },

  step: ({ ctx, dest, noise: buffer, at, level }) => {
    noise(ctx, dest, buffer, {
      at,
      duration: 0.05,
      peak: 0.07 * level,
      filter: 'lowpass',
      freq: 700,
    });
  },

  whoosh: ({ ctx, dest, noise: buffer, at, level }) => {
    noise(ctx, dest, buffer, {
      at,
      duration: 0.36,
      peak: 0.2 * level,
      filter: 'bandpass',
      freq: 300,
      freqEnd: 2600,
      q: 0.9,
    });
  },

  /* ------------------------------ Round -------------------------------- */

  countdown: ({ ctx, dest, at, level }) => {
    tone(ctx, dest, { type: 'square', freq: 880, at, duration: 0.14, peak: 0.16 * level });
  },

  roundStart: ({ ctx, dest, at, level }) => {
    [523.25, 783.99].forEach((freq, index) => {
      tone(ctx, dest, {
        type: 'triangle',
        freq,
        at: at + index * 0.1,
        duration: 0.28,
        peak: 0.18 * level,
      });
    });
  },

  fight: ({ ctx, dest, noise: buffer, at, level }) => {
    [659.25, 987.77, 1318.5].forEach((freq, index) => {
      tone(ctx, dest, {
        type: 'sawtooth',
        freq,
        at: at + index * 0.05,
        duration: 0.32,
        peak: 0.16 * level,
      });
    });
    noise(ctx, dest, buffer, {
      at,
      duration: 0.3,
      peak: 0.14 * level,
      filter: 'highpass',
      freq: 1800,
    });
  },

  ko: ({ ctx, dest, noise: buffer, at, level }) => {
    tone(ctx, dest, {
      type: 'sawtooth',
      freq: 340,
      freqEnd: 55,
      at,
      duration: 0.8,
      peak: 0.24 * level,
    });
    tone(ctx, dest, {
      type: 'sine',
      freq: 160,
      freqEnd: 40,
      at: at + 0.05,
      duration: 0.9,
      peak: 0.3 * level,
    });
    noise(ctx, dest, buffer, {
      at,
      duration: 0.6,
      peak: 0.2 * level,
      filter: 'lowpass',
      freq: 1600,
      freqEnd: 200,
    });
  },

  roundWin: ({ ctx, dest, at, level }) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      tone(ctx, dest, {
        type: 'triangle',
        freq,
        at: at + index * 0.09,
        duration: 0.24,
        peak: 0.17 * level,
      });
    });
  },

  matchWin: ({ ctx, dest, at, level }) => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, index) => {
      tone(ctx, dest, {
        type: 'triangle',
        freq,
        at: at + index * 0.11,
        duration: 0.3,
        peak: 0.18 * level,
      });
    });
    [261.63, 329.63, 392.0].forEach((freq) => {
      tone(ctx, dest, { type: 'sine', freq, at: at + 0.6, duration: 0.9, peak: 0.14 * level });
    });
  },

  matchLose: ({ ctx, dest, at, level }) => {
    [440, 392, 329.63, 261.63].forEach((freq, index) => {
      tone(ctx, dest, {
        type: 'triangle',
        freq,
        at: at + index * 0.16,
        duration: 0.4,
        peak: 0.16 * level,
      });
    });
  },

  /** Pitch rises with the combo count: pass `{ combo: n }`. */
  combo: ({ ctx, dest, at, level, combo = 1 }) => {
    const step = Math.min(combo - 1, 10);
    const freq = 620 * semitone(step * 2);
    tone(ctx, dest, { type: 'triangle', freq, at, duration: 0.12, peak: 0.12 * level });
    tone(ctx, dest, {
      type: 'sine',
      freq: freq * 1.5,
      at: at + 0.03,
      duration: 0.1,
      peak: 0.08 * level,
    });
  },

  fanfare: ({ ctx, dest, at, level }) => {
    [392, 523.25, 659.25, 783.99].forEach((freq, index) => {
      tone(ctx, dest, {
        type: 'sawtooth',
        freq,
        at: at + index * 0.08,
        duration: 0.5,
        peak: 0.1 * level,
      });
    });
  },
};

export const SFX_NAMES = Object.keys(SFX);
