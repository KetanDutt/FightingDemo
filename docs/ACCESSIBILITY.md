# Accessibility

What the game does so more people can play it — and where the gaps still are.

---

## Motion & flashing

| Setting (`Settings.js`) | What changes                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `reducedMotion`         | No parallax drift, leaves, light shafts, camera shake/zoom/flash, haptics, or low-HP vignette pulse. Hit feedback falls back to floating text. |
| `screenShake` (0..1)    | Scales every camera shake; `0` disables shake entirely (parallax reactions go with it).                                                        |
| `hitStop`               | Freeze frames on hit. Off = the game never stops the world, but all VFX/SFX/stats still run.                                                   |

Camera shakes are also throttled (max one per 60 ms) so multi-hit combos never stack into a blur.

## Colour & readability

- `colorblindMode` swaps the red/green health bars for blue/orange (deuteranopia-safe).
- Health bars drain below a `dangerThreshold` (25 %) with a pulsing animation plus a red
  vignette and heartbeat tick — low health is never colour-only.
- All HUD text uses heavy strokes and drop shadows against the animated background.

## Hearing

- Every gameplay beat has a visual twin: hits flash + shake + spawn damage numbers, blocks
  show a shield ring and `BLOCK` text, the timer pulses red under 10 s, KOs slow the world down.
- Music and SFX sit on independent buses with separate volumes plus a global mute (`M`).
- Nothing gameplay-critical is audio-only.

## Input

- The whole game is playable keyboard-only: every menu supports arrow-key navigation with a
  focus ring (`MenuNav`), `Enter`/`Space` confirm, `Esc` goes back.
- Full gamepad support (d-pad/stick + face buttons + Start to pause) and touch controls
  (d-pad + buttons) with multi-touch.
- Touch devices get `navigator.vibrate` ticks on hits (light 20 ms / heavy 45 ms / KO
  pattern), skipped under reduced motion.
- On-screen help adapts to the device: touch players get buttons + a layout toast, keyboard
  players get a legend pill (`H` collapses it).

## Known gaps

- No screen-reader support for menus and no larger-text mode (see the roadmap in
  [DEVELOPMENT.md](DEVELOPMENT.md#7-roadmap)).
- Settings sliders are pointer-only; there is no keyboard equivalent yet.
- Haptics are Android/Chrome-only in practice (iOS Safari ignores `navigator.vibrate`).
