import Phaser from 'phaser';
import { settings } from '../core/Settings.js';

/**
 * Camera juice: shake, zoom punches and colour flashes.
 *
 * All of it is gated by the accessibility settings (reduced motion /
 * shake intensity), and shake requests are throttled so rapid multi hits do
 * not stack into an unreadable blur.
 */
export class CameraFx {
  constructor(scene, arena = null) {
    this.scene = scene;
    this.arena = arena;
    this.camera = scene.cameras.main;
    this.lastShake = -Infinity;
    this.zoomTween = null;
  }

  get shakeEnabled() {
    return settings.shakingEnabled;
  }

  /**
   * @param {number} intensity fraction of the screen (0.01 ≈ strong)
   * @param {number} duration ms
   */
  shake(intensity = 0.006, duration = 180) {
    if (!this.shakeEnabled) return;
    const now = this.scene.time.now;
    // Never stack shakes closer than 60ms apart.
    if (now - this.lastShake < 60) return;
    this.lastShake = now;
    const scaled = intensity * settings.get('screenShake');
    this.camera.shake(Math.max(60, duration), Math.min(0.05, scaled));
    this.arena?.reactToShake(Math.min(2, scaled * 120));
  }

  /** Quick push-in then back out. */
  zoomPunch(amount = 1.02, duration = 240) {
    if (settings.get('reducedMotion')) return;
    const base = this.camera.zoom;
    this.zoomTween?.stop();
    this.camera.zoom = base;
    this.zoomTween = this.scene.tweens.add({
      targets: this.camera,
      zoom: base * amount,
      duration: Math.round(duration * 0.35),
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.camera.zoom = base;
        this.zoomTween = null;
      },
    });
  }

  /** Smoothly holds a zoom level (KO replays). */
  zoomTo(value, duration = 600) {
    this.scene.tweens.add({ targets: this.camera, zoom: value, duration, ease: 'Sine.easeInOut' });
  }

  flash(color = 0xffffff, duration = 120, alpha = 0.6) {
    if (settings.get('reducedMotion')) return;
    const rgb = Phaser.Display.Color.IntegerToColor(color);
    this.camera.flash(duration, rgb.red, rgb.green, rgb.blue, false, undefined, alpha);
  }

  fadeOut(duration = 300, color = 0x000000) {
    return new Promise((resolve) => {
      const rgb = Phaser.Display.Color.IntegerToColor(color);
      this.camera.fadeOut(duration, rgb.red, rgb.green, rgb.blue);
      this.camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, resolve);
    });
  }

  fadeIn(duration = 300, color = 0x000000) {
    return new Promise((resolve) => {
      const rgb = Phaser.Display.Color.IntegerToColor(color);
      this.camera.fadeIn(duration, rgb.red, rgb.green, rgb.blue);
      this.camera.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, resolve);
    });
  }
}
