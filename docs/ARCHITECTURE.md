# Architecture

Monkey Mayhem is a Phaser 3 game organised as **pure-logic modules + thin scenes**. The rules
live in `src/systems` and `src/entities`, the numbers live in `src/config`, and the scenes
mostly wire things together and draw.

```
config  ← numbers only (no Phaser, no logic)
  ↓
utils / systems / entities  ← pure-ish logic (combat maths has zero Phaser imports)
  ↓
scenes  ← orchestration, input, rendering
  ↓
ui      ← reusable widgets
```

---

## 1. Boot & scene graph

`src/main.js` creates the Phaser game and registers the scenes in order:

| #   | Scene          | Key       | Role                                                          |
| --- | -------------- | --------- | ------------------------------------------------------------- |
| 1   | `PreloadScene` | `Preload` | Generates runtime textures, shows the animated loader         |
| 2   | `BootScene`    | `Boot`    | Loads the 10 sprite atlases + UI art with a live progress bar |
| 3   | `MenuScene`    | `Menu`    | Title, menu list, animated monkey idle                        |
| 4   | `SetupScene`   | `Setup`   | Mode / difficulty / rounds selection                          |
| 5   | `FightScene`   | `Fight`   | The match itself (arena, fighters, combat, rounds)            |
| 6   | `HudScene`     | `Hud`     | Overlay: health bars, timer, combo counter, banners           |
| 7   | `PauseScene`   | `Pause`   | Overlay: pause menu + live settings panel                     |
| 8   | `ResultsScene` | `Results` | Match summary, score, rematch / change setup / menu           |
| 9   | `GalleryScene` | `Gallery` | Animation viewer — scrub every sprite in the library          |

`Hud` and `Pause` run **in parallel** with `Fight` (launched/slept by `FightScene`), which keeps
HUD rendering out of the fight's update loop and lets the pause overlay freeze the fight without
stopping Phaser's render loop.

```
        ┌──────────┐
        │ Preload  │
        └────┬─────┘
             ▼
        ┌──────────┐   ┌────────┐
        │   Boot   ├─► │  Menu  │◄──────────────┐
        └──────────┘   └───┬────┘               │
                           ▼                    │
                      ┌─────────┐               │
                      │  Setup  │          ┌────┴─────┐
                      └────┬────┘          │ Gallery  │
                           ▼               └──────────┘
        ┌──────────┐  ┌─────────┐  ┌──────────┐
        │   Hud    │◄─┤  Fight  ├─►│  Pause   │
        └──────────┘  └────┬────┘  └──────────┘
                           ▼
                      ┌──────────┐
                      │ Results  │
                      └──────────┘
```

---

## 2. Frame loop & timing

Every scene updates in **milliseconds, not frames**:

```js
update(time, delta) {
  const rawDelta = Math.min(delta, 50);            // clamp tab-switch spikes
  const frozen = this.hitStop > 0;                 // hitstop freezes logic, not rendering
  const dt = frozen ? 0 : rawDelta * this.timeScale; // slow-motion / KO
  ...
}
```

Why it is built this way:

- **Refresh-rate independent.** Timers are countdowns in ms (hitstun 260, blockstun 170, attack
  startup 110 …), so a 144 Hz monitor plays exactly the same match as a 60 Hz one — there is no
  per-frame constant anywhere in the combat code.
- **Spikes are clamped, not simulated.** A backgrounded tab can hand you a 5 000 ms delta;
  clamping to 50 ms means the game _slows down briefly_ instead of teleporting fighters through
  each other and resolving 80 hits at once.
- **`timeScale` is the drama knob.** Hitstop sets `hitStop` (logic frozen, VFX still animating),
  and KOs scale `timeScale` to 0.25 for 1.1 s across logic _and_ tweens _and_ animation playback,
  so slow-motion stays in sync.

Order inside a fight frame:

```
input → AI → fighters (physics + state) → separation → combat (spawn/active/recovery → resolve)
      → clock → camera / VFX (driven by real delta, always smooth)
```

## 3. Data flow in a match

```
InputManager ──► player.intent ──┐
                                 ├──► Fighter.update(dt) ──► (physics, state machine,
AiController ──► enemy.intent ───┘                            animation, attack hitbox)

CombatSystem.update(fighters, dt)
   ├── spawn phase  : create the attack's hitbox, play SFX, unlock the plan
   ├── active phase : AABB test hitbox × hurtbox, once per attack
   │                    ├── blocked?  → chip damage, blockstun, push-back, shield FX
   │                    └── hit?      → scaling damage, hitstun, knockback, hitstop, shake
   └── recovery     : animation tail, then back to idle

CombatSystem ──emit──► bus ──► HudScene (bars, timer, combo, banners)
                    ──► Vfx / CameraFx / FloatingText / sfx / Music
```

`Fighter` never talks to the HUD, and the HUD never reads fighter internals — everything crosses
the **event bus** (`src/core/EventBus.js`, event names in `EVENTS`).

### Events

| Event              | Payload                             | Emitted by                       | Consumed by                 |
| ------------------ | ----------------------------------- | -------------------------------- | --------------------------- |
| `HEALTH_CHANGED`   | `{ side, ratio, hp }`               | Fighter / CombatSystem           | Hud                         |
| `TIMER_CHANGED`    | `{ msLeft, seconds }`               | FightScene                       | Hud                         |
| `ROUND_START`      | `{ round }`                         | FightScene                       | Hud                         |
| `ROUND_END`        | `{ winner, round, … }`              | FightScene                       | Hud                         |
| `COMBO_CHANGED`    | `{ count, side }`                   | CombatSystem                     | Hud                         |
| `HIT`              | `{ attacker, defender, damage, … }` | CombatSystem                     | Hud / Vfx / sfx             |
| `BLOCKED`          | `{ defender, … }`                   | CombatSystem                     | Vfx / sfx                   |
| `KNOCKOUT`         | `{ loser }`                         | CombatSystem                     | Fight / Music               |
| `FIGHTER_STATE`    | `{ side, state }`                   | Fighter                          | Hud                         |
| `SETTINGS_CHANGED` | `{ settings, changed }`             | SettingsManager                  | Hud / Fight / Pause / audio |
| `MODE_STARTED`     | `{ mode, … }`                       | FightScene                       | Hud / Music                 |
| `hud:fadeOut`      | —                                   | FightScene → Hud (ad-hoc string) |

The last one is the single ad-hoc channel: `FightScene` tells the HUD to fade out before it
transitions away. Everything else is declared in `EVENTS`.

---

## 4. Fighter state machine

`src/entities/Fighter.js` holds the state machine in `#updateState()`; every transition goes
through `#setState()` (which resets `stateElapsed` and fires the `state` event for the HUD).

```
                        ┌──────────────── canAct ────────────────┐
                        ▼                                        │
   idle ◄──► walkForward / walkBack                              │
    │  ▲                                                         │
    │  │                    ┌──────────────┐                     │
    ├──┼────► jump ────────►│ landRecovery │─────────────────────┤
    │  │                    └──────────────┘                     │
    ├──┼────► block (grounded only) ─────────────────────────────┤
    │  │                                                         │
    ├──┴────► punch / headbutt / stomp                           │
    │              startup ─► active ─► recovery ────────────────┤
    │                                                            │
    ├───────► hurt (hitstun) ──┬──► idle                         │
    │                          └──► down ─► getup (die reversed) ─┘
    │
    ├───────► ko (terminal for the round) ─► victory / locked
    └───────► locked (round intro / results / pause)

    blockstun is a timer on top of `block`, not a separate state.
```

- `canAct` is the single gate: while it is `false` (stun, startup, active, recovery, KO) the
  fighter ignores movement and attack intents.
- Attacks are data (`ATTACKS` in `src/config/balance.js`) — `{ startup, active, recovery, reach,
halfHeight, topOffset, bottomOffset, damage, chipDamage, knockback, hitstun, blockstun }`.
- `isRecovering` is true during an attack's active + recovery, which is what the AI punishes.
- Getting up reuses the defeat animation **played in reverse** — one clip, two meanings.
- Grounded blocking beats everything, but you cannot move or attack while blocking — that is
  the whole risk/reward of the game.

## 5. Systems

| Module                     | Responsibility                                                             |
| -------------------------- | -------------------------------------------------------------------------- |
| `systems/combatMath.js`    | **Phaser-free** damage scaling, chip damage, AABB overlap, timeout judging |
| `systems/CombatSystem.js`  | Attack phases, hit detection, hitstop, KO, event emission                  |
| `systems/InputManager.js`  | Keyboard / gamepad / touch → a single `intent` object, with buffering      |
| `systems/CameraFx.js`      | Framing, zoom, look-ahead, shake, KO slow-mo                               |
| `systems/Vfx.js`           | Sparks, speed lines, dust, cracks, shields, flashes (all pooled)           |
| `systems/FloatingText.js`  | Pooled damage / combo / "Block" popups                                     |
| `systems/Arena.js`         | Parallax background, ground, arena dressing                                |
| `entities/AiController.js` | Behaviour plans, adaptation, difficulty profiles                           |
| `audio/synth.js`           | WebAudio graph, master bus, per-bus gain, SFX recipes                      |
| `audio/Music.js`           | Small step-sequencer driving the synth                                     |
| `core/Settings.js`         | Validated, persisted settings + `SETTINGS_CHANGED`                         |
| `core/GameState.js`        | Cross-scene match state (mode, difficulty, rounds, score, history)         |
| `core/Stats.js`            | Per-match statistics (damage, accuracy, rounds)                            |

`combatMath.js` exists specifically so that combat rules can be unit-tested without booting
Phaser in Node — see [DEVELOPMENT.md](DEVELOPMENT.md#testing).

---

## 6. The art board (important)

Every sprite frame was exported from a **1280 × 720** art board, and the monkey is drawn at a
constant position within it. This is the single most important convention in the project:

```js
SOURCE_BOARD = { width: 1280, height: 720 };
SPRITE_ANCHOR = { x: 272.5, y: 701 }; // body centre / feet, in board pixels
```

Each atlas frame keeps `sourceSize` = 1280 × 720 plus its `spriteSourceSize` crop rect, so the
engine can recompute where the _body_ is even though the PNG only contains the trimmed blob:

```
frameOffsetX = SPRITE_ANCHOR.x - spriteSourceSize.x
frameOffsetY = SPRITE_ANCHOR.y - spriteSourceSize.y
```

The anchor is applied as `(frameOffsetX / frameWidth, frameOffsetY / frameHeight)` so that:

- the **feet** of every animation sit on the same ground line (no bobbing between idle/jump/die),
- the **body centre** is stable, so hitboxes stay aligned when the animation changes,
- flipping the sprite for the facing direction is a mirror around the body, not the crop.

`src/utils/frames.js` builds and caches those anchors; `src/data/animations.js` holds the
manifest. `tests/unit/assets.test.mjs` asserts the invariant on disk, so a bad re-export fails CI.

---

## 7. Animation

`src/utils/frames.js` is the only place that knows how clips are built:

| Helper                                | Job                                                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sortedFrameNames(scene, textureKey)` | Reads the atlas frame list and sorts it with `naturalCompare` — the JSON order in the atlases is _not_ sorted, so `Idol_png_0002.png` would otherwise precede `Idol_png_0001.png` |
| `createAnimations(scene)`             | Registers one Phaser animation per entry of `ANIMATION_DATA`                                                                                                                      |
| `getFrameBody(sprite)`                | Returns the current frame's trimmed rect so VFX can be anchored to the body, not the crop                                                                                         |

`Fighter` then drives playback by **state, never by clip name** (`#setState()` calls
`sprite.play({ key: ... })`), so art and state cannot drift apart. Frame rates come from the
manifest, not from a magic constant per clip — the original prototype ran everything at 30 fps,
which made the idle and walk cycles look frantic; idle is now 24 fps, walks 26 fps, hits 30 fps.

Two tricks worth knowing:

- `playReverse` on the defeat clip produces the get-up, so no extra art is needed.
- `getFrameBody()` + `SPRITE_ANCHOR` keeps the shadow, dust and impact sparks glued to the body
  across every clip.

Non-fighter animations (menu monkey, gallery) use the same helpers.

---

## 8. Audio

There is not a single audio file in the repository. `audio/synth.js` builds oscillators, noise
buffers and filter envelopes on demand:

```
synth (AudioContext) ──► busGain.sfx ──┐
                     ──► busGain.music ┤──► master gain ──► destination
                     (compressor on master)
```

- Unlocked on the first user gesture (autoplay policy).
- Ducking: music dips automatically for big hits and KOs.
- `Settings` writes straight to the bus gains, so the pause menu changes volume live.
- Headless/Node builds short-circuit to no-ops, which is why the smoke test is silent.

Details in [AUDIO.md](AUDIO.md).

---

## 9. Configuration surfaces

| File                  | What lives there                                                            | Why it is separate                            |
| --------------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| `config/constants.js` | Screen size, anchor, events, depths, timings, default settings              | Never changes at runtime                      |
| `config/palette.js`   | Colour tokens (+ the colour-blind variant)                                  | One place to re-skin                          |
| `config/balance.js`   | Fighter stats, attack frame data, combo rules, round rules, **AI profiles** | The tuning surface — designers edit only this |
| `data/animations.js`  | Sprite manifest (frame counts, rates, chaining)                             | Art-side contract                             |

Tuning the game means editing `balance.js` — nothing else needs to change, and the unit tests
re-validate the invariants (heavier attacks do more damage, `easy < normal < hard`, weights sum
to 1, …).

---

## 10. Persistence

`core/Storage.js` wraps `localStorage` with try/catch (private mode, quota) and a namespaced key
prefix; `core/Settings.js` validates every value against the defaults on load, so a stale or
hand-edited payload can never put the game into an impossible state.

Persisted: volume (master / SFX / music), difficulty, rounds, screen shake, hitstop, show FPS,
colour-blind palette, control scheme, and long-lived stats (matches, wins, best score).

---

## 11. Testing strategy

| Layer    | Tool                         | What it guarantees                                        |
| -------- | ---------------------------- | --------------------------------------------------------- |
| Unit     | `node --test`                | Pure maths, balance invariants, on-disk asset contract    |
| Smoke    | jsdom + `@napi-rs/canvas`    | A whole match boots, plays and reports results headlessly |
| Contract | `tests/unit/assets.test.mjs` | Atlases still match the anchor/board convention           |

See [DEVELOPMENT.md](DEVELOPMENT.md#testing).
