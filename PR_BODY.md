## Summary

Comprehensive polish pass across the entire Monkey Mayhem fighting demo — bug fixes, VFX/SFX improvements, new features, and full documentation.

## Bug Fixes

- **FightScene startedAt always 0**: Moved from init() to create() when this.time is ready
- **Slow-motion KO too short**: Was using duration * scale (275ms) instead of real-time duration (1100ms)
- **Combo reset for both sides**: Combo expiry was emitting for both player AND enemy — now only for the fighter whose combo expired
- **Arena memory leak**: Dust and leaf particle systems not tracked in layers array, leaking on scene change
- **PreloadScene crash on load failure**: Now properly aborts create() when assets fail to load
- **Vignette overlay leak**: Added cleanup in FightScene cleanup

## Visual Polish

- **Health vignette**: Red screen-edge overlay when player health drops below 25%
- **Round intro camera zoom**: Dramatic zoom-in at round start, easing back to normal
- **Hit flash**: White tint flash on fighter sprite when taking damage (60ms duration)
- **Attack lunge afterimage**: Afterimage trail effect during attack lunges
- **Block shield flash**: Blue flash VFX when blocking an attack
- **Victory punch**: Winner plays a punch animation during celebration hop
- **Enhanced combo callouts**: Bigger pop-in with shake for 4+ hit combos
- **Animated score counter**: Score counts up on the results screen

## New Features

- **Global mute toggle (M key)**: Works from any scene, persists to settings
- **Loading tip cycling**: Tips rotate every 3.6 seconds during asset loading, added 5 new tips
- **3 new SFX**: tick (timer), transition (whoosh), softHit (training reset)

## Documentation

- docs/API.md — Full developer API reference for all systems, entities, and UI components
- docs/TESTING.md — Testing guide with CI setup, manual testing checklist
- docs/DEPLOYMENT.md — Production deployment guide for static hosts
- docs/SETTINGS.md — Complete settings reference with all keys, types, and defaults
- Updated README with badges and links to new documentation

## Code Quality

- JSDoc type annotation for CombatSystem combos Map
- Better error handling in PreloadScene (abort on failure)
- Mute key hint added to menu footer and pause screen
- Vite build: consistent asset file naming for better caching

## Testing

- All 31 unit tests pass
- Smoke test passes
- Production build succeeds (131KB game + 339KB Phaser, gzipped)
