# Settings Reference

All settings are persisted to `localStorage` under the key `monkey-mayhem:v1:settings`.

## Audio

| Key            | Type    | Default | Range | Description                        |
| -------------- | ------- | ------- | ----- | ---------------------------------- |
| `masterVolume` | number  | 0.8     | 0..1  | Global volume multiplier           |
| `sfxVolume`    | number  | 0.85    | 0..1  | Sound effects volume               |
| `musicVolume`  | number  | 0.45    | 0..1  | Music volume                       |
| `muted`        | boolean | false   | —     | Mute all audio (toggle with M key) |

## Visuals

| Key               | Type    | Default | Options | Description                                    |
| ----------------- | ------- | ------- | ------- | ---------------------------------------------- |
| `screenShake`     | number  | 1       | 0..1    | Camera shake intensity multiplier              |
| `reducedMotion`   | boolean | false   | —       | Disables flashing, reduces particles and shake |
| `hitStop`         | boolean | true    | —       | Freeze frames on hit for extra impact          |
| `colorblindMode`  | boolean | false   | —       | Blue/orange health bars (deuteranopia-safe)    |
| `particleQuality` | number  | 1       | 0, 1, 2 | Particle count (Off / Normal / High)           |
| `showFps`         | boolean | false   | —       | Show FPS counter during matches                |

## Gameplay

| Key          | Type   | Default  | Options                  | Description                               |
| ------------ | ------ | -------- | ------------------------ | ----------------------------------------- |
| `difficulty` | string | 'normal' | 'easy', 'normal', 'hard' | AI difficulty for arcade mode             |
| `roundCount` | string | 'bo5'    | 'first', 'bo3', 'bo5'    | Round count selector (FIRST TO 1 / 2 / 3) |

## Controls

| Key                 | Type    | Default | Description                                                  |
| ------------------- | ------- | ------- | ------------------------------------------------------------ |
| `showTouchControls` | boolean | false   | Force on-screen controls (auto-enabled on touch devices)     |
| `showControlsHint`  | boolean | true    | Keyboard legend pill during fights (H or click collapses it) |

## Cosmetic

| Key        | Type   | Default   | Description                |
| ---------- | ------ | --------- | -------------------------- |
| `lastSkin` | string | 'classic' | Last selected fighter skin |

## Modifying Settings

```js
import { settings } from './core/Settings.js';

// Get
const vol = settings.get('masterVolume');

// Set (persists + broadcasts change)
settings.set('masterVolume', 0.5);

// Toggle boolean
settings.toggle('muted');

// Bulk update
settings.set({ masterVolume: 0.5, sfxVolume: 0.7 });

// Reset to defaults
settings.reset();
```

## Events

When any setting changes, `EVENTS.SETTINGS_CHANGED` is emitted on the event bus:

```js
import { on } from './core/EventBus.js';
import { EVENTS } from './config/constants.js';

on(EVENTS.SETTINGS_CHANGED, ({ settings, changed }) => {
  console.log('Changed:', changed);
});
```

## Keyboard Shortcuts

| Key | Action                         |
| --- | ------------------------------ |
| `M` | Toggle mute                    |
| `S` | Open settings (from main menu) |
