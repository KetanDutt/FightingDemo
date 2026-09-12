import Phaser from 'phaser';
import { SCENES } from '../config/constants.js';
import { createFxTextures } from '../utils/textures.js';
import { settings } from '../core/Settings.js';

/**
 * Boots the game: paints every procedural texture once, applies global
 * settings and hands over to the loading scene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  create() {
    createFxTextures(this);

    // Match the renderer to the accessibility settings.
    this.cameras.main.setBackgroundColor('#0d1220');
    if (settings.get('reducedMotion')) this.tweens.timeScale = 1.6;

    // Extra pointers so the on-screen D-pad and attack buttons can be used at
    // the same time on touch devices.
    if (this.input.pointerCount < 4) {
      this.input.addPointer(4 - this.input.pointerCount);
    }

    this.scene.start(SCENES.PRELOAD);
  }
}
