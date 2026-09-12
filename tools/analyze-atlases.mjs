#!/usr/bin/env node
/**
 * Asset report.
 *
 * Prints frame counts, atlas sizes and the estimated GPU texture budget of the
 * sprite library, and flags anything that looks off (missing atlases, frames
 * that fall outside the art board, duplicate art).
 *
 * Usage: `npm run analyze:assets`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIMATION_DATA } from '../src/data/animations.js';
import { SOURCE_BOARD, SPRITE_ANCHOR } from '../src/config/constants.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const monkeyRoot = path.join(root, 'public', 'assets', 'monkeyMan');

/** Reads width/height straight out of the PNG header (no dependencies). */
function pngSize(file) {
  const handle = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(24);
    fs.readSync(handle, buffer, 0, 24, 0);
    if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } finally {
    fs.closeSync(handle);
  }
}

const bytes = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const rows = [];
let totalPixels = 0;
let totalFrames = 0;
let totalBytes = 0;
let problems = 0;

for (const definition of ANIMATION_DATA) {
  const folder = path.join(monkeyRoot, definition.key);
  const jsonPath = path.join(folder, 'texture.json');
  const pngPath = path.join(folder, 'texture.png');

  if (!fs.existsSync(jsonPath) || !fs.existsSync(pngPath)) {
    problems += 1;
    rows.push({
      key: definition.key,
      frames: '—',
      atlas: 'MISSING',
      gpu: '—',
      note: 'missing files',
    });
    continue;
  }

  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const frames = Object.values(json.frames);
  const { width, height } = pngSize(pngPath);
  const stat = fs.statSync(pngPath);
  const pixels = width * height;

  totalPixels += pixels;
  totalFrames += frames.length;
  totalBytes += stat.size;

  // Frame data sanity
  const offBoard = frames.filter(
    (frame) =>
      frame.sourceSize.w !== SOURCE_BOARD.width ||
      frame.sourceSize.h !== SOURCE_BOARD.height ||
      frame.rotated !== false,
  ).length;

  const uniqueRects = new Set(
    frames.map((f) => `${f.frame.x},${f.frame.y},${f.frame.w},${f.frame.h}`),
  );
  const duration = (frames.length / definition.frameRate) * 1000;

  if (offBoard > 0) problems += offBoard;

  rows.push({
    key: definition.key,
    frames: `${frames.length} (${uniqueRects.size} unique)`,
    atlas: `${width}x${height}`,
    gpu: bytes(pixels * 4),
    note: `${(duration / 1000).toFixed(2)}s @ ${definition.frameRate}fps${
      offBoard ? ` · ${offBoard} off-board frames` : ''
    }`,
  });
}

const pad = (value, size) => String(value).padEnd(size);
console.log('\nMonkey Mayhem — sprite library report');
console.log('─'.repeat(96));
console.log(
  `${pad('animation', 14)}${pad('frames', 16)}${pad('atlas', 14)}${pad('gpu (rgba)', 12)}notes`,
);
console.log('─'.repeat(96));
rows.forEach((row) => {
  console.log(
    `${pad(row.key, 14)}${pad(row.frames, 16)}${pad(row.atlas, 14)}${pad(row.gpu, 12)}${row.note}`,
  );
});
console.log('─'.repeat(96));
console.log(`total frames: ${totalFrames}`);
console.log(`disk (png):   ${bytes(totalBytes)}`);
console.log(`gpu (rgba):   ${bytes(totalPixels * 4)}  (all atlases uploaded at once)`);
console.log(
  `anchor:       body centre x=${SPRITE_ANCHOR.x}, feet y=${SPRITE_ANCHOR.y} on a ${SOURCE_BOARD.width}x${SOURCE_BOARD.height} board`,
);
console.log(`problems:     ${problems === 0 ? 'none' : problems}`);
console.log('');

process.exit(problems > 0 ? 1 : 0);
