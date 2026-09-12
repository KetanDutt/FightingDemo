import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from './config/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { SetupScene } from './scenes/SetupScene.js';
import { GalleryScene } from './scenes/GalleryScene.js';
import { FightScene } from './scenes/FightScene.js';
import { HudScene } from './scenes/HudScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { audio } from './audio/index.js';
import { settings } from './core/Settings.js';

/**
 * Game configuration.
 *
 * The stage is authored at 1920x1080 and scaled with `FIT` so every device
 * shows the whole arena; `CENTER_BOTH` keeps it centred in the viewport.
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d1220',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
    // Keeps sprites crisp when the browser window is scaled up.
    pixelArt: false,
  },
  input: {
    activePointers: 4, // multi-touch: d-pad + two buttons at once
    gamepad: true,
    keyboard: true,
    mouse: true,
    touch: true,
  },
  dom: { createContainer: false },
  disableContextMenu: true,
  audio: { noAudio: false },
  banner: false,
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    SetupScene,
    GalleryScene,
    FightScene,
    HudScene,
    PauseScene,
    ResultsScene,
  ],
};

const game = new Phaser.Game(config);

/** Removes the HTML splash screen once Phaser has produced its first frame. */
function hideSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 500);
}

game.events.once(Phaser.Core.Events.READY, hideSplash);
window.setTimeout(hideSplash, 4000); // safety net if WebGL fails to initialise

/**
 * Audio may only start after a user gesture. Any of these counts, and the
 * handler removes itself so the game does not keep listening forever.
 */
function unlockAudio() {
  audio.unlock();
  if (game.scene.isActive(SCENES.MENU)) audio.playMusic('menu');
}
['pointerdown', 'keydown', 'touchstart'].forEach((event) => {
  window.addEventListener(event, unlockAudio, { once: true, passive: true });
});

/** Suspend audio while the tab is in the background. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else audio.resume();
});

window.addEventListener('blur', () => audio.suspend());
window.addEventListener('focus', () => audio.resume());

// Small debug surface: handy in the console and used by the smoke tests.
window.MonkeyMayhem = {
  game,
  settings,
  get scene() {
    return game.scene.getScenes(true)[0] ?? null;
  },
};

export default game;
