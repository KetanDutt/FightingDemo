# 🐒 Monkey Mayhem — Fighting Demo

[![Phaser 3](https://img.shields.io/badge/Phaser-3.90+-blue.svg)](https://phaser.io)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg)](https://vitejs.dev)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-green.svg)](https://nodejs.org)
[![Deploy to GitHub Pages](https://github.com/KetanDutt/FightingDemo/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/KetanDutt/FightingDemo/actions/workflows/deploy-pages.yml)

**🎮 Play online: <https://ketandutt.github.io/FightingDemo/>** — every push to `main` is built
and published automatically (see [Deploying](#deploying)).

A polished, production-ready 2D fighting-game demo built with **Phaser 3** + **Vite**.
One-on-one matches against a monkey opponent, three unique special attacks per fighter,
best-of-3 rounds, an AI that adapts to your habits, and a full audiovisual layer built
from procedurally generated SFX and hand-tuned VFX.

```bash
npm install
npm run dev      # http://localhost:5173
```

> 🎮 **Zero audio files, zero background art** — everything is procedurally generated.
> The entire game ships in under 2 MB.

---

## Table of contents

- [Highlights](#highlights)
- [Quick start](#quick-start)
- [Controls](#controls)
- [Game rules](#game-rules)
- [Project structure](#project-structure)
- [npm scripts](#npm-scripts)
- [Documentation](#documentation)
- [Tech stack](#tech-stack)
- [Browser support](#browser-support)
- [Deploying](#deploying)
- [Credits & licence](#credits--licence)

---

## Highlights

**Gameplay**

- **First-to-N rounds** — FIRST TO 1 / 2 / 3 selectable on the setup screen (bo1 / bo3 / bo5),
  60 s round clock, timeout judged on remaining health, draw rounds replayed.
- Three attacks with real fighting-game properties — startup / active / recovery frames,
  hitboxes, chip damage through block, knockback, hitstun, blockstun.
- **Working input buffering** — attacks pressed during recovery land the moment you are free,
  and a jump latch has never been easier to hit.
- Scaling combo damage, hitstop, screen shake, KO slow-motion, "K.O." / "TIME" / "PERFECT!"
  call-outs, a "FINISH!" round-ending banner and "MATCH POINT" deciding rounds.
- Directional blocking (hold **away**), jumping with air drift, walk-forward/back footwork.
- Three difficulties — the AI telegraphs less, punishes more, blocks smarter and attacks
  more often as you go up.
- Adaptive AI: it tracks how much of the round you spend blocking, attacking and airborne, then
  shifts its pressure, guard rate, punish rate, spacing and move mix to counter you — pressure a
  turtling opponent with heavy chip, guard against a rushdown player, and keep space against a
  jumper.
- Extras: **Training mode** (infinite health, no clock, dummy spars back or stands still),
  an **Animation Gallery** to scrub every sprite in the library, and a results screen with
  score, accuracy and career stats.

**Presentation**

- Scene transitions with fade + whoosh, staggered menu reveals, spring/ease tweens on
  everything that moves, round-intro fighter reveals and easing in/out of slow motion.
- VFX: impact sparks, radial speed lines, dust puffs, block shields, KO flash, chromatic
  "damage" flash, screen shake, floating damage/combo numbers, and a low-HP pulse + heartbeat.
- Fully procedurally generated audio — a WebAudio synth for 28 SFX plus a small music engine
  (no binary audio assets, so the whole game ships in a couple of megabytes), with haptics on
  touch devices.
- Smart camera: zoom punches, KO slow-zoom, shake and flashes, all smoothed and gated by
  accessibility settings.
- Persistent settings (volume, difficulty, round count, screen shake, hit-stop, reduced motion,
  particle quality, colour-blind bars, show FPS, on-screen controls, control hints, skin)
  stored in `localStorage`, with a two-column settings panel.

**Engineering**

- All gameplay timers are in **milliseconds, not frames**, so a 144 Hz display plays exactly the
  same match as a 60 Hz one; large deltas are clamped instead of simulated, so a backgrounded tab
  cannot teleport fighters or resolve a burst of hits.
- Pure, Phaser-free maths modules → unit-testable without a browser.
- 32 unit tests + a headless end-to-end smoke test that plays a whole match.
- Zero runtime dependencies beyond Phaser; strict ESLint + Prettier; production build code-split
  so Phaser is cached separately from game code (~41 kB gzipped for the game).

---

## Quick start

```bash
git clone <your-fork-url>
cd FightingDemo
npm install
npm run dev
```

Open <http://localhost:5173>. That's it — there is no build step, no asset pipeline and no
backend. Everything the game needs is in `public/`.

| Command                  | What it does                                |
| ------------------------ | ------------------------------------------- |
| `npm run dev`            | Vite dev server with HMR on `0.0.0.0:5173`  |
| `npm run build`          | Production bundle → `dist/`                 |
| `npm run preview`        | Serve the built `dist/` locally             |
| `npm test`               | Unit tests + headless end-to-end smoke test |
| `npm run lint`           | ESLint                                      |
| `npm run format`         | Prettier (write)                            |
| `npm run analyze:assets` | Sprite-library / texture-memory report      |

---

## Controls

| Action   | Keyboard                     | Gamepad                     | Touch           |
| -------- | ---------------------------- | --------------------------- | --------------- |
| Move     | `A` / `D`, `←` / `→`         | D-pad or left stick         | On-screen d-pad |
| Jump     | `W` / `↑` / `Space`          | D-pad up                    | ▲               |
| Block    | `S` / `↓` (**or hold away**) | D-pad down, `B`, `R1`, `R2` | ■ / `BLOCK`     |
| Punch    | `J` / `Z`                    | `A` (bottom face)           | `PUNCH`         |
| Headbutt | `K` / `X`                    | `X` (left face)             | `HEAD`          |
| Stomp    | `L` / `C`                    | `Y` (top face)              | `STOMP`         |
| Pause    | `Esc` / `P`                  | `Start`                     | ⏸               |

Menus: `↑` `↓` `←` `→` move the selection (nearest button in that direction), `Enter` / `Space`
confirm, `Esc` goes back.

On-screen: touch devices get a d-pad + buttons automatically (or tap the screen once on a
hybrid laptop); keyboards get a legend bar at the bottom of the arena — press `H` or click it
to collapse. Both can be toggled live from Settings, even mid-match.

See [`docs/CONTROLS.md`](docs/CONTROLS.md) for the full list including buffered inputs,
tap-vs-hold behaviour, and the gamepad mapping.

---

## Game rules

- **First-to-N** rounds. Pick FIRST TO 1 / 2 / 3 on the setup screen (default FIRST TO 2 =
  best of three; FIRST TO 3 plays up to five rounds).
- **60 s** per round. On timeout the fighter with the larger health _fraction_ wins the round;
  if it is exactly level the round is a **draw** and is replayed (no round is awarded).
- **Chip damage**: blocking an attack still costs a sliver of health, so turtling isn't free.
- **Combo scaling**: each extra hit in a combo does less damage (floors at 60 % of base).
- **Throws are not in the move list** — blocking beats everything, but blocking stops you
  from moving and attacking, so it loses to spacing and patience.
- **Training mode**: infinite health, no clock, no round wins — pure practice with the HUD
  showing real damage numbers.
- **Score** = health left × 10 + rounds won × 500 + best combo × 25 + seconds left × 5 +
  a 750-point perfect bonus, plus 1 000 for winning the match.
- **Accuracy** is tracked as attacks that connected ÷ attacks thrown, and shown on the results
  screen so you can see whether you are mashing or connecting.

---

## Project structure

```
.
├── index.html                  # shell: meta, loader, fullscreen/root CSS vars
├── vite.config.js              # manual chunks (phaser / game), dev server config
├── public/assets/              # static, served as-is
│   └── monkeyMan/<anim>/       # one TexturePacker atlas per animation
├── src/
│   ├── main.js                 # Phaser game config + scene registration
│   ├── style.css               # page shell, loader, mobile layout
│   ├── config/                 # constants, palette, balance (the tuning surface)
│   ├── core/                   # EventBus, Settings, Stats, Storage
│   ├── utils/                  # math, random, format, tween helpers, texture factory
│   ├── data/animations.js      # the sprite library manifest
│   ├── audio/                  # WebAudio synth + music engine
│   ├── systems/                # Combat, VFX, Camera, Input, Arena, FloatingText, …
│   ├── entities/               # Fighter, AiController
│   ├── scenes/                 # Boot, Preload, Menu, Setup, Fight, Hud, Pause, Results, Gallery
│   └── ui/                     # Button, Bar, Slider, Toggle, MenuNav, JoyPad, SettingsPanel
├── tests/
│   ├── helpers/headless.mjs    # jsdom + @napi-rs/canvas Phaser shim
│   ├── smoke.test.mjs          # plays a full match headlessly
│   └── unit/                   # math, balance and asset-contract tests
└── docs/                       # architecture, design, assets, audio, performance, …
```

---

## npm scripts

| Script                    | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `dev`                     | Vite dev server (`0.0.0.0:5173`, HMR)            |
| `build`                   | Production build → `dist/`                       |
| `preview`                 | Preview the production build                     |
| `test`                    | `test:unit` then `test:smoke`                    |
| `test:unit`               | `node --test "tests/unit/*.test.mjs"`            |
| `test:smoke`              | Headless end-to-end match                        |
| `lint` / `lint:fix`       | ESLint                                           |
| `format` / `format:check` | Prettier                                         |
| `analyze:assets`          | Frame counts, atlas sizes, GPU texture budget    |
| `deploy`                  | Build + publish `dist/` to the `gh-pages` branch |

---

## Documentation

| Document                                         | What's in it                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)   | Module map, data flow, scene lifecycle, events, state machines    |
| [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)     | Design pillars, frame data, balance numbers, AI design, scoring   |
| [`docs/CONTROLS.md`](docs/CONTROLS.md)           | Every input, buffering rules, gamepad + touch mapping             |
| [`docs/ASSETS.md`](docs/ASSETS.md)               | Sprite library, atlas format, the art-board anchor, adding art    |
| [`docs/AUDIO.md`](docs/AUDIO.md)                 | Procedural SFX synth, music engine, adding sounds                 |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)     | Budgets, fixed-timestep loop, texture memory, profiling           |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)     | Setup, conventions, testing, how to add attacks/scenes/characters |
| [`docs/LEGACY.md`](docs/LEGACY.md)               | What the original bundle was, and every bug that was fixed        |
| [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) | Motion, colour, hearing and input accommodations                  |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md)         | Release history                                                   |
| [`docs/API.md`](docs/API.md)                     | Developer API reference for all systems, entities and UI          |
| [`docs/TESTING.md`](docs/TESTING.md)             | How to run and write tests, CI setup                              |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)       | Build, deploy to static hosts, performance checklist              |

---

## Tech stack

|               |                                                              |
| ------------- | ------------------------------------------------------------ |
| Engine        | [Phaser 3](https://phaser.io) (WebGL with Canvas fallback)   |
| Bundler       | [Vite 5](https://vitejs.dev)                                 |
| Language      | Modern ES modules (ES2022), no transpiler, no framework      |
| Tests         | `node:test` + jsdom + `@napi-rs/canvas` (headless Phaser)    |
| Lint / format | ESLint 9 (flat config) + Prettier                            |
| Audio         | WebAudio API, generated at runtime — no audio files          |
| Art           | TexturePacker-style JSON atlases (10 animations, 235 frames) |

---

## Browser support

Chrome/Edge 90+, Firefox 90+, Safari 15+, and mobile Chromium/Safari (touch controls appear
automatically). Requires WebGL; Phaser falls back to the Canvas renderer where WebGL is
unavailable, though the VFX layer is tuned for WebGL.

---

## Deploying

**GitHub Pages is automated.** Pushing to `main` runs the deploy workflow
(`.github/workflows/deploy-pages.yml`): lint → unit + smoke tests → `vite build` → publish
`dist/` to the `gh-pages` branch. It can also be triggered manually from the
[Actions tab](https://github.com/KetanDutt/FightingDemo/actions/workflows/deploy-pages.yml)
(_Run workflow_). The live site: <https://ketandutt.github.io/FightingDemo/>.

To deploy by hand from a machine, `npm run deploy` runs the exact same build + publish step
(`tools/publish-gh-pages.mjs`). `dist/` itself never touches a source branch.

`npm run build` emits a fully static `dist/` — no server-side rendering, no API, no headers
required. Drop it on any static host (Netlify, Vercel, S3, nginx) as well:

```bash
npm run build
npx vite preview        # sanity check the build locally
```

The build uses `base: './'`, so it works from any sub-directory without reconfiguration.

---

## Credits & licence

- Original project and art: **Ketan Dutt** (© 2026).
- Engine: Phaser 3 by Photon Storm.
- This repository is distributed for **viewing and evaluation only**: copying, modification,
  distribution, commercial use, and use of the code or art for training or improving
  machine-learning/AI systems are prohibited without prior written permission.
  See [`LICENSE`](LICENSE) for the full terms.
