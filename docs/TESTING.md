# Testing Guide

## Overview

Monkey Mayhem includes two types of tests:

1. **Unit tests** — pure, Phaser-free math and balance tests run with Node's built-in test runner
2. **Smoke test** — a headless end-to-end test that boots Phaser in jsdom + @napi-rs/canvas and plays a full match

## Running Tests

```bash
# Run all tests (unit + smoke)
npm test

# Unit tests only
npm run test:unit

# Smoke test only
npm run test:smoke
```

## Unit Tests

Located in `tests/unit/`. Each file is a self-contained Node test module:

| File               | What it tests                                                              |
| ------------------ | -------------------------------------------------------------------------- |
| `math.test.mjs`    | clamp, lerp, weightedPick, naturalCompare, formatAccuracy, formatClock     |
| `balance.test.mjs` | damageScale, scaledDamage, chipDamage, boxesOverlap, judgeTimeout          |
| `ai.test.mjs`      | AI profile validation, weightedPick against all profiles                   |
| `assets.test.mjs`  | Animation data integrity, texture keys exist, all atlas folders referenced |

### Writing a New Unit Test

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clamp } from '../../src/utils/math.js';

describe('my feature', () => {
  it('does the thing', () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
  });
});
```

## Smoke Test

`tests/smoke.test.mjs` boots the full game in a headless environment:

1. Creates a Phaser game instance with jsdom + @napi-rs/canvas
2. Waits for the Preload scene to finish
3. Navigates to Menu → Setup → Fight
4. Simulates keyboard input for both fighters
5. Runs until a round ends (KO or timeout)
6. Asserts health changed, combos registered, and the round completed

### What the Smoke Test Validates

- All scenes boot without errors
- Sprite atlases load correctly
- Animations play without crashing
- Combat system resolves hits
- AI can make decisions and attack
- Event bus propagates health/combo/timer events
- Round state machine completes
- Blocks chip exactly the documented amount — including the heavy stomp, through both the
  direct and the live combat path

## Continuous Integration

To run tests in CI:

```yaml
# GitHub Actions example
- run: npm ci
- run: npm test
```

Requirements: Node.js ≥ 18, @napi-rs/canvas (native dependency).

## Code Coverage

Currently not configured. To add:

```bash
npm install -D c8
npx c8 node --test "tests/unit/*.test.mjs"
```

## Manual Testing Checklist

- [ ] Game boots on Chrome, Firefox, Safari
- [ ] Mobile touch controls work (portrait and landscape)
- [ ] Gamepad connects and maps correctly
- [ ] Settings persist across page reloads
- [ ] Audio plays after first user interaction
- [ ] Tab switching pauses the game
- [ ] Training mode infinite health works (both dummy modes: spars back / stands still)
- [ ] All 6 skin colours render correctly
- [ ] Gallery scrubs every animation
- [ ] FPS counter shows when enabled
- [ ] Settings sliders land where tapped (not pinned to 100 %)
- [ ] Match-point banner + glowing pip appear on the deciding round
- [ ] Pause QUIT asks for confirmation before leaving
- [ ] Blocked hits chip exactly 1 / 1.5 / 2 (punch / headbutt / stomp)
