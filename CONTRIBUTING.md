# Contributing

Thanks for taking a look. Before contributing, please read the **[LICENSE](LICENSE)**: this
repository is published for **viewing and evaluation only**. Copying, modification, distribution,
commercial use, and any use of the code or art for training or improving machine-learning/AI
systems are prohibited without prior written permission from the author (© 2026 Ketan Dutt).

If you have been given permission to work on it, here is how to keep the change painless.

## Before you start

```bash
npm install
npm test          # must be green before you touch anything
npm run dev
```

## Ground rules

1. **Tuning goes in `src/config/balance.js`.** Frame data, AI profiles, round rules and scoring are
   data, not code. If you find yourself hard-coding a gameplay number, move it there.
2. **Nothing that must be unit-tested imports Phaser.** Combat maths lives in
   `src/systems/combatMath.js` for exactly this reason.
3. **Scenes communicate over the event bus** (`EVENTS` in `src/config/constants.js`), never by
   reaching into another scene's internals.
4. **Add a test with the change.** Balance/AI changes need a `tests/unit` update; anything that
   could break the boot or a match should be covered by the smoke test.
5. **Run the gates** before pushing:

   ```bash
   npm test
   npm run lint
   npm run format:check
   npm run build
   ```

6. **Comment the why.** Every number in `config/` has a unit and a reason; every non-obvious branch
   has a sentence.

## Style

Prettier (2 spaces, 100 columns, single quotes, semicolons, trailing commas) and ESLint 9 are
configured; `npm run format` and `npm run lint:fix` do the work.

## Commit messages

Short subject line in the imperative mood, then a blank line and an optional body explaining why:

```
fix: keep the AI closing distance on a queued attack

A queued attack expired before the fighter walked into range, so easy
difficulty could go a whole round without landing a hit.
```

## Where things live

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map and
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the day-to-day workflow, including how to add an
attack, a scene or a character.
