# Assets

## 1. What ships

```
public/assets/
├── joypad.png              # touch d-pad art (88 kB)
├── next.png                # gallery "next" chevron (8 kB)
└── monkeyMan/              # the entire character library — 1.2 MB on disk
    ├── idle/     texture.json + texture.png     35 frames
    ├── moveForward/                             21
    ├── moveBack/                                21
    ├── jump/                                    22
    ├── punch/                                   15
    ├── head/                                    15
    ├── stomp/                                   22
    ├── block/                                   29
    ├── hit/                                     25
    └── die/                                     30
```

**235 frames, ~1.3 MB of PNG.** Everything else in the game — sparks, dust, shields, speed lines,
bar frames, panel backgrounds, the vignette — is generated at runtime into textures by
`src/utils/textures.js`, which is why the repository has no image-editor round-trip for VFX.

Run `npm run analyze:assets` for a live report:

```
animation     frames          atlas         gpu (rgba)  notes
─────────────────────────────────────────────────────────────────────────
idle          35 (29 unique)  1755x2781     18.6 MB     1.46s @ 24fps
moveForward   21 (5 unique)   1521x703      4.1 MB      0.81s @ 26fps
moveBack      21 (5 unique)   1521x703      4.1 MB      0.81s @ 26fps
jump          22 (11 unique)  2042x1162     9.1 MB      0.73s @ 30fps
punch         15 (9 unique)   1916x1081     7.9 MB      0.50s @ 30fps
head          15 (8 unique)   2009x1043     8.0 MB      0.50s @ 30fps
stomp         22 (12 unique)  1910x1713     12.5 MB     0.73s @ 30fps
block         29 (9 unique)   1694x1009     6.5 MB      1.12s @ 26fps
hit           25 (6 unique)   1741x709      4.7 MB      0.83s @ 30fps
die           30 (9 unique)   1921x900      6.6 MB      1.00s @ 30fps
─────────────────────────────────────────────────────────────────────────
total frames: 235   disk (png): 1.0 MB   gpu (rgba): 82.0 MB
```

The "gpu" column is the important one: Phaser uploads each atlas as an RGBA texture, so the
character art alone costs ~82 MB of VRAM (see [PERFORMANCE.md](PERFORMANCE.md#texture-memory)).

---

## 2. Atlas format

Each animation is a **JSON hash atlas** (Free Tex Packer 0.6.7) with one PNG:

```json
{
  "frames": {
    "Idol_png_0001.png": {
      "frame": { "x": 0, "y": 0, "w": 439, "h": 355 },
      "rotated": false,
      "trimmed": true,
      "spriteSourceSize": { "x": 53, "y": 346, "w": 439, "h": 355 },
      "sourceSize": { "w": 1280, "h": 720 },
      "pivot": { "x": 0.5, "y": 0.5 }
    }
  },
  "meta": { "app": "http://free-tex-packer.com", "image": "texture.png", "format": "RGBA8888" }
}
```

Two things matter:

1. **`sourceSize` is always 1280 × 720** and is _always kept_ (trimming is enabled, but the source
   size is not stripped). That is what makes the anchor maths possible.
2. **Frame order in the JSON is not the play order.** Frames are always re-sorted with
   `naturalCompare` (`src/utils/math.js`) before an animation is registered, because
   `Idol_png_0010.png` sorts after `Idol_png_0002.png` only with a natural sort.
   `tests/unit/assets.test.mjs` fails if a re-export ever breaks either of these.

---

## 3. The art board and the anchor

Every frame is a crop of a **1280 × 720 art board** on which the character is drawn at a fixed
place. `src/config/constants.js`:

```js
export const SOURCE_BOARD = { width: 1280, height: 720 };
export const SPRITE_ANCHOR = { x: 272.5, y: 701, halfWidth: 155 }; // body centre / feet
```

From that, `src/utils/frames.js` computes where the _body_ sits inside each trimmed frame:

```
offsetX = SPRITE_ANCHOR.x - spriteSourceSize.x
offsetY = SPRITE_ANCHOR.y - spriteSourceSize.y
origin  = (offsetX / frame.w, offsetY / frame.h)
```

Consequences (all of them good):

- The **feet** land on exactly the same ground line in every clip — no bobbing between idle,
  walk and die.
- The **body centre** is stable, so hitboxes, hurtboxes, shadows, dust and impact sparks stay
  aligned when the animation changes.
- Horizontal **flipping** mirrors around the body, not the crop rectangle.
- The `hit` and `die` clips can be re-exported at a different crop size without touching code.

`getFrameBody(sprite)` returns the live rect for the current frame, which is how VFX and the
shadow are positioned every frame.

---

## 4. Animation manifest

`src/data/animations.js` is the single source of truth for clip metadata — the engine reads frame
counts from the atlas, but rates, labels and intent come from here:

```js
{ key: ANIMS.IDLE, label: 'Idle', description: '…', frameRate: 24, loop: true }
```

| Clip     | Key           | Frames | Rate | Duration | Loops      |
| -------- | ------------- | ------ | ---- | -------- | ---------- |
| Idle     | `idle`        | 35     | 24   | 1.46 s   | yes        |
| Advance  | `moveForward` | 21     | 26   | 0.81 s   | yes        |
| Retreat  | `moveBack`    | 21     | 26   | 0.81 s   | yes        |
| Jump     | `jump`        | 22     | 30   | 0.73 s   | no         |
| Punch    | `punch`       | 15     | 30   | 0.50 s   | no         |
| Headbutt | `head`        | 15     | 30   | 0.50 s   | no         |
| Stomp    | `stomp`       | 22     | 30   | 0.73 s   | no         |
| Block    | `block`       | 29     | 26   | 1.12 s   | yes (held) |
| Hurt     | `hit`         | 25     | 30   | 0.83 s   | no         |
| Die      | `die`         | 30     | 30   | 1.00 s   | no         |

Rates were tuned rather than left at the export default of 30 fps: idle at 30 looked frantic,
walks at 24 looked floaty.

Attack clip durations are deliberately close to the frame data in `ATTACKS`
(`src/config/balance.js`) — e.g. punch is 500 ms of startup+active+recovery versus a 500 ms clip —
so the art and the hitbox finish together.

---

## 5. Adding or replacing an animation

1. Export the clip from a **1280 × 720** board with the character at the same place as the
   existing art (`SPRITE_ANCHOR`).
2. Pack it as a **JSON hash atlas** with `texture.png` + `texture.json`, trimming enabled but
   **`sourceSize` preserved**, no rotation, no alpha bleeding beyond the frame rect.
3. Drop it in `public/assets/monkeyMan/<key>/`.
4. Add the key to `ANIMS` (`src/config/constants.js`) and an entry to `ANIMATION_DATA`
   (`src/data/animations.js`).
5. Run everything:

   ```bash
   npm run analyze:assets   # frame counts, atlas size, off-board frames
   npm test                 # asset contract + full match smoke test
   ```

If the new clip is an attack, add its frame data to `ATTACKS` and run the frame
(`tests/unit/balance.test.mjs` checks the damage/recovery ordering).

---

## 6. Runtime-generated textures

`src/utils/textures.js` draws the VFX and UI textures once during `PreloadScene`:

| Key         | Shape                               | Used for                                |
| ----------- | ----------------------------------- | --------------------------------------- |
| `fx-pixel`  | 4×4 white pixel                     | Tinted bars, rects, full-screen flashes |
| `fx-dot`    | Soft radial dot                     | Embers, dust motes, generic particles   |
| `fx-spark`  | Four-point star with a glowing core | Impact sparks on every hit              |
| `fx-ring`   | Thin double ring                    | Shockwaves, block shields, KO rings     |
| `fx-dust`   | Soft puff                           | Footsteps, landings, knockback scuffs   |
| `fx-shard`  | Angled sliver                       | Block debris, ground cracks             |
| `fx-shadow` | Radial blob                         | Fighter ground shadow                   |
| `fx-flash`  | Big soft disc                       | Hit flash, KO white-out                 |
| `fx-leaf`   | Leaf silhouette                     | Ambient arena drift                     |
| `fx-coin`   | Coin / gold dot                     | Celebration bursts                      |

This keeps the repository tiny and lets the VFX be tinted per hit type.

---

## 7. Housekeeping notes

- Atlases are **not** in `.gitignore` — they are source art and the game will not boot without
  them (`tests/unit/assets.test.mjs` enforces the on-disk contract).
- `dist/` (build output) **is** ignored.
- The `idle` clip contains 6 duplicated pose frames (35 frames, 29 unique rects). They are kept
  because the duplicates are _timing_ holds that make the breathing loop read correctly; removing
  them would need a matching `repeat`/frame-rate change in the manifest.
- GIF/MP4 source previews are not shipped; the **move gallery** scene in-game is the reference.
