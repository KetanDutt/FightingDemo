# Changelog

All notable changes to this project are documented here. The project follows
[semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

---

## [Unreleased]

### Fixed

- **Blocked hits barely chipped.** Chip damage was scaled twice (once in `chipDamage()`, again in
  `Fighter#receiveHit`), so a blocked punch dealt ~0.3 instead of 1. Chip is now exactly the
  documented 1 / 1.5 / 2 (`BLOCK.chipScale` / `minHoldTime` removed as dead weight) and the smoke
  test asserts it through both the direct and the live combat path.
- **The stomp was secretly unblockable.** The block check excluded knock-down attacks, which
  contradicted the docs, the AI (it picks the heavy _for its chip_ vs turtles) and the loading
  tips. Every attack is blockable again.
- **Disabling hit-stop killed all hit feedback.** The early return skipped VFX, SFX, combo events
  and accuracy stats — now it only skips the freeze frames.
- **Fighters teleported when touching.** The separation push multiplied the overlap by the push
  speed (~11× over-correction per frame); steps are now capped by speed × dt.
- **Settings sliders jumped to 100 %.** Pointer math ignored the panel container transform; drags
  now un-project through the world matrix (with a cached matrix + scratch vector, no per-move
  allocation).
- **Health bars snapped instead of draining**, and every update killed the low-HP danger pulse
  (`killTweensOf(this)`). Bar tweens are tracked individually and animate from the current value.
- **Music burst after a backgrounded tab.** The sequencer scheduled every missed step on resume;
  it now resyncs instead.
- **Camera zoom drift.** An interrupted zoom punch settled at a mid-zoom value; punches now always
  return to a tracked baseline owned by `zoomTo()`.
- **Lunge carried through hitstun.** Getting hit mid-lunge no longer slides the victim forward.
- **Landing cut the hurt animation.** Being hit out of the air keeps the stun pose now.
- **Hit reactions snapped.** The 0.83 s hurt clip is time-scaled to fit each stun window.
- **Celebration could bleed into the next round.** Round resets kill fighter tweens and cancel the
  delayed victory punch via a token.
- **Gallery "next" art shrank on hover.** Hover tweens scale around the display size, not 1.
- **Results screen**: the last stats row overflowed its panel, draws played the lose jingle with
  the enemy portrait, and the winner portrait hid behind the panel. Panel resized, draws get a
  fanfare + your fighter, portrait moved to the side.
- **Draws counted as career losses.** Match stats are now win / loss / neither.
- **Buttons clicked on stray pointer-ups.** Clicks need a press that started on the button;
  sliding off cancels, touch no longer double-tweens hover.
- **Gallery UP/DOWN and loop keys** added (`L` toggles loop); dead `autoAdvance` removed.
- **Dead event constants** (`FIGHTER_STATE`, `MODE_STARTED`) removed; `BLOCKED` and `KNOCKOUT`
  are now actually emitted per the documented bus contract. `InputManager` disposal removes all
  listeners and fully resets pad edge state.
- **Boot failures explain themselves** instead of fading to black (in-game splash message +
  a last-resort loader notice in `index.html`).
- Docs: README gamepad jump cell (`A` is punch, not jump), gallery keys, SFX count (28, not 25),
  event table payloads/consumers, camera description (no look-ahead), curtain-transition wording.

### Added

- **On-screen controls for touch, keyboard legend for desktop.** Touch devices get the d-pad +
  action buttons (auto-enabled on touch hardware, on first tap, or via the `showTouchControls`
  setting) plus a short layout toast; keyboard players get a legend pill at the bottom of the
  arena (`src/ui/ControlsHint.js`) that dims itself, collapses with `H` or a click, and hides
  via the new `showControlsHint` setting. Both toggles apply live mid-match from the pause
  settings. The menu footer and pause screen also recap the controls for the current device.
- **Training dummy modes** — the setup screen offers SPARS BACK or STANDS STILL for training.
- **Match point** — deciding rounds get a `MATCH POINT` banner sub plus a glowing round pip.
- **Low-HP heartbeat** — critical health pulses the red vignette with a soft tick each second.
- **Haptics** — touch devices vibrate on hits (light/heavy/block/KO patterns), skipped under
  reduced motion (`src/utils/haptics.js`).
- **Scene-transition whooshes**, a score count-up tick on results, a training-reset thump, a
  zoom punch on `FIGHT!`, and a two-step QUIT confirm on the pause screen. Every SFX in the
  library is now wired to something.
- **Accessibility doc** (`docs/ACCESSIBILITY.md`) covering motion, colour, hearing and input.

## [1.1.0] — 2026-09-17

### Fixed

- **Fighters rendered below the ground.** Every atlas ships a `pivot` of `(0.5, 0.5)` (the art-
  board centre); Phaser treats that as a custom pivot and re-applies it as the sprite origin on
  every frame change, silently clobbering the `SPRITE_ORIGIN` feet anchor. `createAnimations()`
  now clears the packer pivot once at load time, so fighters (and the menu/setup/gallery monkey)
  stay grounded through every animation.
- **Input buffering never worked.** `InputManager#read()` discarded the whole attack queue every
  frame and jumps could not be latched during hitstun, so presses during recovery were dropped.
  The queue is no longer truncated, and `Fighter` now latches jump/attack inputs for up to 700 ms
  (`INPUT_BUFFER_MS`) — including during hitstun, attack recovery, knockdown and landing.
- Locked fighters no longer snap to face the opponent during round intro / pause (`Fighter`).
- `chipDamage()` no longer returns spurious values for degenerate (zero/null) attack data; the
  fragile `|| 0` precedence chain is gone and covered by a unit test.
- `Arena#destroy()` double-destroyed its ambient particle emitters (they also lived in `layers`).
- Dust particles no longer spray straight down through the floor (emission band narrowed).
- Victory celebration tween could optionally target a destroyed fighter's `y`; it is now
  defensive.

### Added

- **Round-count selector** on the setup screen (FIRST TO 1 / 2 / 3 = bo1 / bo3 / bo5), persisted
  as the `roundCount` setting and honoured by the round state machine, HUD pips and match rules.
- **Round intro reveal**: fighters pin in from their corners with a camera push-in (a dedicated
  `FightScene#revealFighters()`). Removed the close-then-pull camera double-zoom it replaced.
- **Call-outs**: golden "K.O." on every knockout, "TIME" on timeouts, and a "PERFECT!" fanfare +
  burst when a fighter wins a round untouched.
- **Eased slow-motion recovery**: `FightScene#restoreTimeScale()` ramps time back to 1× instead
  of snapping after a KO.
- **Colour-blind mode** (`colorblindMode`): health bars switch from red/green to blue/orange.
- **Hit-stop toggle** (`hitStop`): freeze frames on hit can be disabled for accessibility.
- **HUD round-pip flourish**: the newly-earned pip pops in when a round is awarded.
- Settings panel redesigned into a two-column layout to fit the new toggles.

### Changed

- `ROUND_RULES` grew `roundOptions` + `forSelector()`; `FightScene` reads `roundRules` from the
  selected option instead of hard-coded bo3 constants.
- Docs now describe the features that were actually shipped (round count, buffering, call-outs,
  accessibility) — see README, GAME_DESIGN, CONTROLS, SETTINGS, ARCHITECTURE.

---

## [1.0.0] — 2026-09-12

First release of the rebuilt project. The game was re-implemented from scratch around the
original (unchanged) sprite library; see [LEGACY.md](LEGACY.md) for what was here before.

### Added

**Project**

- ES-module source tree under `src/` (config / core / utils / systems / entities / scenes / ui),
  built with Vite 5, Phaser 3 as an npm dependency.
- `npm run dev / build / preview / test / lint / format / analyze:assets`.
- ESLint 9 flat config + Prettier, both clean.
- 31 unit tests (`node:test`) covering maths, balance invariants, the on-disk asset contract and
  AI behaviour.
- Headless end-to-end smoke test that boots the real game in jsdom and plays a full match.
- `docs/` — architecture, game design, controls, assets, audio, performance, development, legacy.
- `tools/analyze-atlases.mjs` — sprite library and VRAM report (`npm run analyze:assets`).

**Gameplay**

- Best-of-3 rounds, 60 s clock, timeout judged on remaining health fraction, draw rounds replayed.
- Three attacks with real frame data (startup / active / recovery), hitboxes, knockback, hitstun,
  blockstun and knock-downs.
- Chip damage through block, combo damage scaling, input buffering.
- Directional blocking — block button **or** hold away (Street Fighter style).
- Adaptive AI with three tuned difficulty profiles (Rookie / Challenger / Ape King).
- Training mode (no clock, infinite health, instant reset) and a move gallery.
- `FINISH!` call, KO slow-motion, camera zoom and shake on match-ending knockouts.
- Results screen with rounds, damage, best combo, **accuracy** and score, plus a career record.

**Presentation**

- Procedural audio: 25 synthesised SFX, a two-track step sequencer for music, ducking on hits,
  independent master/SFX/music volumes. No audio files ship.
- VFX layer: impact sparks, shockwave rings, dust, shield shards, speed lines, hit flash, KO burst,
  floating damage numbers — all pooled.
- Camera system: framing, zoom punch, look-ahead, shake, slow-motion.
- Animated menus with `MenuNav` (arrow keys + ENTER), buttons, sliders, toggles and a settings panel.
- Touch controls (d-pad + action buttons) and gamepad support alongside the keyboard.
- Persistent settings incl. screen shake, hitstop, reduced motion, particle quality, colour-blind
  palette and FPS counter.

### Fixed

- `bus.setMaxListeners` crashed on boot (Phaser's `EventEmitter` has no such method).
- Fighters bobbed and floated between clips: anchors are now derived per frame from `sourceSize`
  and `spriteSourceSize` (`SPRITE_ANCHOR`).
- Atlas frames could play out of order; frames are now sorted with `naturalCompare`.
- All clips played at 30 fps, making idle/walk frantic; per-clip rates (24 / 26 / 30).
- Attacks could stall in the active phase; combat maths is now isolated in `combatMath.js` and
  unit-tested.
- The AI could queue an attack and never close the distance; the attack plan now walks into range
  and `attackCooldown` paces its pressure.
- Timeout judging compared raw HP instead of health fractions.
- Scoring magic numbers were duplicated in `FightScene`; they now live in `SCORING`.
- Difficulty was nearly flat between normal and hard; profiles re-tuned and verified
  (~41 s / ~31 s / ~19 s to KO a passive player).
- Menus were mouse-only; every menu now supports arrow keys and ENTER/SPACE.

### Removed

- The prebuilt minified bundle (unmaintainable, no source map).
- `assets/` at the repo root (moved to `public/assets/`), `assets/raw/**` exports and `.DS_Store`
  files.

---

## Roadmap

Planned, in rough priority order:

- Key remapping screen.
- Local versus mode (both fighters are already intent-driven).
- More moves: crouch, throw, air attack, super meter.
- Stage variety.
