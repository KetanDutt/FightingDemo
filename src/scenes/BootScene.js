import Phaser from 'phaser';
import { SCENES } from '../config/constants.js';
import { CSS_COLORS } from '../config/palette.js';
import { createFxTextures } from '../utils/textures.js';
import { loadFonts } from '../utils/fonts.js';

/**
 * Boots the game: waits for the web fonts (so canvas text never flashes a
 * fallback face), paints every procedural texture once, applies global
 * settings and hands over to the loading scene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  async create() {
    await loadFonts();
    createFxTextures(this);
    this.cameras.main.setBackgroundColor(CSS_COLORS.bg);

    // Extra pointers so the on-screen D-pad and attack buttons can be used at
    // the same time on touch devices.
    if (this.input.pointerCount < 4) {
      this.input.addPointer(4 - this.input.pointerCount);
    }

    this.scene.start(SCENES.PRELOAD);
  }
}
