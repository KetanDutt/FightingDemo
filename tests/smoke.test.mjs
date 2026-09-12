/**
 * End to end smoke test.
 *
 * Boots the *real* game (all scenes, real assets, real Phaser) inside jsdom
 * and plays a scripted match:
 *
 *   boot → preload → menu → setup → fight → walking / attacking / blocking
 *        → knockout → pause → match end → results → gallery → menu
 *
 * Run with `npm run test:smoke` (part of `npm test`).
 */
import assert from 'node:assert/strict';
import { createHeadlessEnvironment, wait, waitFor } from './helpers/headless.mjs';
import { ATTACKS } from '../src/config/balance.js';

const { cleanup, errors } = await createHeadlessEnvironment();

const consoleErrors = [];
const originalError = console.error;
console.error = (...args) => {
  const text = args.map(String).join(' ');
  // jsdom has no WebAudio; that path is intentionally exercised so the game
  // degrades gracefully instead of throwing.
  if (!text.includes('audio')) consoleErrors.push(text);
  originalError(...args);
};

let game;
try {
  const module = await import('../src/main.js');
  game = module.default;

  // --- Boot + asset loading -------------------------------------------------
  await waitFor(() => game.isRunning, { label: 'game boot', timeout: 20000 });
  await waitFor(() => game.scene.isActive('Menu'), { label: 'menu scene', timeout: 30000 });

  const menu = game.scene.getScene('Menu');
  assert.ok(menu, 'menu scene exists');
  assert.equal(menu.anims.get('idle').frames.length, 35, 'idle animation has 35 frames');
  assert.equal(menu.anims.get('punch').frames.length, 15, 'punch animation has 15 frames');
  assert.equal(menu.anims.get('stomp').frames.length, 22, 'stomp animation has 22 frames');
  assert.equal(
    menu.anims.get('idle').frames[0].frame.name,
    'Idol_png_0001.png',
    'frames play in order',
  );

  // --- Menu → Setup → Fight -------------------------------------------------
  menu.scene.start('Setup', { mode: 'arcade', difficulty: 'normal' });
  await waitFor(() => game.scene.isActive('Setup'), { label: 'setup scene', timeout: 15000 });

  const setup = game.scene.getScene('Setup');
  assert.ok(setup.playerPreview && setup.enemyPreview, 'setup shows both fighter previews');
  setup.scene.start('Fight', {
    mode: 'arcade',
    difficulty: 'hard',
    playerSkin: 'classic',
    enemySkin: 'ember',
  });
  await waitFor(() => game.scene.isActive('Fight'), { label: 'fight scene', timeout: 15000 });

  const fight = game.scene.getScene('Fight');
  assert.ok(fight.player && fight.enemy, 'both fighters were created');
  assert.equal(fight.player.hp, 100, 'player starts at full health');
  assert.equal(fight.enemy.hp, 100, 'enemy starts at full health');
  assert.ok(Math.abs(fight.enemy.x - fight.player.x - 700) < 2, 'fighters start 700px apart');

  await waitFor(() => game.scene.isActive('Hud'), { label: 'hud scene', timeout: 10000 });
  const hud = game.scene.getScene('Hud');
  assert.ok(hud.playerBar && hud.enemyBar, 'HUD built both health bars');

  // --- The round becomes interactive ----------------------------------------
  await waitFor(() => fight.roundState === 'fight', { label: 'round start', timeout: 15000 });
  assert.equal(fight.roundNumber, 1, 'first round started');

  // --- Movement -------------------------------------------------------------
  const startX = fight.player.x;
  fight.inputManager.moveRight = true;
  await wait(500);
  fight.inputManager.moveRight = false;
  assert.ok(
    fight.player.x > startX + 40,
    `player walks right (moved ${fight.player.x - startX}px)`,
  );

  const walkedX = fight.player.x;
  fight.inputManager.moveLeft = true;
  await wait(500);
  fight.inputManager.moveLeft = false;
  assert.ok(fight.player.x < walkedX - 40, 'player walks back left');

  // --- Attacking ------------------------------------------------------------
  const ai = fight.ai;
  fight.ai = null; // manual control of the opponent for deterministic assertions
  fight.enemy.reset(fight.player.x + 360, -1);
  fight.enemy.hp = 100;

  let connected = false;
  for (let i = 0; i < 30 && !connected; i += 1) {
    fight.inputManager.queueAttack('punch');
    await wait(110);
    if (fight.enemy.hp < 100) connected = true;
  }
  assert.ok(connected, 'a punch in range damages the opponent');

  // --- Blocking -------------------------------------------------------------
  fight.enemy.hp = 100;
  await waitFor(() => fight.enemy.hitstunTimer === 0 && fight.enemy.canAct, {
    label: 'opponent recovers from the punches',
    timeout: 8000,
  });
  fight.enemy.intent = { moveX: 0, jump: false, block: true, attack: null };
  await wait(200);
  assert.equal(fight.enemy.isBlocking, true, 'holding block enters the block state');

  const hpBeforeBlocked = fight.enemy.hp;
  fight.enemy.receiveHit({
    def: ATTACKS.stomp,
    damage: ATTACKS.stomp.damage,
    from: fight.player,
    blocked: true,
  });
  const chip = hpBeforeBlocked - fight.enemy.hp;
  assert.ok(chip > 0 && chip < ATTACKS.stomp.damage * 0.5, `blocked stomp only chips (${chip})`);
  fight.enemy.intent = { moveX: 0, jump: false, block: false, attack: null };

  // --- Knockout, round flow ------------------------------------------------
  fight.enemy.hp = 4;
  for (let i = 0; i < 50 && !fight.enemy.isKO; i += 1) {
    fight.inputManager.queueAttack('stomp');
    await wait(110);
  }
  assert.ok(fight.enemy.isKO, 'a stomp at 4hp knocks the opponent out');

  await waitFor(() => fight.roundWins.player >= 1, { label: 'round awarded', timeout: 15000 });
  assert.equal(fight.roundWins.player, 1, 'player is credited with the round');

  // --- Pause / resume -------------------------------------------------------
  await waitFor(() => fight.roundState === 'fight' && fight.roundNumber === 2, {
    label: 'second round',
    timeout: 25000,
  });
  fight.togglePause();
  await wait(250);
  assert.ok(game.scene.isActive('Pause'), 'pause scene launches');
  assert.ok(game.scene.isPaused('Fight'), 'fight scene is paused');
  const pause = game.scene.getScene('Pause');
  pause.scene.stop();
  pause.scene.resume('Fight');
  await wait(250);
  assert.equal(game.scene.isPaused('Fight'), false, 'fight resumes after pause');

  // --- Win the match --------------------------------------------------------
  fight.ai = ai;
  fight.enemy.hp = 3;
  for (let i = 0; i < 60 && !fight.enemy.isKO; i += 1) {
    fight.inputManager.queueAttack('stomp');
    await wait(110);
  }
  fight.ai = null;
  await waitFor(() => game.scene.isActive('Results'), { label: 'results scene', timeout: 25000 });

  const results = game.scene.getScene('Results');
  assert.equal(results.winner, 'player', 'the player won the match');
  assert.equal(results.rounds.player, 2, 'two rounds were won');
  assert.ok(results.score > 0, 'a score was calculated');

  // --- Rematch --------------------------------------------------------------
  results.scene.start('Fight', results.config);
  await waitFor(() => game.scene.isActive('Fight'), { label: 'rematch', timeout: 15000 });
  assert.equal(game.scene.getScene('Fight').roundWins.player, 0, 'rematch resets the score');

  // --- Training mode --------------------------------------------------------
  const rematch = game.scene.getScene('Fight');
  rematch.scene.start('Fight', { mode: 'training', difficulty: 'normal' });
  // The scene is already active, so wait for the *restart* to take effect.
  await waitFor(() => game.scene.getScene('Fight').matchConfig.mode === 'training', {
    label: 'training',
    timeout: 15000,
  });
  const training = game.scene.getScene('Fight');
  assert.equal(training.matchConfig.mode, 'training', 'training mode is active');
  await waitFor(() => training.roundState === 'fight', { label: 'training round', timeout: 15000 });
  const clockBefore = training.timeLeft;
  await wait(600);
  assert.equal(training.timeLeft, clockBefore, 'the training clock never runs out');

  // --- Gallery --------------------------------------------------------------
  training.scene.start('Gallery');
  await waitFor(() => game.scene.isActive('Gallery'), { label: 'gallery', timeout: 15000 });
  const gallery = game.scene.getScene('Gallery');
  assert.ok(gallery.sprite.anims.currentAnim, 'gallery plays an animation');
  const firstKey = gallery.sprite.anims.currentAnim.key;
  gallery.input.keyboard.emit('keydown-RIGHT');
  await wait(200);
  assert.notEqual(
    gallery.sprite.anims.currentAnim.key,
    firstKey,
    'arrow keys change the animation',
  );

  // --- Back to the menu -----------------------------------------------------
  gallery.scene.start('Menu');
  await waitFor(() => game.scene.isActive('Menu'), { label: 'menu again', timeout: 15000 });

  assert.deepEqual(errors, [], `no asset errors: ${errors.join(', ')}`);
  assert.deepEqual(
    consoleErrors,
    [],
    `no console errors: ${consoleErrors.slice(0, 3).join(' | ')}`,
  );

  console.log('✓ smoke test passed');
} catch (error) {
  console.error = originalError;
  console.error('\n✗ smoke test failed:', error);
  process.exitCode = 1;
} finally {
  console.error = originalError;
  try {
    game?.destroy(true);
  } catch {
    /* ignore */
  }
  await wait(120);
  cleanup();
  process.exit(process.exitCode ?? 0);
}
