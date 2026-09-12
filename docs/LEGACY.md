# Legacy notes

This document records what the repository contained before the rebuild, how the current project
relates to it, and the defects that were found and fixed along the way. It is here so nobody has
to reverse-engineer the same things twice.

---

## 1. What was in the repository

The upstream repository had **exactly one commit** (`80cd651 Add project license`) and contained
art only — no source, no build config, no HTML, no manifest:

```
.gitignore
LICENSE                     © 2026 Ketan Dutt — view/evaluation only
assets/
├── joypad.png              touch d-pad art
├── next.png                gallery chevron
├── monkeyMan/<clip>/       texture.json + texture.png  (10 clips, 235 frames)
└── raw/<clip>/raw/         the un-packed per-frame PNG export that produced each atlas
```

The playable game itself was a **single minified bundle with no source map and no bundler config**
in the repository, i.e. not maintainable, not reviewable and not testable.

---

## 2. What the current project is

A from-scratch, modular rewrite that **reuses the original art unchanged** and rebuilds
everything around it:

| Area      | Before                                   | Now                                                                  |
| --------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Structure | one minified file                        | ~40 ES modules under `src/`, one job per file                        |
| Build     | none                                     | Vite 5 (dev server, HMR, code-split production build)                |
| Engine    | Phaser (bundled, unknown version)        | Phaser 3 as an npm dependency, split into its own chunk              |
| Art       | `assets/` at the repo root               | `public/assets/` (stable URLs, no bundler rewriting)                 |
| Tuning    | baked into the bundle                    | `src/config/balance.js` — one file a designer can edit               |
| Audio     | (none)                                   | Procedural WebAudio synth + music engine, no audio files             |
| Tests     | none                                     | 31 unit tests + a headless end-to-end match                          |
| Docs      | none                                     | this `docs/` folder + README                                         |
| Hygiene   | `.DS_Store` files, raw exports committed | `.gitignore`d, raw exports dropped (atlases are the source of truth) |

The art is byte-identical to the original export. What changed is everything around it.

---

## 3. Conventions recovered from the art

These are the things the original build relied on implicitly, and which the rewrite now asserts in
tests (see `tests/unit/assets.test.mjs`):

| Convention                                                                     | Why it matters                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Every frame's `sourceSize` is 1280 × 720                                       | The whole anchor system depends on it — see [ASSETS.md](ASSETS.md#3-the-art-board-and-the-anchor) |
| The character sits at a fixed place on that board (`SPRITE_ANCHOR` 272.5, 701) | Feet on one ground line, stable body centre across all 10 clips                                   |
| Frames are trimmed, and the trim rect differs per clip                         | Anchors must be recomputed per frame, not hard-coded                                              |
| Frame names are `Idol_png_0001.png`-style                                      | They must be sorted _naturally_; plain string sort puts `_0010` before `_0002`                    |
| The atlas JSON order is **not** the play order                                 | Same reason — always sort before registering an animation                                         |

---

## 4. Defects found and fixed

### From the original build

| #   | Defect                                                                                                                                | Fix                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `bus.setMaxListeners(...)` threw on Phaser's `EventEmitter` — the API does not exist there, so the audio/event wiring crashed on boot | Removed the call; the bus is a plain `Phaser.Events.EventEmitter` with declarative `EVENTS` names        |
| 2   | Sprites used default origins, so the trimmed frames made the fighter **bob and float** between clips (feet did not line up)           | Per-frame anchor derived from `sourceSize` + `spriteSourceSize` (`src/utils/frames.js`, `SPRITE_ANCHOR`) |
| 3   | Animations could play **out of order** because the atlas JSON frame order is not the natural order                                    | Frames sorted with `naturalCompare` in `sortedFrameNames()`                                              |
| 4   | Every clip played at 30 fps, which made the idle and walk cycles look frantic                                                         | Per-clip frame rates in `src/data/animations.js` (idle 24, walks 26, hits 30)                            |
| 5   | `assets/` lived at the repo root alongside `.DS_Store` and the raw per-frame exports                                                  | Moved to `public/assets/`, junk ignored, raw exports dropped                                             |
| 6   | No way to run, build or verify the project                                                                                            | `npm run dev/build/test`, ESLint + Prettier, unit + smoke tests                                          |

### Fixed during the rewrite

| #   | Defect                                                                                                                          | Fix                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Attacks could get **stuck in the active phase** (a missing import meant combo scaling threw, silently freezing every swing)     | Combat maths extracted to `src/systems/combatMath.js` with unit tests; `CombatSystem` imports verified by the smoke test's KO assertions |
| 8   | The AI queued an attack and then **never closed the distance**, so easy difficulty could go a whole round without landing a hit | The `attack` plan now walks in to `reach + 40`, and `attackCooldown` gates pressure                                                      |
| 9   | Timeout judging compared **raw HP**, which is unfair if the fighters ever get different max health                              | `judgeTimeout(playerRatio, enemyRatio)` compares fractions; exact ties are a draw and the round replays                                  |
| 10  | The scoring formula was duplicated in `FightScene` with magic numbers                                                           | `SCORING` in `src/config/balance.js`, consumed by `#calculateScore`                                                                      |
| 11  | Difficulty was barely distinguishable — normal and hard killed a passive player in the same time                                | Added `attackCooldown` per profile and re-tuned; measured spread is now ~41 s / ~31 s / ~19 s                                            |
| 12  | Menus were mouse-only                                                                                                           | `MenuNav` gives every menu arrow-key movement and ENTER/SPACE to confirm                                                                 |
| 13  | Blocking required a button press, which felt wrong for the genre                                                                | Holding **away** now guards (Street Fighter convention) in addition to the block button                                                  |

---

## 5. Deliberate non-goals

- **Recovering the original source.** There is no source map and no bundler config in history;
  the bundle is unrecoverable in any useful sense. Do not spend time on it.
- **Re-exporting the art.** The atlases are correct and the tests now pin their contract. If art
  must change, see [ASSETS.md](ASSETS.md#5-adding-or-replacing-an-animation).
- **Changing the licence.** `LICENSE` (© 2026 Ketan Dutt) is unchanged and applies to art and code.
  The repository is view/evaluation only; do not add an open-source licence on top of it.

---

## 6. Files that no longer exist

| Removed                                      | Reason                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| prebuilt `dist/bundle.js` (minified game)    | Replaced by `src/` + a real build                                                      |
| `assets/` at the repo root                   | Moved to `public/assets/`                                                              |
| `assets/raw/**` (hundreds of per-frame PNGs) | Derived output; the packed atlases are the source of truth, and history still has them |
| `.DS_Store` files (3)                        | macOS noise; now gitignored                                                            |
