import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIMATION_DATA } from '../../src/data/animations.js';
import { SPRITE_ANCHOR, SOURCE_BOARD } from '../../src/config/constants.js';
import { naturalCompare } from '../../src/utils/math.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const assetsRoot = path.resolve(here, '..', '..', 'public', 'assets', 'monkeyMan');

/**
 * These tests guard the asset contract the runtime depends on:
 *  - every animation has an atlas + texture
 *  - frame names can be ordered numerically (the JSON is not stored in order)
 *  - every frame keeps its position on the 1280x720 art board
 */
test('every documented animation has an atlas on disk', () => {
  ANIMATION_DATA.forEach(({ key }) => {
    const folder = path.join(assetsRoot, key);
    assert.ok(fs.existsSync(folder), `missing atlas folder for "${key}"`);
    assert.ok(fs.existsSync(path.join(folder, 'texture.png')), `missing texture.png for "${key}"`);
    assert.ok(
      fs.existsSync(path.join(folder, 'texture.json')),
      `missing texture.json for "${key}"`,
    );
  });
});

test('atlas frames can be ordered numerically', () => {
  ANIMATION_DATA.forEach(({ key }) => {
    const json = JSON.parse(fs.readFileSync(path.join(assetsRoot, key, 'texture.json'), 'utf8'));
    const names = Object.keys(json.frames);
    assert.ok(names.length > 0, `"${key}" has frames`);

    const sorted = [...names].sort(naturalCompare);
    const numbers = sorted.map((name) => Number(/(\d+)(?!.*\d)/.exec(name)?.[1] ?? 0));
    const ascending = numbers.every((value, index) => index === 0 || value >= numbers[index - 1]);
    assert.ok(ascending, `"${key}" frames sort into animation order`);

    // The exported atlases are NOT stored in order — that is exactly why the
    // game sorts them at runtime.
    assert.notDeepEqual(names, sorted, `"${key}" raw order differs from sorted order`);
  });
});

test('every frame keeps its art board position (trimmed exports)', () => {
  ANIMATION_DATA.forEach(({ key }) => {
    const json = JSON.parse(fs.readFileSync(path.join(assetsRoot, key, 'texture.json'), 'utf8'));
    Object.entries(json.frames).forEach(([name, frame]) => {
      assert.equal(frame.sourceSize.w, SOURCE_BOARD.width, `${key}/${name} source width`);
      assert.equal(frame.sourceSize.h, SOURCE_BOARD.height, `${key}/${name} source height`);
      assert.equal(frame.rotated, false, `${key}/${name} is not rotated`);
      assert.ok(
        frame.spriteSourceSize,
        `${key}/${name} keeps spriteSourceSize (used for hit boxes)`,
      );
    });
  });
});

test('the idle pose matches the anchor constants used by the fighter', () => {
  const json = JSON.parse(fs.readFileSync(path.join(assetsRoot, 'idle', 'texture.json'), 'utf8'));
  const first = Object.values(json.frames)[0].spriteSourceSize;
  assert.equal(first.x + first.w / 2, SPRITE_ANCHOR.x, 'body centre X');
  assert.equal(first.y + first.h, SPRITE_ANCHOR.y, 'feet Y');
  assert.equal(first.w / 2, SPRITE_ANCHOR.halfWidth, 'half width');
  assert.equal(first.h, SPRITE_ANCHOR.height, 'body height');
});

test('static UI art is present', () => {
  ['joypad.png', 'next.png'].forEach((file) => {
    assert.ok(fs.existsSync(path.resolve(assetsRoot, '..', file)), `${file} exists`);
  });
});
