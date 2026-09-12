# Game design

## 1. Pillars

| Pillar                        | What it means in practice                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Readable**                  | Every attack is a distinct silhouette with a distinct sound. You should be able to tell what happened from the audio alone.             |
| **Three buttons, real depth** | Punch / headbutt / stomp. No motion inputs, no hidden command lists — depth comes from spacing, timing and the risk/reward of blocking. |
| **The opponent reacts**       | The AI reads how you play and shifts its behaviour. Winning by spamming one move should stop working.                                   |
| **Every frame is feedback**   | Hitstop, shake, sparks, floating numbers, camera zoom, controller-ish juice. A hit has weight.                                          |
| **Pick up and play**          | A round is 60 s, a match is under 3 minutes, and the menus explain themselves.                                                          |

---

## 2. The mental model

This is a **spacing game first, a reaction game second.**

- Blocking beats every attack in the game — but you cannot move or attack while blocking,
  and blocking still costs a little chip damage.
- Therefore the way to beat a blocker is _movement_: walk in, walk out, bait a block, punish
  the recovery.
- Attacks are slow enough to be seen (110–210 ms startup) and long enough to be punished
  (250–353 ms recovery), so throwing one at the wrong range is a commitment.
- Knockback resets spacing for both fighters, which gives the defender room to breathe and
  makes each exchange discrete.

The loop: **approach → threaten → they block or get hit → punish the recovery → knockback →
re-approach.**

---

## 3. Attacks

Frame data lives in `ATTACKS` (`src/config/balance.js`). Times are ms; distances are design px
on a 1920 × 1080 board.

|                            | Punch      | Headbutt   | Stomp          |
| -------------------------- | ---------- | ---------- | -------------- |
| Input                      | Light      | Medium     | Heavy          |
| Damage                     | 7          | 11         | **17**         |
| Chip through block         | 1          | 1.5        | 2              |
| Startup                    | **110**    | 150        | 210            |
| Active                     | 130        | 140        | 170            |
| Recovery                   | **260**    | 250        | 353            |
| Total                      | 500        | 540        | 733            |
| Reach (hitbox centre)      | 300        | 330        | **360**        |
| Hitbox half-width          | 155        | 165        | 180            |
| Vertical band (above feet) | −340 … −70 | −300 … −30 | −250 … **+60** |
| Knockback                  | 60         | 115        | **210**        |
| Hitstun                    | 260        | 320        | **460**        |
| Blockstun                  | 170        | 200        | 260            |
| Lunge                      | 40         | 90         | 120            |
| Hitstop                    | 55         | 75         | 110            |
| Knocks down                | no         | no         | **yes**        |

Reading the table:

- **Punch** is the poke. Safest on block (−170 blockstun for the defender, short recovery for
  you) and the only move fast enough to interrupt a hesitant opponent.
- **Headbutt** is the bread-and-butter combo tool: more damage, slightly more reach, and enough
  knockback to set up a stomp.
- **Stomp** is the commitment. Slow, huge reward (17 damage = ~6 hits of punch), covers the
  **lowest band** (so it can catch a fighter whose hurtbox is low) and causes a knock-down,
  which guarantees a get-up mix-up.

### Combo scaling

Each extra hit in a combo loses 8 % of its damage, capped at 6 hits (−48 %), with a hard floor
of 60 %:

```
scale = max(0.4, 1 - 0.08 * min(hits - 1, 6))
```

So a five-hit punch string does 7 + 6.44 + 5.88 + 5.32 + 4.76 ≈ **29** damage instead of 35 —
combos are worth doing, but they are not free, and a raw stomp (17) is still a big chunk.

### Blocking

- Hold **away** or the Block button while **grounded**.
- A blocked hit deals `chipDamage + (damage − chipDamage) × 0.15` and pushes the defender
  back 130 px.
- Blockstun (170 / 200 / 260 ms) is shorter than the attacker's recovery on punch and headbutt,
  which is what makes those moves safe-ish; the stomp is _not_ safe and can be punished.

---

## 4. Fighter physics

|                | Value                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| Health         | 100                                                                       |
| Walk forward   | 330 px/s                                                                  |
| Walk back      | 250 px/s (retreating is deliberately slower)                              |
| Jump           | 780 ms, arc baked into the art, 130 ms land recovery, reduced air control |
| Hurtbox        | 70 % of body width × 94 % of body height                                  |
| Airborne dodge | above 90 px, attacks whiff                                                |
| Push-apart     | 220 px/s when fighters overlap                                            |
| Knock-down     | 900 ms on the floor, then a 1 s get-up (the die animation reversed)       |

---

## 5. Rounds & match flow

| Rule           | Value                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Clock          | 60 s                                                                                                     |
| Rounds to win  | 2 (best of 3)                                                                                            |
| Hard cap       | 3 rounds — the match can never exceed this                                                               |
| Round intro    | 2.1 s ("Round N / Ready… / FIGHT!")                                                                      |
| Round outro    | 2.6 s                                                                                                    |
| KO slow-motion | 0.25× for 1.1 s                                                                                          |
| Timeout        | Higher health **fraction** wins; exactly level is a **draw** and the round replays with no round awarded |
| Training mode  | No clock, no round wins, health refills — KO just resets positions                                       |

The timeout rule uses the health _fraction_, not the raw number, so if both fighters were given
different max health the judging stays fair.

---

## 6. Scoring

`SCORING` in `src/config/balance.js`:

| Term                                 | Points              |
| ------------------------------------ | ------------------- |
| Health remaining                     | 10 per health point |
| Round won                            | 500 each            |
| Best combo                           | 25 per hit          |
| Time left on the clock (final round) | 5 per second        |
| Perfect (untouched)                  | 750                 |
| Winning the match                    | 1 000               |

The win bonus dominates on purpose: the scoreboard should reward winning, not turtling.
The results screen also shows damage dealt/taken, best combo and **accuracy**
(attacks that connected ÷ attacks thrown).

---

## 7. The AI

`src/entities/AiController.js`

### Behaviour

The brain is a small **plan-based state machine**. It picks a plan, commits to it for one
reaction window, then re-evaluates:

| Plan       | When                                                             | Does                                                                 |
| ---------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `approach` | farther than `spacing + 140`                                     | walk in                                                              |
| `retreat`  | too close, low health, or catching breath                        | walk out                                                             |
| `attack`   | in range / punishing a recovery / won the aggression roll        | queue a move, walk into range, swing                                 |
| `block`    | opponent's attack is telegraphed and the reaction timer is ready | hold block 240–520 ms                                                |
| `jump`     | occasional (profile `jumpChance`)                                | approach from the air                                                |
| `wait`     | otherwise                                                        | hold position — this is what makes the AI feel like it is _thinking_ |

Two details that matter more than they look:

1. **Attack cooldown.** After swinging, the AI cannot queue another attack for
   `attackCooldown` ms. This — not reaction time — is the main difficulty knob, because it
   controls how much pressure the player is under.
2. **Commitment.** The AI blocks for a random 240–520 ms burst rather than a perfect frame-1
   guard, so it can be baited and punished like a human.

### Difficulty profiles

|                                 | Rookie (easy) | Challenger (normal) | Ape King (hard) |
| ------------------------------- | ------------- | ------------------- | --------------- |
| Reaction                        | 820 ms        | 520 ms              | 210 ms          |
| Decision jitter                 | ±360 ms       | ±240 ms             | ±120 ms         |
| Aggression                      | 0.18          | 0.34                | 0.74            |
| Block chance                    | 0.12          | 0.28                | 0.50            |
| Punish chance                   | 0.10          | 0.26                | 0.58            |
| Combo chance                    | 0.04          | 0.16                | 0.46            |
| Preferred spacing               | 600 px        | 480 px              | 350 px          |
| Attack cooldown                 | 1 100 ms      | 620 ms              | 220 ms          |
| Retreat below health            | 22 %          | 28 %                | 34 %            |
| Jump chance                     | 0.04          | 0.08                | 0.13            |
| Move mix (punch/headbutt/stomp) | 68 / 24 / 8   | 50 / 32 / 18        | 34 / 36 / 30    |

Move mix matters: easy throws mostly pokes, hard throws heavies and knocks you down.

### Adaptation ("reads")

On top of the static profile the AI tracks how much of the round you spend **blocking**,
**attacking** and **airborne**, smoothed against a prior so early decisions stay sane:

```
tendency = (observed_ms + prior × 7000) / (total_ms + 7000)
```

Every decision, it rebuilds a `live` profile:

| Read               | Response                                                            | Clamp                                |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------ |
| You block a lot    | Attacks more, and shifts the move mix towards **stomp** (most chip) | aggression 0.08 – 0.9                |
| You attack a lot   | Blocks and punishes more                                            | block 0.05 – 0.85, punish 0.05 – 0.9 |
| You never threaten | Pressures harder                                                    | aggression 0.08 – 0.9                |
| You jump a lot     | Keeps more space, then punishes the landing                         | spacing 320 – 720                    |

Everything is clamped and every adapted value keeps the difficulty ordering
(asserted by `tests/unit/ai.test.mjs`), so adaptation adds personality without ever turning
Rookie into Ape King.

### Measured difficulty

Time for the AI to KO a **completely passive** player (worst case — a real player blocks,
moves and fights back):

| Difficulty | Time to KO (60 s cap) |
| ---------- | --------------------- |
| Rookie     | ~43 s                 |
| Challenger | ~31 s                 |
| Ape King   | ~17 s                 |

---

## 8. Modes

| Mode         | Description                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **Arcade**   | The default: best of 3 against the AI at the chosen difficulty.                                     |
| **Training** | Infinite health, no clock, KO just resets. The HUD shows real damage numbers so you can lab combos. |
| **Gallery**  | Scrub every animation in the library frame by frame, with the frame data on screen.                 |

---

## 9. Accessibility & comfort

| Option                        | Why it exists                                   |
| ----------------------------- | ----------------------------------------------- |
| Screen shake                  | Vestibular comfort; also reduces VFX load       |
| Hitstop on/off                | Some players find freeze frames disorienting    |
| Reduced motion                | Strips parallax, bobbing and camera drift       |
| Colour-blind palette          | Swaps the red/green health bars for blue/orange |
| Particle quality              | Lowers spark/dust counts on weak GPUs           |
| Volume (master / SFX / music) | Independent buses, live-applied                 |
| Show FPS                      | Debug + performance triage                      |

All of these persist in `localStorage` and are applied live from the pause menu.
