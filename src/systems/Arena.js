import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, GROUND_Y } from '../config/constants.js';
import { COLORS } from '../config/palette.js';
import { FX_TEXTURES } from '../utils/textures.js';
import { createRandom } from '../utils/math.js';

/**
 * Procedural jungle arena.
 *
 * The game ships no background art, so the whole stage is painted with
 * Graphics at scene start: a gradient sky, three parallax silhouette layers,
 * a stone floor, light shafts and two ambient particle systems (dust motes
 * and drifting leaves). Nothing here is per-frame expensive — the drifting is
 * done with a handful of long running tweens.
 */
export class Arena {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.random = createRandom(0x5eed42);
    this.layers = [];
    this.reducedMotion = options.reducedMotion ?? false;

    this.#buildSky();
    this.#buildRidges();
    this.#buildGround();
    this.#buildCanopy();
    this.#buildLightShafts();
    this.#buildAmbientParticles();

    this.#startDrift();
  }

  /* ------------------------------ construction ------------------------------ */

  #buildSky() {
    const graphics = this.scene.add.graphics().setDepth(DEPTH.SKY);
    graphics.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Sun bloom behind the ridges.
    const sun = this.scene.add
      .image(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.3, FX_TEXTURES.flash)
      .setDepth(DEPTH.SKY + 1)
      .setTint(COLORS.sunGlow)
      .setAlpha(0.32)
      .setScale(6.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.sun = sun;
    this.layers.push(sun);
  }

  #ridge(width, height, baseY, color, peakHeight, depth, seed) {
    const random = createRandom(seed);
    const graphics = this.scene.add.graphics().setDepth(depth);
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(-60, baseY + height);
    let x = -60;
    graphics.lineTo(x, baseY);
    while (x < width + 120) {
      const step = 90 + random() * 150;
      const peak = baseY - random() * peakHeight;
      x += step;
      graphics.lineTo(x - step * 0.5, peak);
      graphics.lineTo(x, baseY - random() * (peakHeight * 0.35));
    }
    graphics.lineTo(width + 120, baseY + height);
    graphics.closePath();
    graphics.fillPath();
    return graphics;
  }

  #buildRidges() {
    this.farRidge = this.#ridge(
      GAME_WIDTH,
      420,
      GROUND_Y - 130,
      COLORS.ridgeFar,
      300,
      DEPTH.BG_FAR,
      0x1234af,
    );
    this.midRidge = this.#ridge(
      GAME_WIDTH,
      380,
      GROUND_Y - 60,
      COLORS.ridgeMid,
      210,
      DEPTH.BG_MID,
      0x77aa21,
    );

    // Jungle treeline: trunks + canopy blobs.
    const trees = this.scene.add.graphics().setDepth(DEPTH.BG_NEAR);
    const random = createRandom(0xabc123);
    trees.fillStyle(COLORS.ridgeNear, 1);
    for (let i = 0; i < 26; i += 1) {
      const x = -40 + i * (GAME_WIDTH / 24) + random() * 60;
      const trunkHeight = 120 + random() * 130;
      const baseY = GROUND_Y - 20;
      trees.fillRect(x - 5, baseY - trunkHeight, 10, trunkHeight);
      const canopyY = baseY - trunkHeight;
      const radius = 34 + random() * 40;
      trees.fillCircle(x, canopyY, radius * 0.9);
      trees.fillCircle(x - radius * 0.7, canopyY + 18, radius * 0.6);
      trees.fillCircle(x + radius * 0.7, canopyY + 14, radius * 0.62);
      trees.fillCircle(x + radius * 0.2, canopyY - radius * 0.5, radius * 0.55);
    }
    this.nearTrees = trees;

    this.layers.push(this.farRidge, this.midRidge, this.nearTrees);
  }

  #buildGround() {
    const ground = this.scene.add.graphics().setDepth(DEPTH.GROUND);
    ground.fillStyle(COLORS.ground, 1);
    ground.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    ground.fillStyle(COLORS.groundTop, 1);
    ground.fillRect(0, GROUND_Y, GAME_WIDTH, 26);
    ground.lineStyle(4, COLORS.groundLine, 0.85);
    ground.lineBetween(0, GROUND_Y + 2, GAME_WIDTH, GROUND_Y + 2);

    // Flagstones
    const random = createRandom(0x51de);
    ground.lineStyle(2, 0x000000, 0.18);
    for (let row = 0; row < 4; row += 1) {
      const y = GROUND_Y + 40 + row * 34;
      const offset = row % 2 === 0 ? 0 : 70;
      for (let x = -140 + offset; x < GAME_WIDTH + 140; x += 140) {
        ground.strokeRect(x, y, 132, 28);
        if (random() > 0.6) {
          ground.fillStyle(0xffffff, 0.03);
          ground.fillRect(x + 4, y + 4, 124, 20);
        }
      }
    }

    // Vignette so the fighters pop.
    const vignette = this.scene.add.graphics().setDepth(DEPTH.GROUND + 1);
    vignette.fillStyle(0x000000, 0.18);
    vignette.fillRect(0, GROUND_Y + 120, GAME_WIDTH, GAME_HEIGHT - GROUND_Y - 120);
    this.ground = ground;
  }

  #buildCanopy() {
    const canopy = this.scene.add.graphics().setDepth(DEPTH.BG_NEAR + 5);
    const random = createRandom(0x7ea1);
    canopy.fillStyle(0x0a1226, 0.92);
    for (let i = 0; i < 16; i += 1) {
      const x = i * (GAME_WIDTH / 14) + random() * 60 - 40;
      const radius = 70 + random() * 90;
      canopy.fillCircle(x, -20 + random() * 60, radius);
      canopy.fillCircle(x + radius * 0.8, 10 + random() * 40, radius * 0.7);
    }
    this.canopy = canopy;
    this.layers.push(canopy);
  }

  #buildLightShafts() {
    this.shafts = [];
    if (this.reducedMotion) return;
    const graphics = this.scene.add
      .graphics()
      .setDepth(DEPTH.BG_MID + 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.14);
    graphics.fillStyle(0xffe6b0, 1);
    const beams = [
      { x: GAME_WIDTH * 0.24, width: 180 },
      { x: GAME_WIDTH * 0.62, width: 240 },
      { x: GAME_WIDTH * 0.86, width: 150 },
    ];
    beams.forEach((beam) => {
      graphics.beginPath();
      graphics.moveTo(beam.x, -40);
      graphics.lineTo(beam.x + beam.width, -40);
      graphics.lineTo(beam.x + beam.width * 2.4, GROUND_Y + 20);
      graphics.lineTo(beam.x + beam.width * 1.1, GROUND_Y + 20);
      graphics.closePath();
      graphics.fillPath();
    });
    this.shafts.push(graphics);
    this.layers.push(graphics);
  }

  #buildAmbientParticles() {
    if (this.reducedMotion) return;

    this.dust = this.scene.add
      .particles(0, 0, FX_TEXTURES.dot, {
        x: { min: 0, max: GAME_WIDTH },
        y: { min: GROUND_Y - 260, max: GROUND_Y + 40 },
        lifespan: { min: 4000, max: 9000 },
        speedY: { min: -14, max: -4 },
        speedX: { min: -10, max: 10 },
        scale: { start: 0.06, end: 0.02 },
        alpha: { start: 0.35, end: 0 },
        tint: [0xffe6b0, 0xffffff, 0xbfd4ff],
        quantity: 1,
        frequency: 420,
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.BG_NEAR + 8);

    this.leaves = this.scene.add
      .particles(0, 0, FX_TEXTURES.leaf, {
        x: { min: -60, max: GAME_WIDTH + 60 },
        y: -40,
        lifespan: 12000,
        speedY: { min: 18, max: 46 },
        speedX: { min: -26, max: 26 },
        rotate: { start: 0, end: 360 },
        scale: { min: 0.35, max: 0.9 },
        alpha: { start: 0.6, end: 0.15 },
        tint: [0x6fbf73, 0x9ad46b, 0xc9a227],
        quantity: 1,
        frequency: 900,
      })
      .setDepth(DEPTH.VFX_BACK);
  }

  /* -------------------------------- animation -------------------------------- */

  #startDrift() {
    if (this.reducedMotion) return;
    const drift = (target, offset, duration) => {
      this.scene.tweens.add({
        targets: target,
        x: (target.x ?? 0) + offset,
        duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    };

    drift(this.farRidge, -26, 26000);
    drift(this.midRidge, 18, 19000);
    drift(this.nearTrees, -12, 15000);
    drift(this.canopy, 22, 21000);

    this.scene.tweens.add({
      targets: this.sun,
      alpha: { from: 0.24, to: 0.4 },
      scale: { from: 6.2, to: 6.9 },
      duration: 7000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.shafts.forEach((shaft, index) => {
      this.scene.tweens.add({
        targets: shaft,
        alpha: { from: 0.08, to: 0.2 },
        duration: 6000 + index * 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /**
   * Nudges the parallax layers when the camera shakes so the background
   * reacts with a bit of depth instead of moving as one flat image.
   */
  reactToShake(intensity = 1) {
    if (this.reducedMotion) return;
    const offsets = [
      { target: this.farRidge, factor: 0.25 },
      { target: this.midRidge, factor: 0.5 },
      { target: this.nearTrees, factor: 0.85 },
    ];
    offsets.forEach(({ target, factor }) => {
      if (!target) return;
      const base = target.x;
      this.scene.tweens.add({
        targets: target,
        x: base + (Math.random() > 0.5 ? 1 : -1) * 14 * intensity * factor,
        duration: 70,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (target.scene) target.x = base;
        },
      });
    });
  }

  /** Dims the ambient particles while paused. */
  setAmbientPaused(paused) {
    if (this.dust) paused ? this.dust.pause() : this.dust.resume();
    if (this.leaves) paused ? this.leaves.pause() : this.leaves.resume();
  }

  destroy() {
    this.dust?.destroy();
    this.leaves?.destroy();
    this.layers.forEach((layer) => layer?.destroy());
    this.layers.length = 0;
  }
}
