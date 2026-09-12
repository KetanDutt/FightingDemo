# Audio

There is **not a single audio file in this repository.** All sound is synthesised at runtime with
the WebAudio API. That keeps the game at ~1.3 MB total, removes any codec/licensing question, and
means the mix can respond to gameplay (`combo`, `level`) instead of firing fixed samples.

```
                       ┌──────────────┐
   SFX recipes ───────►│  sfxGain     │──┐
   (src/audio/sfx.js)  └──────────────┘  │
                                         ├──► master ──► destination
   MusicEngine ───────►│  musicGain   │──┘
   (src/audio/Music.js)└──────────────┘
```

`src/audio/index.js` is the only module the game talks to:

```js
import { audio } from '../audio/index.js';
audio.play('hitHeavy', { volume: 1, combo: 3, throttleMs: 40 });
audio.playMusic('battle');
audio.duckMusic(0.2); // big hit / KO
audio.unduckMusic();
audio.suspend(); // tab lost focus
```

---

## 1. The synth primitives

`src/audio/synth.js` — tiny building blocks, each scheduling its own gain envelope and returning
nothing (fire and forget):

| Function                                                      | What it makes                                                           |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `createNoiseBuffer(ctx, seconds)`                             | One shared 1.5 s white-noise buffer, reused by every noise voice        |
| `envelope(ctx, {at, peak, attack, hold, decay, sustain})`     | ADSR-ish gain node                                                      |
| `tone(ctx, dest, {type, freq, freqEnd, at, duration, peak})`  | Oscillator with optional pitch sweep (`sine`/`square`/`triangle`/`saw`) |
| `noise(ctx, dest, buffer, {filter, freq, q, duration, peak})` | Filtered noise burst — impacts, dust, hats, snares                      |
| `crunch(ctx, dest, buffer, {…})`                              | Distorted low noise — the body of a heavy hit                           |
| `semitone(base, steps)`                                       | Pitch helper used for combo risers                                      |

Every recipe builds 2–6 nodes per hit and lets them fall out of scope; nothing is pooled, so
there is no long-lived node graph to leak.

---

## 2. The sound library

`src/audio/sfx.js` — 25 named recipes. Naming is deliberately gameplay-first:

| Group           | Sounds                                                  |
| --------------- | ------------------------------------------------------- |
| UI              | `uiHover`, `uiClick`, `uiBack`, `uiConfirm`, `uiDenied` |
| Swings (whiffs) | `swingLight`, `swingMedium`, `swingHeavy`               |
| Impacts         | `hitLight`, `hitMedium`, `hitHeavy`                     |
| Defence         | `block`                                                 |
| Movement        | `jump`, `land`, `step`, `whoosh`                        |
| Round flow      | `countdown`, `roundStart`, `fight`, `ko`                |
| Result          | `roundWin`, `matchWin`, `matchLose`, `fanfare`          |
| Feedback        | `combo` (pitch rises with the combo count)              |

Design rules that make the mix readable:

- **Each attack has two sounds**: a swing (on startup, so you can _react_ to it) and an impact
  (on hit). Light/medium/heavy differ in pitch, filter and duration, so you can tell what hit
  you with your eyes closed.
- **Everything is throttled.** `audio.play(name, { throttleMs })` drops repeat calls inside the
  window (default 20 ms), which stops 5 simultaneous particles from producing 5 stacked hits.
- **Combos rise in pitch.** `combo` takes `{ combo }` and shifts up a few semitones per hit —
  the classic "ting-ting-TING" escalation.
- **Music ducks on impact.** `duckMusic(0.2)` on a KO, `unduckMusic()` after the slow-motion.

---

## 3. Music

`src/audio/Music.js` is a **look-ahead step sequencer** (25 ms timer, 140 ms schedule-ahead),
not a `setInterval` player — so the groove does not stutter when the render loop hitches.

Two tracks, both 16 steps × 4 bars:

| Track    | BPM | Content                                                                           |
| -------- | --- | --------------------------------------------------------------------------------- |
| `menu`   | 92  | Airy pad, sparse bass and arpeggio — no drums                                     |
| `battle` | 138 | Kick (4-on-the-floor), snare on 2 & 4, offbeat hats, square bass, pentatonic lead |

Scales: A minor pentatonic (`A3 C4 D4 E4 G4`) for the lead, `A2 C3 D3 E3` for the bass, so
nothing can clash. Tracks fade in/out (`stop(fade)`) and duck independently of the SFX bus.

---

## 4. Autoplay policy & failure handling

Browsers block audio until the user interacts with the page:

- `AudioManager#unlock()` creates (or resumes) the `AudioContext`; `main.js` wires it to the first
  pointer / key / touch event.
- If `AudioContext` is missing or throws, `this.failed` is set and **every** audio call becomes a
  no-op. That is what makes the headless smoke test silent instead of crashing.
- `suspend()` / `resume()` are wired to tab visibility, so the game goes quiet in the background.

---

## 5. Settings

Three independent volumes (master / SFX / music) plus a mute toggle, all live:

```
Settings ──SETTINGS_CHANGED──► AudioManager#applyVolumes() ──► gain.setTargetAtTime(...)
```

`setTargetAtTime` (rather than a hard set) means volume changes in the pause menu glide instead of
clicking.

---

## 6. Adding a sound

1. Add a recipe to `src/audio/sfx.js`:

   ```js
   mySound: ({ ctx, dest, noise: buffer, at, level }) => {
     tone(ctx, dest, { type: 'square', freq: 440, freqEnd: 220, at, duration: 0.2, peak: 0.2 * level });
     noise(ctx, dest, buffer, { at, duration: 0.12, peak: 0.1 * level, filter: 'highpass', freq: 2000 });
   },
   ```

2. Play it: `audio.play('mySound', { volume: 0.9, throttleMs: 40 })`.
3. Keep it **short** (under ~400 ms) — these fire dozens of times per round.
4. If it is an attack sound, wire it through `ATTACKS[key].sfx` in `src/config/balance.js` rather
   than hard-coding it at the call site.

## 7. Known limits

- No spatialisation / panning (the arena is viewed from the side, so it adds little).
- No audio normalisation pass — levels were tuned by ear in `sfx.js`.
- The music engine has two hard-coded tracks; adding a third is a `TRACKS` entry.
