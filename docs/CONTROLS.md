# Controls

Every input is routed through `InputManager` (`src/systems/InputManager.js`), which produces one
`intent` object per frame:

```js
{ moveX: -1 | 0 | 1, jump: boolean, block: boolean, attack: 'punch' | 'headbutt' | 'stomp' | null }
```

The fighter and the AI consume exactly the same shape, which is why the AI cannot "cheat" — it
presses the same buttons you do.

---

## Keyboard

| Action       | Keys                |
| ------------ | ------------------- |
| Move left    | `A` / `←`           |
| Move right   | `D` / `→`           |
| Jump         | `W` / `↑` / `Space` |
| Block (hold) | `S` / `↓`           |
| Punch        | `J` / `Z`           |
| Headbutt     | `K` / `X`           |
| Stomp        | `L` / `C`           |
| Pause        | `Esc` / `P`         |

Setup screen:

| Action      | Keys                                                   |
| ----------- | ------------------------------------------------------ |
| Choose skin | cycle the skin row with `←` `→` focus                  |
| Difficulty  | arrow-key focus + `Enter`/`Space`                      |
| Rounds      | select FIRST TO 1 / 2 / 3 with focus + `Enter`/`Space` |
| Start match | `Enter` (with FIGHT! focused) or `Enter` shortcut      |

Menus:

| Action            | Keys                                                        |
| ----------------- | ----------------------------------------------------------- |
| Move selection    | `↑` `↓` `←` `→` (nearest button in that direction)          |
| Confirm           | `Enter` / `Space`                                           |
| Back              | `Esc`                                                       |
| Menu shortcuts    | `G` = move gallery, `S` = settings (from the main menu)     |
| Results shortcuts | `Esc` = main menu (`Enter` confirms the highlighted button) |
| Gallery           | `←` `→` change animation, `Space` play/pause, `Esc` back    |

### How blocking works

- Hold `S` / `↓` to guard. You cannot move or attack while guarding, and blocked hits still
  chip a little health — but every attack in the game is blockable.
- **Holding away also guards.** Backing away from the opponent counts as a guard (the Street
  Fighter convention), so retreating is safe — at the cost of not being able to attack out of it.
- Guarding only works against attacks coming from the front, and only while grounded.

### Input buffering

- Attacks pressed during **recovery, hitstun, knockdown, landing or a locked round** are buffered
  for up to 700 ms (`INPUT_BUFFER_MS` in `src/entities/Fighter.js`) and fire the instant the
  fighter can act. Chaining a punch → punch → stomp works by pressing the next button as the
  previous attack recovers.
- Jump is a one-frame latch with the same 700 ms window: tapping it during hitstun still jumps
  on the first free frame.
- The newest attack in the buffer wins, but nothing overwrites a move about to fire on the first
  free frame, so committed links always come out.
- Level inputs (move/block) are never buffered — they are re-read every frame.
- The low-level `InputManager` queue holds up to two attacks; stale entries expire once they have
  sat in the buffer too long — the buffer is a convenience, not a queue you can preload.

---

## Gamepad

Phaser's gamepad plugin, polled every frame in `InputManager#update()`.

| Action   | Button                                              |
| -------- | --------------------------------------------------- |
| Move     | D-pad left/right **or** left stick (deadzone 0.35)  |
| Jump     | D-pad up (edge-triggered)                           |
| Block    | D-pad down, `B`, `R1` or `R2`                       |
| Punch    | `A` (bottom face button)                            |
| Headbutt | `X` (left face button)                              |
| Stomp    | `Y` (top face button)                               |
| Pause    | `Start` or `Select` (standard-mapped indices 9 / 8) |

Face-button names follow the Xbox layout; Phaser maps them onto PlayStation/DualShock pads too,
so `A`/`X`/`Y` are the same physical positions (bottom / left / top).

Notes:

- Buttons are **edge-triggered** — holding punch does not auto-repeat; you get one attack per press.
- The stick is combined with the d-pad, so you can use whichever you prefer mid-match.
- Only pad index 0 is read (local multiplayer is not part of this demo).

---

## Touch / mobile

Touch controls appear automatically when the game detects a touch-capable device
(`src/ui/JoyPad.js`, `src/ui/ActionButtons.js`), and the layout is mirrored so it sits under
your thumbs.

| Control            | Action       |
| ------------------ | ------------ |
| D-pad left / right | Move         |
| D-pad up           | Jump         |
| D-pad down         | Block (hold) |
| `BLOCK`            | Block (hold) |
| `PUNCH`            | Punch        |
| `HEAD`             | Headbutt     |
| `STOMP`            | Stomp        |

Press-and-hold is supported for the block button, and the d-pad does not steal the swipe — the
page shell (`src/style.css`) disables browser scroll/zoom so the canvas fills the screen.

---

## Remapping

Bindings are not user-remappable yet. To change them:

- Keyboard: edit the `keyboard.on('keydown-…')` registrations in `src/systems/InputManager.js`.
- Gamepad: edit `InputManager#update()`.
- Touch: edit the definitions in `src/ui/ActionButtons.js`.

A remapping screen is a natural next feature — see [DEVELOPMENT.md](DEVELOPMENT.md#roadmap).
