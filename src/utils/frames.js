import { ANIMS, SPRITE_ANCHOR, TEXTURE_KEYS } from '../config/constants.js';
import { naturalCompare } from './math.js';
import { ANIMATION_DATA } from '../data/animations.js';

/**
 * Returns every frame name of a texture atlas, ordered the way the artist
 * numbered them.
 *
 * The exported atlases are *not* in frame order (free-tex-packer writes
 * whatever order it likes), so sorting is mandatory — otherwise animations
 * play as a random slideshow.
 */
export function sortedFrameNames(scene, textureKey) {
  const texture = scene.textures.get(textureKey);
  if (!texture || texture.key === '__MISSING' || texture.key === '__DEFAULT') return [];
  return texture.getFrameNames().sort(naturalCompare);
}

/**
 * Registers every monkey animation.
 *
 * Explicit frame lists are used (instead of letting Phaser guess) so the
 * timing and ordering are deterministic regardless of atlas version.
 */
export function createAnimations(scene) {
  ANIMATION_DATA.forEach((definition) => {
    const key = definition.key;
    const textureKey = `${TEXTURE_KEYS.MONKEY}-${key}`;
    if (scene.anims.exists(key)) return;

    const frames = sortedFrameNames(scene, textureKey).map((frame) => ({
      key: textureKey,
      frame,
    }));

    if (frames.length === 0) {
      console.warn(`[animations] no frames found for "${textureKey}"`);
      return;
    }

    scene.anims.create({
      key,
      frames,
      frameRate: definition.frameRate,
      repeat: definition.loop ? -1 : 0,
      repeatDelay: definition.repeatDelay ?? 0,
    });
  });
}

/**
 * Reads the artist's intent for the frame currently displayed.
 *
 * Frames are trimmed exports of a 1280x720 board and keep their position in
 * it (`spriteSourceSize`). Several animations (jump, stomp, die) bake motion
 * into those positions, so gameplay has to read them back to know where the
 * body actually is this frame.
 *
 * @returns {{offsetX:number, feetOffsetY:number, halfWidth:number, height:number}}
 *          Offsets are relative to the fighter anchor (body centre + feet).
 */
export function getFrameBody(sprite) {
  const fallback = {
    offsetX: 0,
    feetOffsetY: 0,
    halfWidth: SPRITE_ANCHOR.halfWidth,
    height: SPRITE_ANCHOR.height,
  };

  const frame = sprite?.frame;
  const sss = frame?.data?.spriteSourceSize;
  if (!sss || typeof sss.x !== 'number') return fallback;

  return {
    offsetX: sss.x + sss.w / 2 - SPRITE_ANCHOR.x,
    feetOffsetY: sss.y + sss.h - SPRITE_ANCHOR.y,
    halfWidth: sss.w / 2,
    height: sss.h,
  };
}

/** Convenience: all animation keys in gallery order. */
export const ANIMATION_KEYS = Object.values(ANIMS);
