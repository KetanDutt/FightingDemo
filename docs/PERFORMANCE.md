# Performance

## 1. Budget, measured

`npm run build` (Vite 5, `target: es2019`):

```
dist/index.html                     1.86 kB │ gzip:   0.84 kB
dist/assets/index-ldYa1CBK.css      2.14 kB │ gzip:   0.96 kB
dist/assets/index-Mnsk3QIE.js     128.58 kB │ gzip:  38.62 kB   ← the game
dist/assets/phaser-Pd2ESoD5.js  1,478.94 kB │ gzip: 339.71 kB   ← the engine
```

Plus **1.3 MB of art** in `public/` (235 sprite frames).

| Budget                     | Target        | Typical                             |
| -------------------------- | ------------- | ----------------------------------- |
| First load (cached engine) | < 1.5 MB      | ~40 kB JS + art                     |
| Cold load                  | < 3 MB        | ~1.7 MB over the wire (gzip)        |
| Steady-state frame time    | < 16.6 ms     | 3–6 ms of game logic                |
| Draw calls (fight)         | < 60          | ~40 (2 fighters + HUD + particles)  |
| Long tasks on boot         | none > 200 ms | atlas decode is the only heavy step |

Phaser is split into its own chunk (`manualChunks` in `vite.config.js`) so game updates never
invalidate the big, cacheable engine file.

---

## 2. What costs the most

### Texture memory

Phaser uploads each atlas as an RGBA texture, so **82 MB of VRAM** is used before the first frame
is drawn (`npm run analyze:assets` prints the breakdown):

| Atlas                 | RGBA    |
| --------------------- | ------- |
| `idle` (1755 × 2781)  | 18.6 MB |
| `stomp` (1910 × 1713) | 12.5 MB |
| `jump` (2042 × 1162)  | 9.1 MB  |
| `head` (2009 × 1043)  | 8.0 MB  |
| `punch` (1916 × 1081) | 7.9 MB  |
| everything else       | ~26 MB  |

That is fine on desktop and acceptable on modern mobile, but it is the first thing to attack if
you need to ship on low-memory devices. Options, cheapest first:

1. **Drop the largest atlas.** `idle` is 23 % of the budget for a menu pose.
2. **Re-export at 0.75 scale** and render the fighters at 1.33 × — roughly halves VRAM.
3. **Trim tighter.** Several clips have generous transparent padding.
4. **Pack multiple clips into one atlas** to reduce per-texture overhead (not VRAM, but fewer
   texture binds per frame).

### Draw calls

- Every particle is a **pooled, pre-created** sprite (`Vfx#take()` reuses the first invisible
  one), so the fight never allocates during combat.
- `FloatingText` keeps a hard cap (`max`) and recycles the oldest entry beyond it.
- The HUD runs in its own scene but is a handful of containers and text objects.

### Logic

- Combat is two AABB tests per frame. There is no physics engine.
- The AI does a handful of accumulators per frame; its adaptation step only runs when a plan
  expires (every 0.2–1 s), not every frame.
- All timers are simple countdowns.

---

## 3. Frame pacing

```js
const rawDelta = Math.min(delta, 50); // never simulate more than 50 ms at once
const dt = frozen ? 0 : rawDelta * this.timeScale;
```

- **Hitstop** (`hitStop`) freezes _logic_ while VFX, tweens and the camera keep animating on real
  time — that is what makes a hit feel like it lands without stuttering the screen.
- **Slow motion** scales logic, tweens _and_ animation playback together, so the KO sequence does
  not desynchronise.
- **Clamping** means a 5-second tab-switch does not run 300 catch-up ticks: the match simply
  pauses and resumes.

Ghost frames: Phaser's default `FIT` scale mode keeps the whole arena visible at any aspect ratio
and letterboxes the rest; the page shell paints the letterbox area, so there is no visible flash.

---

## 4. Settings that change the cost

All live in the pause menu and persist:

| Setting          | Effect                                                       |
| ---------------- | ------------------------------------------------------------ |
| Particle quality | Scales every emitter count (sparks, dust, shards)            |
| Screen shake     | Skips camera shake entirely when off                         |
| Hitstop          | Removes the freeze-frame cost (and the feel)                 |
| Reduced motion   | Disables parallax, bobbing, drifting leaves and camera drift |
| Show FPS         | Adds one text object; useful when profiling                  |

---

## 5. Profiling

1. **In-game FPS counter** — Settings → Show FPS.
2. **Chrome DevTools → Performance** — record a round; look for long tasks during
   `FightScene.update` and for GC sawtooth (there should be none: nothing allocates per frame
   except short-lived intent objects that V8 handles in the nursery).
3. **Phaser Spector / WebGL** — `phaser3spectorjs` is a devDependency; attach it to inspect
   texture uploads and draw calls.
4. **Asset report** — `npm run analyze:assets` for VRAM regressions after re-exporting art.

### Things that would show up first

| Symptom                   | Likely cause                                                       |
| ------------------------- | ------------------------------------------------------------------ |
| Hitch at boot             | Atlas decode (1755 × 2781 PNG) — consider splitting `idle`         |
| Hitch on the first hit    | First particle emitters being created lazily — prewarm them        |
| Steady low FPS on mobile  | Texture bandwidth; lower particle quality and/or reduce atlas size |
| FPS drops late in a match | Floating text or VFX pool exhaustion — check the caps              |
