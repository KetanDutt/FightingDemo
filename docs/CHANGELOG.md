# Changelog

All notable changes to this project are documented here. The project follows
[semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

---

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

## [Unreleased]

Planned, in rough priority order:

- Key remapping screen.
- Local versus mode (both fighters are already intent-driven).
- More moves: crouch, throw, air attack, super meter.
- Stage variety.
