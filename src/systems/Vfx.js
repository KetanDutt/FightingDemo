import Phaser from 'phaser';
import { COLORS } from '../config/palette.js';
import { DEPTH } from '../config/constants.js';
import { FX_TEXTURES } from '../utils/textures.js';

/**
 * Visual effects toolkit.
 *
 * Emitters are created once and reused with `explode()` so a long combo never
 * allocates (or leaks) particle systems. Everything respects the particle
 * quality setting so low end devices can turn the sparkle down.
 */
export class Vfx {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.quality = options.quality ?? 1;
    this.reducedMotion = options.reducedMotion ?? false;

    const scale = this.quality === 0 ? 0 : this.quality === 2 ? 1.6 : 1;
    this.scale = this.reducedMotion ? 0.5 : scale;

    this.#createEmitters();
    this.#createPools();
  }

  #createEmitters() {
    const { scene } = this;

    this.sparks = scene.add
      .particles(0, 0, FX_TEXTURES.spark, {
        lifespan: { min: 180, max: 420 },
        speed: { min: 220, max: 720 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 1, end: 0.2 },
        rotate: { start: 0, end: 180 },
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.VFX_FRONT);

    this.debris = scene.add
      .particles(0, 0, FX_TEXTURES.shard, {
        lifespan: { min: 220, max: 460 },
        speed: { min: 260, max: 900 },
        scale: { start: 0.9, end: 0.1 },
        alpha: { start: 0.9, end: 0 },
        rotate: { start: -20, end: 20 },
        gravityY: 900,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.VFX_FRONT);

    this.dust = scene.add
      .particles(0, 0, FX_TEXTURES.dust, {
        lifespan: { min: 320, max: 700 },
        speed: { min: 40, max: 210 },
        angle: { min: 180, max: 360 },
        scale: { start: 0.5, end: 1.4 },
        alpha: { start: 0.55, end: 0 },
        gravityY: -40,
        emitting: false,
      })
      .setDepth(DEPTH.VFX_BACK);

    this.embers = scene.add
      .particles(0, 0, FX_TEXTURES.dot, {
        lifespan: { min: 500, max: 1100 },
        speed: { min: 30, max: 160 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [COLORS.gold, 0xffffff, COLORS.heavySpark],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.VFX_FRONT);

    this.confetti = scene.add
      .particles(0, 0, FX_TEXTURES.coin, {
        lifespan: { min: 1400, max: 2600 },
        speed: { min: 260, max: 620 },
        angle: { min: 230, max: 310 },
        rotate: { start: 0, end: 360 },
        scale: { min: 0.4, max: 1.1 },
        alpha: { start: 1, end: 0.1 },
        gravityY: 780,
        tint: [COLORS.gold, COLORS.red, COLORS.green, COLORS.blue, 0xffffff],
        emitting: false,
      })
      .setDepth(DEPTH.VFX_FRONT);
  }

  #createPools() {
    const { scene } = this;
    this.rings = Array.from({ length: 6 }, () =>
      scene.add
        .image(0, 0, FX_TEXTURES.ring)
        .setDepth(DEPTH.VFX_FRONT)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
        .setAlpha(0),
    );
    this.flashes = Array.from({ length: 6 }, () =>
      scene.add
        .image(0, 0, FX_TEXTURES.flash)
        .setDepth(DEPTH.VFX_FRONT - 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
        .setAlpha(0),
    );
  }

  #take(pool) {
    return pool.find((item) => !item.visible) ?? pool[0];
  }

  /* --------------------------------- effects -------------------------------- */

  /** Expanding shockwave ring. */
  ring(x, y, options = {}) {
    const {
      color = COLORS.white,
      startScale = 0.2,
      endScale = 1.4,
      duration = 320,
      alpha = 0.9,
    } = options;
    const image = this.#take(this.rings);
    image
      .setVisible(true)
      .setPosition(x, y)
      .setTint(color)
      .setAlpha(alpha)
      .setScale(startScale)
      .setAngle(0);
    this.scene.tweens.killTweensOf(image);
    this.scene.tweens.add({
      targets: image,
      scale: endScale,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => image.setVisible(false),
    });
    return image;
  }

  /** Soft bloom flash, used on every landed hit. */
  flash(x, y, options = {}) {
    const { color = COLORS.white, scale = 1.2, duration = 200, alpha = 0.85 } = options;
    const image = this.#take(this.flashes);
    image
      .setVisible(true)
      .setPosition(x, y)
      .setTint(color)
      .setAlpha(alpha)
      .setScale(scale * 0.6);
    this.scene.tweens.killTweensOf(image);
    this.scene.tweens.add({
      targets: image,
      scale: scale * 1.6,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => image.setVisible(false),
    });
    return image;
  }

  /**
   * Main impact effect.
   * @param {'light'|'medium'|'heavy'|'block'} power
   */
  impact(x, y, options = {}) {
    const { power = 'light', direction = 1, tint = null } = options;
    const count = Math.round({ light: 10, medium: 16, heavy: 26, block: 12 }[power] * this.scale);

    const sparkTint =
      tint ??
      (power === 'block'
        ? COLORS.blockSpark
        : power === 'heavy'
          ? COLORS.heavySpark
          : COLORS.hitSpark);

    if (count > 0) {
      this.sparks.setParticleTint(sparkTint);
      this.sparks.emitParticleAt(x, y, count);
    }

    if (power !== 'block' && this.scale > 0) {
      this.debris.setParticleTint(sparkTint);
      this.debris.emitParticleAt(x, y, Math.round((power === 'heavy' ? 12 : 5) * this.scale));
    }

    this.flash(x, y, {
      color: sparkTint,
      scale: power === 'heavy' ? 1.8 : power === 'medium' ? 1.4 : 1,
      duration: power === 'heavy' ? 260 : 180,
    });

    this.ring(x, y, {
      color: sparkTint,
      endScale: power === 'heavy' ? 2.1 : power === 'medium' ? 1.6 : 1.2,
      duration: power === 'heavy' ? 420 : 300,
    });

    if (power === 'heavy' && !this.reducedMotion) {
      // Swoosh streaks flying off in the attack direction.
      this.debris.setParticleTint(0xffffff);
      this.debris.emitParticleAt(x - direction * 60, y, Math.round(8 * this.scale));
    }
  }

  /** Ground dust for footsteps, dashes and landings. */
  dustPuff(x, y, options = {}) {
    const { amount = 6, direction = 0, scale = 1 } = options;
    const count = Math.round(amount * this.scale);
    if (count <= 0) return;
    this.dust.setParticleTint(COLORS.dust);
    this.dust.emitParticleAt(x - direction * 20, y, count);
    if (scale > 1.2) {
      this.ring(x, y, { color: COLORS.dust, endScale: scale, duration: 420, alpha: 0.35 });
    }
  }

  /** Big celebratory burst (KO, round win). */
  burst(x, y, options = {}) {
    const { count = 24, tint = COLORS.gold } = options;
    this.embers.setParticleTint(tint);
    this.embers.emitParticleAt(x, y, Math.round(count * this.scale));
    this.ring(x, y, { color: tint, endScale: 3, duration: 620, alpha: 0.8 });
  }

  /** Confetti shower for the results screen / match win. */
  celebrate(x, y, count = 40) {
    if (this.scale <= 0) return;
    this.confetti.emitParticleAt(x, y, Math.round(count * this.scale));
  }

  /**
   * Leaves a fading copy of the fighter's current frame behind it.
   * @param {Phaser.GameObjects.Container} container
   * @param {Phaser.GameObjects.Sprite} sprite
   */
  afterimage(container, sprite, options = {}) {
    if (this.scale <= 0) return null;
    const { tint = 0xffffff, alpha = 0.4, duration = 260 } = options;
    const ghost = this.scene.add
      .image(0, 0, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scaleX, sprite.scaleY)
      .setTint(tint)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD);
    container.addAt(ghost, 0);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy(),
    });
    return ghost;
  }

  destroy() {
    [this.sparks, this.debris, this.dust, this.embers, this.confetti].forEach((emitter) =>
      emitter?.destroy(),
    );
    [...this.rings, ...this.flashes].forEach((image) => image?.destroy());
  }
}
