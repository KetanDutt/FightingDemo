# 🐒 Monkey Mayhem — Fighting Demo

A polished, production-ready 2D fighting-game demo built with **Phaser 3** + **Vite**.
One-on-one matches against a monkey opponent, three unique special attacks per fighter,
best-of-3 rounds, an AI that adapts to your habits, and a full audiovisual layer built
from procedurally generated SFX and hand-tuned VFX.

```bash
npm install
npm run dev      # http://localhost:5173
```

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

- Best-of-3 rounds (1 / 3 / 5 selectable), 60 s round clock, timeout judged on remaining health,
  draw rounds replayed.
- Three attacks with real fighting-game properties — startup / active / recovery frames,
  hitboxes, chip damage through block, knockback, hitstun, blockstun.
- Scaling combo damage, hitstop, screen shake, KO slow-motion, and a "Finish" call.
- Directional blocking (hold **away**), jumping with air drift, walk-forward/back footwork.
- Three difficulties — the AI telegraphs less, punishes more, blocks smarter and attacks
  more often as you go up.
- Adaptive AI: it tracks how much of the round you spend blocking, attacking and airborne, then
  shifts its pressure, guard rate, punish rate, spacing and move mix to counter you — pressure a
  turtling opponent with heavy chip, guard against a rushdown player, and keep space against a
  jumper.
- Extras: **Training mode** (infinite health, no clock), an **Animation Gallery** to scrub
  every sprite in the library, and a results screen with score, accuracy and per-round history.

**Presentation**

- Curtain-style scene transitions, staggered menu reveals, spring/ease tweens on everything
  that moves.
- VFX: impact sparks, radial speed lines, dust puffs, ground cracks, block shields, KO flash,
  chromatic "damage" flash, screen shake, and a direction-aware hit-veil.
- Fully procedurally generated audio — a WebAudio synth for SFX plus a small music engine
  (no binary audio assets, so the whole game ships in a couple of megabytes).
- Smart camera: framing, zoom, look-ahead and shake, all smoothed.
- Persistent settings (volume, difficulty, rounds, screen shake, hitstop, show FPS, colour-blind
  palette, control scheme) stored in `localStorage`.

**Engineering**

- All gameplay timers are in **milliseconds, not frames**, so a 144 Hz display plays exactly the
  same match as a 60 Hz one; large deltas are clamped instead of simulated, so a backgrounded tab
  cannot teleport fighters or resolve a burst of hits.
- Pure, Phaser-free maths modules → unit-testable without a browser.
- 31 unit tests + a headless end-to-end smoke test that plays a whole match.
- Zero runtime dependencies beyond Phaser; strict ESLint + Prettier; production build code-split
  so Phaser is cached separately from game code (~37 kB gzipped for the game).

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
| Jump     | `W` / `↑` / `Space`          | D-pad up (or `A`)           | ▲               |
| Block    | `S` / `↓` (**or hold away**) | D-pad down, `B`, `R1`, `R2` | ■ / `BLOCK`     |
| Punch    | `J` / `Z`                    | `A` (bottom face)           | `PUNCH`         |
| Headbutt | `K` / `X`                    | `X` (left face)             | `HEAD`          |
| Stomp    | `L` / `C`                    | `Y` (top face)              | `STOMP`         |
| Pause    | `Esc` / `P`                  | `Start`                     | ⏸               |

Menus: `↑` `↓` `←` `→` move the selection (nearest button in that direction), `Enter` / `Space`
confirm, `Esc` goes back.

See [`docs/CONTROLS.md`](docs/CONTROLS.md) for the full list including buffered inputs,
tap-vs-hold behaviour, and the gamepad mapping.

---

## Game rules

- **Best of N** rounds (default 3). First to `ceil(N / 2)` round wins takes the match.
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
│   ├── core/                   # EventBus, SettingsManager, GameState
│   ├── utils/                  # math, random, format, tween helpers
│   ├── data/animations.js      # the sprite library manifest
│   ├── audio/                  # WebAudio synth + music engine
│   ├── systems/                # Combat, VFX, Camera, Input, Animator, FloatingText, …
│   ├── entities/               # Fighter, AiController
│   ├── scenes/                 # Boot, Menu, Setup, Fight, Hud, Pause, Results, Gallery
│   └── ui/                     # Button, Panel, MenuList, Toggle
├── tests/
│   ├── helpers/headless.mjs    # jsdom + @napi-rs/canvas Phaser shim
│   ├── smoke.test.mjs          # plays a full match headlessly
│   └── unit/                   # math, balance and asset-contract tests
└── docs/                       # architecture, design, assets, audio, performance, …
```

---

## npm scripts

| Script                    | Description                                   |
| ------------------------- | --------------------------------------------- |
| `dev`                     | Vite dev server (`0.0.0.0:5173`, HMR)         |
| `build`                   | Production build → `dist/`                    |
| `preview`                 | Preview the production build                  |
| `test`                    | `test:unit` then `test:smoke`                 |
| `test:unit`               | `node --test "tests/unit/*.test.mjs"`         |
| `test:smoke`              | Headless end-to-end match                     |
| `lint` / `lint:fix`       | ESLint                                        |
| `format` / `format:check` | Prettier                                      |
| `analyze:assets`          | Frame counts, atlas sizes, GPU texture budget |

---

## Documentation

| Document                                       | What's in it                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Module map, data flow, scene lifecycle, events, state machines    |
| [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)   | Design pillars, frame data, balance numbers, AI design, scoring   |
| [`docs/CONTROLS.md`](docs/CONTROLS.md)         | Every input, buffering rules, gamepad + touch mapping             |
| [`docs/ASSETS.md`](docs/ASSETS.md)             | Sprite library, atlas format, the art-board anchor, adding art    |
| [`docs/AUDIO.md`](docs/AUDIO.md)               | Procedural SFX synth, music engine, adding sounds                 |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)   | Budgets, fixed-timestep loop, texture memory, profiling           |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)   | Setup, conventions, testing, how to add attacks/scenes/characters |
| [`docs/LEGACY.md`](docs/LEGACY.md)             | What the original bundle was, and every bug that was fixed        |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md)       | Release history                                                   |

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

`npm run build` emits a fully static `dist/` — no server-side rendering, no API, no headers
required. Drop it on any static host (Netlify, Vercel, GitHub Pages, S3, nginx):

```bash
npm run build
npx vite preview        # sanity check the build locally
```

If you host it in a sub-directory, set `base` in `vite.config.js`.

---

## Credits & licence

- Original project and art: **Ketan Dutt** (© 2026).
- Engine: Phaser 3 by Photon Storm.
- This repository is distributed for **viewing and evaluation only**: copying, modification,
  distribution, commercial use, and use of the code or art for training or improving
  machine-learning/AI systems are prohibited without prior written permission.
  See [`LICENSE`](LICENSE) for the full terms.
