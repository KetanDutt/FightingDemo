# Development

## 1. Setup

```bash
npm install          # install deps (Phaser, Vite, ESLint, Prettier, jsdom, @napi-rs/canvas)
npm run dev          # http://localhost:5173 — Vite dev server with HMR
npm test             # unit tests + headless end-to-end match
```

Requirements: **Node 18+** (the repo is developed on 22), any modern browser. There is no native
build step — `@napi-rs/canvas` ships prebuilt binaries (plain `canvas` will _not_ build here).

---

## 2. Scripts

| Script                            | Description                           |
| --------------------------------- | ------------------------------------- |
| `npm run dev`                     | Dev server on `0.0.0.0:5173`          |
| `npm run build`                   | Production build → `dist/`            |
| `npm run preview`                 | Serve `dist/`                         |
| `npm test`                        | `test:unit` + `test:smoke`            |
| `npm run test:unit`               | `node --test "tests/unit/*.test.mjs"` |
| `npm run test:smoke`              | Headless full-match run               |
| `npm run lint` / `lint:fix`       | ESLint 9 (flat config)                |
| `npm run format` / `format:check` | Prettier                              |
| `npm run analyze:assets`          | Sprite/VRAM report                    |

> **Always use the glob** for unit tests: `node --test "tests/unit/*.test.mjs"`.
> `node --test tests/unit/` fails, because Node then loads the helper modules in the wrong order.

---

## 3. Layout conventions

```
src/config/    numbers only — no Phaser import, no logic
src/utils/     pure helpers (math, format, tween helpers, texture factory)
src/systems/   gameplay systems; combat maths has zero Phaser imports
src/entities/  Fighter + AiController
src/scenes/    Phaser scenes — orchestration and rendering
src/ui/        reusable widgets (Button, Bar, Slider, Toggle, MenuNav, …)
src/core/      singletons: bus, settings, stats, storage
tests/         node:test unit tests + jsdom smoke test
tools/         standalone scripts (asset report)
docs/          this documentation
```

Rules of thumb:

- **Config never imports engine code.** `src/config/*` is plain data so tests can read it.
- **Nothing that must be unit-tested imports Phaser.** That is why combat maths lives in
  `src/systems/combatMath.js` and why `AiController` takes plain objects.
- **Scenes talk over the event bus**, never by reaching into each other (`src/core/EventBus.js`,
  event names in `EVENTS`).
- **Private-by-default**: scene internals use `#private` methods; only the documented public API
  is meant to be called from elsewhere.
- **JSDoc on every exported symbol and non-obvious branch.** There is no type checker in the
  build, so the doc comments _are_ the typing (`jsconfig.json` enables `checkJs` for editors).

---

## 4. Testing

### Unit (`tests/unit/*.test.mjs`)

Fast, no browser, no Phaser:

| File               | Covers                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `math.test.mjs`    | clamp/lerp/approach/randInt/naturalCompare/weightedPick/createRandom/formatClock/formatAccuracy                                                                                                    |
| `balance.test.mjs` | Attack frame data sanity, heavier-attack ordering, combo scaling, chip damage, timeout judging, AI profile ordering, round rules, animation metadata                                               |
| `assets.test.mjs`  | On-disk contract: every animation has `texture.png` + `texture.json`, frames sort numerically, every frame keeps `sourceSize` 1280×720, idle's first frame matches `SPRITE_ANCHOR`, UI art present |
| `ai.test.mjs`      | Difficulty mapping, adaptation clamps, "turtle → more pressure", "aggressor → more guarding", "jumper → more space", difficulty ordering preserved, no intent written while KO                     |

### Smoke (`tests/smoke.test.mjs`)

Boots the **real game** inside jsdom with `@napi-rs/canvas` (`tests/helpers/headless.mjs`) and
plays a scripted match:

```
boot → preload → menu (frame counts + frame order) → setup (previews) → fight
     → walk right / left → punch damage → block chip → stomp KO → round win
     → pause / resume → match win → results (winner, rounds, score) → rematch resets score
     → training mode (clock never ticks) → gallery (arrow keys change animation) → menu
```

It asserts **zero asset load errors** and **zero non-audio console errors**. Audio warnings are
expected (jsdom has no WebAudio) — that path is exercised on purpose to prove the game degrades
gracefully.

Headless gotchas worth knowing before you touch the helper:

- **Do not override global `performance`** — jsdom delegates `Performance.now` to it and you get
  infinite recursion.
- Phaser needs `CanvasRenderingContext2D`, `ImageData`, `screen`, `devicePixelRatio`,
  `matchMedia`, `ResizeObserver`, `Node`, `HTMLElement` and the DOM event constructors.
- `URL.createObjectURL` must be stubbed, and XHR must return a real `Blob` for `responseType:
'blob'`.
- Canvas sources are unwrapped from `@napi-rs/canvas` objects before Phaser touches them.

### Manual checklist before shipping

1. `npm test`
2. `npm run lint`
3. `npm run format:check`
4. `npm run build && npm run preview` — play a full match, pause, rematch, gallery.
5. One pass on a touch device or with DevTools device emulation.

---

## 5. How to…

### …add an attack

1. Add frame data to `ATTACKS` in `src/config/balance.js` (startup/active/recovery, reach,
   band, damage, chipDamage, knockback, hitstun, blockstun, shake, hitStop, sfx, vfx).
2. Make sure there is an animation clip with the same key in `ANIMS` + `ANIMATION_DATA`.
3. Bind it in `src/systems/InputManager.js` (keyboard + gamepad) and in
   `src/ui/ActionButtons.js` (touch).
4. Run `npm test` — `balance.test.mjs` enforces the "heavier = slower and stronger" invariants.

### …add a scene

1. Create `src/scenes/MyScene.js` extending `Phaser.Scene` with a `key` from `SCENES`.
2. Register it in `src/main.js`.
3. Use the shared widgets (`Button`, `Bar`, `MenuNav`) and tween helpers (`fadeIn`, `popIn`,
   `slideIn`, `bob`, `pulse`) so it matches the rest of the game.
4. Add a keyboard nav list if it has buttons: `new MenuNav(this, { items: [...] })`.

### …add a character

Characters are **skins**, not separate fighters: add an entry to `SKINS` in
`src/config/palette.js` (tint + name), and it becomes selectable in Setup. A new sprite set needs
the atlas work described in [ASSETS.md](ASSETS.md#5-adding-or-replacing-an-animation).

### …tune the game

Edit `src/config/balance.js` only. The unit tests will tell you if you broke an invariant
(difficulty ordering, weight sums, damage ordering).

### …profile

See [PERFORMANCE.md](PERFORMANCE.md#5-profiling).

---

## 6. Code style

- Prettier (`.prettierrc.json`): 2-space indent, 100 print width, single quotes, semicolons,
  trailing commas.
- ESLint 9 flat config (`eslint.config.js`): `no-unused-vars`, `no-console` (off in `tests/` and
  `tools/`), plus the usual correctness rules.
- Comments explain **why**, not what. Config files are the exception — every number gets a unit
  and a sentence.

---

## 7. Roadmap

Ideas that were deliberately left out (in rough priority order):

1. **Key remapping** screen (the input layer is already abstracted behind `InputManager`).
2. **Local versus** — `Fighter` and `AiController` are already symmetric; it needs a second
   `InputManager` and a versus mode in Setup.
3. **More moves**: crouch, throw, air attack, super meter.
4. **Stage variety** — `Arena` is already parameterised.
5. **Replay / match history** in `Stats`.
6. **Accessibility**: screen-reader-friendly menus, larger-text mode.
