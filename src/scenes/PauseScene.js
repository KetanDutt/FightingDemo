import Phaser from 'phaser';
import { DEPTH, FONTS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants.js';
import { CSS_COLORS } from '../config/palette.js';
import { Button } from '../ui/Button.js';
import { MenuNav } from '../ui/MenuNav.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { popIn, slideIn } from '../utils/fx.js';
import { audio } from '../audio/index.js';
import { settings } from '../core/Settings.js';

/**
 * Pause overlay.
 *
 * The fight scene stays alive (and visible) underneath; this scene only draws
 * the menu and tells the fight what to do when it closes.
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.PAUSE });
  }

  init(data = {}) {
    this.from = data.from ?? SCENES.FIGHT;
  }

  create() {
    this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();

    this.add.graphics().fillStyle(0x05070f, 0.78).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const title = this.add
      .text(GAME_WIDTH / 2, 250, 'PAUSED', {
        fontFamily: FONTS.DISPLAY,
        fontSize: '104px',
        fontStyle: 'bold',
        color: CSS_COLORS.gold,
        stroke: '#1a0f00',
        strokeThickness: 14,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.UI);
    popIn(title, { from: 0.7, to: 1, duration: 320 });

    const buttons = [
      { label: 'RESUME', icon: '▶️', variant: 'primary', action: () => this.#resume() },
      { label: 'RESTART', icon: '🔄', variant: 'ghost', action: () => this.#request('restart') },
      { label: 'SETTINGS', icon: '⚙️', variant: 'ghost', action: () => this.#openSettings() },
      { label: 'QUIT', icon: '🚪', variant: 'danger', action: () => this.#confirmQuit() },
    ];

    const navItems = buttons.map((definition, index) =>
      new Button(this, {
        x: GAME_WIDTH / 2,
        y: 430 + index * 122,
        width: 460,
        height: 96,
        label: definition.label,
        icon: definition.icon,
        fontSize: 38,
        variant: definition.variant,
        onClick: definition.action,
      })
        .setDepth(DEPTH.UI)
        .appear(60 + index * 60),
    );
    this.quitButton = navItems[navItems.length - 1];

    this.nav = new MenuNav(this, { items: navItems });

    const touchMode = settings.get('showTouchControls') || this.sys.game.device.input.touch;
    this.hint = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 130,
        touchMode ? 'Tap RESUME to continue' : 'Press ESC to resume  ·  M to mute',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '30px',
          color: CSS_COLORS.offWhite,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.7)
      .setDepth(DEPTH.UI);
    slideIn(this.hint, { from: 30, duration: 260, delay: 300 });

    // Quick controls recap while the match is stopped.
    this.controlsLine = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 72,
        touchMode
          ? 'D-pad move · ▲ jump · ▼ / BLOCK guard · PUNCH / HEAD / STOMP attack'
          : '← → move · ↑ / Space jump · ↓ block · J punch · K headbutt · L stomp',
        {
          fontFamily: FONTS.PRIMARY,
          fontSize: '26px',
          color: CSS_COLORS.muted,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.75)
      .setDepth(DEPTH.UI);
    slideIn(this.controlsLine, { from: 30, duration: 260, delay: 360 });

    this.settingsPanel = new SettingsPanel(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      height: 700,
      compact: true,
      onClose: () => audio.play('uiBack', { volume: 0.7 }),
    });
    this.settingsPanel.setVisible(false);

    this.input.keyboard?.on('keydown-ESC', () => this.#resume());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
    });
  }

  #openSettings() {
    audio.play('uiClick');
    this.settingsPanel.syncFromSettings().open();
  }

  #resume() {
    if (this.closing) return;
    this.closing = true;
    audio.play('uiBack');
    this.scene.stop();
    this.scene.resume(this.from);
  }

  /**
   * Quitting drops the whole match, so the first click arms the button
   * ("SURE?") and only a second click within 3 seconds follows through.
   */
  #confirmQuit() {
    if (!this.quitArmed) {
      this.quitArmed = true;
      this.quitButton?.setLabel('SURE?');
      audio.play('uiDenied', { volume: 0.8 });
      this.time.delayedCall(3000, () => {
        this.quitArmed = false;
        this.quitButton?.setLabel('QUIT');
      });
      return;
    }
    this.#request('quit');
  }

  /**
   * Hand an action back to the fight scene instead of juggling scene
   * lifecycles from here (a paused scene cannot be safely restarted by
   * another scene).
   */
  #request(action) {
    if (this.closing) return;
    this.closing = true;
    const target = this.scene.get(this.from);
    if (target && 'pendingAction' in target) target.pendingAction = action;
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
