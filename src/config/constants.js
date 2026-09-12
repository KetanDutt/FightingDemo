/**
 * Central, dependency free constants shared by every scene and system.
 *
 * Keeping magic numbers in one place makes the game tunable without hunting
 * through the code base, and lets the unit tests assert against the same
 * values the runtime uses.
 */

/* ------------------------------------------------------------------ *
 *  Stage
 * ------------------------------------------------------------------ */

/** Design resolution. Everything is authored against this and scaled to fit. */
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

/** Y coordinate (design space) the fighters stand on. */
export const GROUND_Y = 940;

/** Horizontal bounds the fighters may walk inside. */
export const ARENA = {
  left: 210,
  right: GAME_WIDTH - 210,
  /** Minimum allowed distance between the two fighters. */
  minSeparation: 320,
  /** Starting distance between the fighters at the beginning of a round. */
  startSeparation: 700,
};

/** Uniform scale applied to a fighter container. */
export const FIGHTER_SCALE = 1.0;

/**
 * The sprite sheets were exported from a 1280x720 art board with *trimmed*
 * frames: every frame keeps its position inside that board (see
 * `spriteSourceSize` in the atlas JSON). Some animations (jump, stomp, die)
 * even bake their motion into the frame positions, so we anchor on the art
 * board instead of on the trimmed rectangle.
 */
export const SOURCE_BOARD = { width: 1280, height: 720 };

/** Idle pose metrics, measured from `assets/monkeyMan/idle/texture.json`. */
export const SPRITE_ANCHOR = {
  /** Body centre X inside the source art board (idle bbox: x 53..492). */
  x: 272.5,
  /** Feet Y inside the source art board (idle bbox bottom: 701). */
  y: 701,
  /** Half of the idle body width (439 / 2). */
  halfWidth: 219.5,
  /** Idle body height (701 - 346). */
  height: 355,
};

/**
 * Sprite origin that puts the anchor (body centre + feet) exactly on the
 * container origin, which makes mirroring (`scaleX = -1`) flip the fighter
 * around its own body instead of around the art board.
 */
export const SPRITE_ORIGIN = {
  x: SPRITE_ANCHOR.x / SOURCE_BOARD.width,
  y: SPRITE_ANCHOR.y / SOURCE_BOARD.height,
};

/* ------------------------------------------------------------------ *
 *  Keys
 * ------------------------------------------------------------------ */

export const SCENES = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  MENU: 'Menu',
  SETUP: 'Setup',
  GALLERY: 'Gallery',
  FIGHT: 'Fight',
  HUD: 'Hud',
  PAUSE: 'Pause',
  RESULTS: 'Results',
};

/** Animation keys — these match the folder names in `public/assets/monkeyMan`. */
export const ANIMS = {
  IDLE: 'idle',
  BLOCK: 'block',
  DIE: 'die',
  HEAD: 'head',
  HIT: 'hit',
  JUMP: 'jump',
  MOVE_FORWARD: 'moveForward',
  MOVE_BACK: 'moveBack',
  PUNCH: 'punch',
  STOMP: 'stomp',
};

export const FIGHTER_STATE = {
  IDLE: 'idle',
  WALK_FORWARD: 'walkForward',
  WALK_BACK: 'walkBack',
  JUMP: 'jump',
  PUNCH: 'punch',
  HEADBUTT: 'headbutt',
  STOMP: 'stomp',
  BLOCK: 'block',
  HURT: 'hurt',
  DOWN: 'down',
  GETUP: 'getup',
  KO: 'ko',
  VICTORY: 'victory',
  LOCKED: 'locked',
};

export const ROUND_STATE = {
  INTRO: 'intro',
  FIGHT: 'fight',
  ENDING: 'ending',
  OVER: 'over',
};

export const MODE = {
  ARCADE: 'arcade',
  TRAINING: 'training',
};

export const DIFFICULTY = {
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard',
};

/* ------------------------------------------------------------------ *
 *  Events (global event bus)
 * ------------------------------------------------------------------ */

export const EVENTS = {
  HEALTH_CHANGED: 'health-changed',
  ROUND_START: 'round-start',
  ROUND_END: 'round-end',
  TIMER_CHANGED: 'timer-changed',
  COMBO_CHANGED: 'combo-changed',
  HIT: 'hit',
  BLOCKED: 'blocked',
  KNOCKOUT: 'knockout',
  FIGHTER_STATE: 'fighter-state',
  SETTINGS_CHANGED: 'settings-changed',
  MODE_STARTED: 'mode-started',
};

/* ------------------------------------------------------------------ *
 *  Rendering
 * ------------------------------------------------------------------ */

export const DEPTH = {
  SKY: -100,
  BG_FAR: -90,
  BG_MID: -80,
  BG_NEAR: -70,
  GROUND: -60,
  SHADOW: -10,
  FIGHTER: 0,
  VFX_BACK: 40,
  VFX_FRONT: 60,
  FLOATING_TEXT: 80,
  UI: 120,
  OVERLAY: 200,
  BANNER: 220,
};

export const FONTS = {
  /** Phaser falls back gracefully when a web font is unavailable. */
  PRIMARY: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  DISPLAY: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
};

export const TEXTURE_KEYS = {
  MONKEY: 'monkey',
  JOYPAD: 'joypad',
  NEXT: 'next',
};
