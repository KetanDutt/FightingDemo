# API Reference

## Core Systems

### `EventBus` (`src/core/EventBus.js`)

Global pub/sub for decoupled scene communication.

```js
import { bus, emit, on, once } from './core/EventBus.js';

// Subscribe
const unsub = on('health-changed', (payload) => { ... });

// Emit
emit('health-changed', { side: 'player', ratio: 0.5 });

// Unsubscribe
unsub();
```

**Events:**

| Event              | Payload                                                  | When                          |
| ------------------ | -------------------------------------------------------- | ----------------------------- |
| `health-changed`   | `{ side, ratio, hp }`                                    | Fighter takes damage or heals |
| `round-start`      | `{ round, playerWins, enemyWins }`                       | New round begins              |
| `round-end`        | `{ winner, reason, round, ... }`                         | Round concludes               |
| `timer-changed`    | `{ msLeft, seconds }`                                    | Clock ticks                   |
| `combo-changed`    | `{ count, side }`                                        | Combo increases or expires    |
| `hit`              | `{ attacker, defender, damage, blocked, combo, killed }` | Hit resolves                  |
| `settings-changed` | `{ settings, changed }`                                  | User changes a setting        |

---

### `Settings` (`src/core/Settings.js`)

```js
import { settings } from './core/Settings.js';

settings.get('difficulty'); // 'easy' | 'normal' | 'hard'
settings.set('difficulty', 'hard');
settings.toggle('showFps');
settings.sfxVolume; // 0..1 (computed: master × sfx × mute)
settings.musicVolume; // 0..1
settings.reset(); // Restore defaults
```

---

### `Stats` (`src/core/Stats.js`)

```js
import { stats } from './core/Stats.js';

stats.get('wins');             // number
stats.add('wins', 1);
stats.bump('bestCombo', 5);   // Only increases
stats.recordMatch({ won: true, score: 1200, ... });
stats.reset();
```

---

## Audio

### `audio` (`src/audio/index.js`)

```js
import { audio } from './audio/index.js';

audio.unlock(); // Call after user gesture
audio.play('hitHeavy'); // Play named SFX
audio.playMusic('battle'); // Start music track
audio.stopMusic(0.6); // Fade out music
audio.duckMusic(0.25); // Lower volume temporarily
audio.unduckMusic(); // Restore volume
audio.suspend(); // Tab hidden
audio.resume(); // Tab visible
```

**SFX names (28):** `uiHover`, `uiClick`, `uiBack`, `uiConfirm`, `uiDenied`, `swingLight`, `swingMedium`, `swingHeavy`, `hitLight`, `hitMedium`, `hitHeavy`, `block`, `jump`, `land`, `step`, `whoosh`, `countdown`, `roundStart`, `fight`, `ko`, `roundWin`, `matchWin`, `matchLose`, `combo`, `fanfare`, `tick`, `transition`, `softHit`

---

## Entities

### `Fighter` (`src/entities/Fighter.js`)

```js
const fighter = new Fighter(scene, {
  x: 640,
  facing: 1,           // 1 = right, -1 = left
  skin: getSkin('classic'),
  name: 'YOU',
  isPlayer: true,
  vfx: vfxSystem,
  onEvent: (type, payload) => { ... },
});

fighter.update(dt, { opponent: enemyFighter });
fighter.startAttack('punch');
fighter.startJump();
fighter.receiveHit({ def, damage, from: attacker, blocked });
fighter.reset(x, facing);
fighter.lock();           // Freeze (round intro)
fighter.unlock();         // Unfreeze
fighter.celebrate();      // Victory hop
fighter.push(direction, dt);
```

**Properties:**

- `hp`, `maxHealth`, `healthRatio`
- `state`, `facing`, `isKO`, `isDown`, `isStunned`
- `isBlocking`, `isGuarding`, `isAttacking`, `isRecovering`
- `canAct`, `airborneHeight`
- `intent` — `{ moveX, jump, block, attack }`

---

### `AiController` (`src/entities/AiController.js`)

```js
const ai = new AiController(enemyFighter, playerFighter, {
  difficulty: 'normal',
});

ai.update(dt); // Call each frame
ai.reset(); // New round
ai.setDifficulty('hard'); // Change difficulty
ai.profile; // Current AI profile
ai.live; // Adapted profile (after reads)
```

---

## Systems

### `CombatSystem` (`src/systems/CombatSystem.js`)

```js
const combat = new CombatSystem(scene, {
  vfx, floatingText, cameraFx,
  onHit: (info) => { ... },
});

combat.update(dt);                    // Age combo timers
const hitStop = combat.resolve(player, enemy); // Check hits
combat.reset();                       // New round
```

### `Vfx` (`src/systems/Vfx.js`)

```js
const vfx = new Vfx(scene, { quality: 1, reducedMotion: false });

vfx.impact(x, y, { power: 'heavy', direction: 1 });
vfx.dustPuff(x, y, { amount: 6, direction: 1 });
vfx.burst(x, y, { count: 24, tint: COLORS.gold });
vfx.celebrate(x, y, count);
vfx.ring(x, y, { color, endScale, duration });
vfx.flash(x, y, { color, scale, duration });
vfx.afterimage(container, sprite, { alpha, duration });
```

### `CameraFx` (`src/systems/CameraFx.js`)

```js
const cam = new CameraFx(scene, arena);

cam.shake(intensity, duration);
cam.zoomPunch(amount, duration);
cam.zoomTo(value, duration);
cam.flash(color, duration, alpha);
```

### `FloatingText` (`src/systems/FloatingText.js`)

```js
const text = new FloatingText(scene, { max: 16 });

text.spawn(x, y, 'BLOCK', {
  color: '#4fc3f7',
  fontSize: 48,
  rise: 90,
  drift: 30,
  delay: 0,
});
```

### `InputManager` (`src/systems/InputManager.js`)

```js
const input = new InputManager(scene, { onPause: () => pause() });

input.update(); // Poll gamepad
const intent = input.read(); // { moveX, jump, block, attack }
input.clear(); // On pause/blur
input.dispose(); // Cleanup
```

---

## UI Components

### `Button`

```js
const btn = new Button(scene, {
  x, y, width, height,
  label: 'FIGHT',
  icon: '🥊',
  variant: 'primary', // 'primary' | 'ghost' | 'danger' | 'success'
  onClick: () => { ... },
});

btn.appear(delay);
btn.setEnabled(false);
btn.setLabel('NEW TEXT');
```

### `Bar`

```js
const bar = new Bar(scene, {
  x,
  y,
  width,
  height,
  fillColor: COLORS.green,
  lagColor: COLORS.gold,
  flip: false, // true = drain right
});

bar.setValue(0.75, { animate: true });
bar.flash();
bar.setDanger(true);
```

### `MenuNav`

```js
const nav = new MenuNav(scene, { items: [btn1, btn2, btn3] });

nav.focus(0);
nav.setEnabled(false);
nav.dispose();
```

---

## Balance Config (`src/config/balance.js`)

All gameplay numbers live here:

| Constant        | Purpose                               |
| --------------- | ------------------------------------- |
| `FIGHTER_STATS` | Health, speeds, jump timing, hurtbox  |
| `ATTACKS`       | Frame data for punch, headbutt, stomp |
| `BLOCK`         | Chip damage fraction, pushback        |
| `COMBO`         | Combo window, scaling                 |
| `ROUND_RULES`   | Timer, rounds, intro/end durations    |
| `AI_PROFILES`   | Per-difficulty AI tuning              |
| `SCORING`       | Score formula weights                 |
