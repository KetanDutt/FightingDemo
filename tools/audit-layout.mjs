/**
 * Layout audit (debug tool).
 *
 * Boots the real game headlessly (jsdom + @napi-rs/canvas), walks every scene
 * and reports visible UI whose world bounds fall outside the 1920x1080 design
 * canvas — i.e. text/controls that are drawn below the canvas edge or clipped
 * by it. Also dumps a PNG screenshot of each audited scene into
 * `.layout-audit/` so the frames can be inspected visually.
 *
 * Trimmed sprites, background art and particle layers are skipped: their
 * bounds legitimately bleed past the canvas (empty atlas space, glow art).
 *
 * Run: node tools/audit-layout.mjs
 */
import fs from 'node:fs';
import { createHeadlessEnvironment, wait, waitFor } from '../tests/helpers/headless.mjs';

const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const TOLERANCE = 1; // px of slack before we call something "out of bounds"
const OUT_DIR = '.layout-audit';

const { cleanup } = await createHeadlessEnvironment();

const game = (await import('../src/main.js')).default;

await waitFor(() => game.isRunning, { label: 'game boot', timeout: 30000 });
await waitFor(() => game.scene.isActive('Menu'), { label: 'menu scene', timeout: 30000 });
await wait(800); // let entrance tweens settle

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];

const isArt = (obj) => obj.type === 'Sprite' || obj.type === 'Image';

/** Containers whose visible children are all art (e.g. fighter previews). */
const isArtContainer = (obj) =>
  obj.type === 'Container' &&
  (obj.list ?? []).every((child) => !child.visible || isArt(child) || isArtContainer(child));

function auditScene(scene, label) {
  if (!scene || !scene.sys.isActive()) {
    results.push({ label, skipped: true });
    return;
  }
  const offenders = [];
  for (const obj of scene.children.list) {
    if (!obj || !obj.getBounds || !obj.visible || obj.alpha === 0) continue;
    if (isArt(obj) || isArtContainer(obj) || obj.type === 'ParticleEmitter') continue;
    let bounds;
    try {
      bounds = obj.getBounds();
    } catch {
      continue;
    }
    if (!bounds || !Number.isFinite(bounds.width + bounds.height + bounds.x + bounds.y)) continue;
    // Text with no content has zero size — skip.
    if (bounds.width === 0 && bounds.height === 0) continue;
    const overflows = {
      top: -bounds.y,
      left: -bounds.x,
      bottom: bounds.y + bounds.height - GAME_HEIGHT,
      right: bounds.x + bounds.width - GAME_WIDTH,
    };
    const worst = Object.entries(overflows).filter(([, amount]) => amount > TOLERANCE);
    if (worst.length === 0) continue;
    offenders.push({
      type: obj.type,
      text: obj.text !== undefined ? String(obj.text).slice(0, 48) : undefined,
      bounds: {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        w: Math.round(bounds.width),
        h: Math.round(bounds.height),
      },
      overflow: Object.fromEntries(
        Object.entries(overflows).map(([k, v]) => [k, Math.round(v * 10) / 10]),
      ),
    });
  }
  results.push({ label, offenders });

  // Screenshot of the last rendered frame. The rAF loop in jsdom renders
  // continuously — do NOT call `game.loop.step()` here, it corrupts the
  // TimeStep clock and freezes scene delayed-calls.
  const canvas = document.querySelector('#game canvas');
  const napi = canvas?.__napiCanvas;
  if (napi) {
    fs.writeFileSync(
      `${OUT_DIR}/${label.replace(/[^\w-]+/g, '_')}.png`,
      napi.toBuffer('image/png'),
    );
  }
}

/** Sorts offenders by how far past the bottom edge they sit (worst first). */
const worstFirst = (a, b) => (b.overflow.bottom ?? 0) - (a.overflow.bottom ?? 0);
const print = (label) => {
  console.log(`\n=== ${label} ===`);
  const entry = results.find((r) => r.label === label);
  if (!entry || entry.skipped) {
    console.log('  (scene not active — skipped)');
    return;
  }
  if (entry.offenders.length === 0) {
    console.log('  ✓ all visible objects inside the canvas');
    return;
  }
  entry.offenders.sort(worstFirst).forEach((o) => {
    const where = Object.entries(o.overflow)
      .filter(([, amount]) => amount > TOLERANCE)
      .map(([edge, amount]) => `${edge} +${amount}px`)
      .join(', ');
    console.log(
      `  ✗ [${o.type}]${o.text ? ` "${o.text}"` : ''} @ (${o.bounds.x},${o.bounds.y}) ${o.bounds.w}x${o.bounds.h} → ${where}`,
    );
  });
};

// 1. Menu (with the settings panel open, since that is part of the layout too)
const menu = game.scene.getScene('Menu');
auditScene(menu, 'Menu');
menu.settingsPanel?.open();
await wait(600);
auditScene(menu, 'Menu-settings-open');
menu.settingsPanel?.close();
await wait(400);

// 2. Setup (arcade + training layouts differ)
menu.scene.start('Setup', { mode: 'arcade' });
await waitFor(() => game.scene.isActive('Setup'), { label: 'setup scene', timeout: 15000 });
await wait(900);
let setup = game.scene.getScene('Setup');
auditScene(setup, 'Setup-arcade');
setup.scene.start('Setup', { mode: 'training' });
await wait(900);
setup = game.scene.getScene('Setup');
auditScene(setup, 'Setup-training');

// 3. Gallery
setup.scene.start('Gallery');
await waitFor(() => game.scene.isActive('Gallery'), { label: 'gallery scene', timeout: 15000 });
await wait(900);
auditScene(game.scene.getScene('Gallery'), 'Gallery');

// 4. Fight + HUD + Pause (wait until the round is live so banners exist)
game.scene.getScene('Gallery').scene.start('Fight', { mode: 'arcade', difficulty: 'normal' });
await waitFor(() => game.scene.isActive('Fight'), { label: 'fight scene', timeout: 15000 });
await waitFor(() => game.scene.isActive('Hud'), { label: 'hud scene', timeout: 10000 });
const fight = game.scene.getScene('Fight');
await waitFor(() => fight.roundState === 'fight', { label: 'round live', timeout: 20000 });
await wait(600);
auditScene(fight, 'Fight');
auditScene(game.scene.getScene('Hud'), 'Hud');

// Pause overlay (settings panel inside it is compact)
fight.togglePause();
await waitFor(() => game.scene.isActive('Pause'), { label: 'pause scene', timeout: 10000 });
await wait(500);
const pause = game.scene.getScene('Pause');
auditScene(pause, 'Pause');
pause.settingsPanel?.open();
await wait(400);
auditScene(pause, 'Pause-settings-open');

// 5. Results — close the overlays and jump straight to the results scene
game.scene.stop('Pause');
game.scene.resume('Fight');
await wait(300);
fight.scene.start('Results', {
  winner: 'player',
  score: 4210,
  rounds: { player: 2, enemy: 1 },
  matchStats: {
    damageDealt: 180,
    damageTaken: 140,
    maxCombo: 4,
    knockouts: 2,
    attacksLanded: 22,
    attacksThrown: 30,
  },
  config: {
    mode: 'arcade',
    difficulty: 'normal',
    roundCount: 'bo5',
    playerSkin: 'classic',
    enemySkin: 'ember',
    dummy: 'cpu',
  },
});
await waitFor(() => game.scene.isActive('Results'), { label: 'results scene', timeout: 15000 });
await wait(1400); // score count-up + buttons
auditScene(game.scene.getScene('Results'), 'Results');

// ---------------------------------------------------------------- summary --
const total = results.reduce(
  (sum, entry) => sum + (entry.offenders ? entry.offenders.length : 0),
  0,
);
results.forEach((entry) => print(entry.label));
console.log(`\n${total} offending object(s) found. Screenshots in ${OUT_DIR}/\n`);

await wait(200);
cleanup();
process.exit(total > 0 ? 1 : 0);
