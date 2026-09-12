/**
 * Low level WebAudio building blocks.
 *
 * The project ships no audio files, so every sound is synthesised at runtime.
 * That keeps the repository tiny, removes a whole class of loading failures
 * and lets SFX be parameterised (pitch rises with the combo counter, …).
 *
 * These helpers are pure scheduling: they create nodes, schedule envelopes and
 * let the browser garbage collect them once they stop.
 */

/** Creates (and caches) a mono white noise buffer. */
export function createNoiseBuffer(ctx, seconds = 1.5) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Simple AD envelope helper. Returns the gain node for further automation. */
export function envelope(
  ctx,
  { at = 0, peak = 1, attack = 0.005, hold = 0, decay = 0.1, sustain = 0 },
) {
  const t = at;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  if (hold > 0) gain.gain.setValueAtTime(Math.max(0.0001, peak), t + attack + hold);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, sustain || 0.0001),
    t + attack + hold + decay,
  );
  return gain;
}

/**
 * Schedules an oscillator tone with an optional pitch glide.
 * @returns {{stop:number, source:OscillatorNode}}
 */
export function tone(ctx, destination, options = {}) {
  const {
    type = 'sine',
    freq = 440,
    freqEnd = null,
    at = 0,
    duration = 0.2,
    peak = 0.3,
    attack = 0.004,
    hold = 0,
    decay = null,
    detune = 0,
    glideShape = 'exp',
  } = options;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.setValueAtTime(detune, at);
  osc.frequency.setValueAtTime(freq, at);
  if (freqEnd !== null && freqEnd !== freq) {
    if (glideShape === 'exp')
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), at + duration);
    else osc.frequency.linearRampToValueAtTime(Math.max(1, freqEnd), at + duration);
  }

  const gain = envelope(ctx, {
    at,
    peak,
    attack,
    hold,
    decay: decay ?? Math.max(0.03, duration - attack - hold),
  });

  osc.connect(gain);
  gain.connect(destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
  return { source: osc, gain, stop: at + duration };
}

/** Schedules a filtered noise burst (impacts, swishes, footsteps). */
export function noise(ctx, destination, buffer, options = {}) {
  const {
    at = 0,
    duration = 0.15,
    peak = 0.3,
    attack = 0.002,
    hold = 0,
    filter = 'lowpass',
    freq = 1200,
    freqEnd = null,
    q = 1,
    playbackRate = 1,
    offset = null,
  } = options;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = playbackRate;

  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, at);
  biquad.Q.value = q;
  if (freqEnd !== null && freqEnd !== freq) {
    biquad.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), at + duration);
  }

  const gain = envelope(ctx, {
    at,
    peak,
    attack,
    hold,
    decay: Math.max(0.03, duration - attack - hold),
  });

  src.connect(biquad);
  biquad.connect(gain);
  gain.connect(destination);

  const startOffset = offset ?? Math.random() * Math.max(0.001, buffer.duration - duration - 0.05);
  src.start(at, startOffset, duration + 0.1);
  src.stop(at + duration + 0.12);
  return { source: src, gain };
}

/** Short distorted “crunch” used for heavy impacts. */
export function crunch(ctx, destination, buffer, options = {}) {
  const { at = 0, duration = 0.22, peak = 0.35, freq = 320, freqEnd = 90 } = options;

  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 3.2);
  }
  shaper.curve = curve;

  const gain = envelope(ctx, { at, peak, attack: 0.003, hold: 0.01, decay: duration });
  shaper.connect(gain);
  gain.connect(destination);

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), at + duration);
  osc.connect(shaper);
  osc.start(at);
  osc.stop(at + duration + 0.05);

  if (buffer) {
    noise(ctx, shaper, buffer, {
      at,
      duration: duration * 0.7,
      peak: peak * 0.5,
      filter: 'bandpass',
      freq: 900,
      freqEnd: 200,
      q: 0.8,
    });
  }
  return { stop: at + duration };
}

/** Tiny helper: converts a semitone offset to a frequency multiplier. */
export const semitone = (n) => Math.pow(2, n / 12);
