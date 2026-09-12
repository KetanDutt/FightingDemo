import Phaser from 'phaser';
import { audio } from '../audio/index.js';
import { DEPTH } from '../config/constants.js';
import { COLORS } from '../config/palette.js';
import { pulse } from '../utils/fx.js';

/**
 * Keyboard navigation for a group of buttons.
 *
 * Menus in this game are mouse/touch first, but a fighting game should be
 * playable without ever touching the mouse — so every menu gets a focus ring,
 * arrow-key movement (nearest button in the direction pressed, which handles
 * both columns and rows) and ENTER/SPACE to confirm.
 *
 * Usage:
 *
 * ```js
 * this.nav = new MenuNav(this, { items: [buttonA, buttonB], onDestroy: ... });
 * ```
 *
 * Items can be `Button` instances or plain `{ x, y, width, height, activate }`.
 * The helper cleans itself up when the scene shuts down.
 */
export class MenuNav {
  constructor(scene, options = {}) {
    const {
      items = [],
      activateKeys = ['ENTER', 'SPACE'],
      startIndex = 0,
      enabled = true,
    } = options;

    this.scene = scene;
    this.items = items.filter(Boolean);
    this.index = -1;
    this.enabled = enabled;

    this.ring = scene.add
      .graphics()
      .setDepth(DEPTH.UI + 5)
      .setVisible(false);
    this.pulseTween = scene.tweens.add({
      targets: this.ring,
      alpha: { from: 0.45, to: 1 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const keyboard = scene.input?.keyboard;
    this.bindings = [];
    if (keyboard) {
      const bind = (event, handler) => {
        keyboard.on(event, handler);
        this.bindings.push([event, handler]);
      };
      bind('keydown-UP', () => this.move(0, -1));
      bind('keydown-DOWN', () => this.move(0, 1));
      bind('keydown-LEFT', () => this.move(-1, 0));
      bind('keydown-RIGHT', () => this.move(1, 0));
      activateKeys.forEach((key) => bind(`keydown-${key}`, () => this.activate()));
    }

    // Hovering a button with the mouse keeps the ring in sync.
    this.items.forEach((item, index) => {
      if (typeof item !== 'object') return;
      const previous = item.onHover;
      item.onHover = (...args) => {
        previous?.(...args);
        this.focus(index, { silent: true });
      };
    });

    this.shutdownHandler = () => this.dispose();
    scene.events?.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownHandler);

    if (this.items.length) this.focus(startIndex, { silent: true });
  }

  /** @param {number} index @param {{silent?: boolean}} [options] */
  focus(index, { silent = false } = {}) {
    const count = this.items.length;
    if (!count) return;
    const next = ((index % count) + count) % count;
    if (next === this.index) {
      this.#drawRing();
      return;
    }
    this.index = next;
    this.#drawRing();
    const item = this.items[this.index];
    if (item?.scene) pulse(item, { amount: 1.04, duration: 160, baseScale: 1 });
    if (!silent) audio.play('uiHover', { throttleMs: 50 });
  }

  /**
   * Moves focus to the nearest button in the given direction. Rows, columns
   * and L-shaped layouts all work without extra configuration.
   */
  move(dx, dy) {
    if (!this.enabled || this.items.length < 2) return;
    const current = this.items[this.index];
    if (!current) {
      this.focus(0);
      return;
    }

    let bestIndex = -1;
    let bestScore = Infinity;

    this.items.forEach((item, index) => {
      if (index === this.index) return;
      const offsetX = item.x - current.x;
      const offsetY = item.y - current.y;
      const along = offsetX * dx + offsetY * dy;
      if (along <= 24) return; // behind us, or on the same line
      const across = Math.abs(offsetX * dy - offsetY * dx); // perpendicular drift
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0) {
      this.focus(bestIndex);
      return;
    }

    // Nothing that way: wrap to the far end of the list.
    const vertical = dy !== 0;
    const sorted = this.items
      .map((item, index) => ({ index, value: vertical ? item.y : item.x }))
      .sort((a, b) => a.value - b.value);
    this.focus(dy > 0 || dx > 0 ? sorted[0].index : sorted[sorted.length - 1].index);
  }

  activate() {
    if (!this.enabled) return false;
    const item = this.items[this.index];
    if (!item) return false;
    if (typeof item.activate === 'function') return item.activate();
    if (typeof item.onClick === 'function') return item.onClick(item);
    return false;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    this.ring.setVisible(this.enabled && this.index >= 0);
    return this;
  }

  #drawRing() {
    const item = this.items[this.index];
    if (!item || !this.scene?.sys?.isActive?.()) {
      this.ring.setVisible(false);
      return;
    }
    const width = item.width ?? 200;
    const height = item.height ?? 80;
    const radius = Math.min(30, height / 2.4);

    this.ring.clear();
    this.ring.lineStyle(5, COLORS.gold, 0.9);
    this.ring.strokeRoundedRect(
      item.x - width / 2 - 12,
      item.y - height / 2 - 12,
      width + 24,
      height + 24,
      radius + 8,
    );
    this.ring.lineStyle(2, COLORS.gold, 0.28);
    this.ring.strokeRoundedRect(
      item.x - width / 2 - 22,
      item.y - height / 2 - 22,
      width + 44,
      height + 44,
      radius + 14,
    );
    this.ring.setVisible(this.enabled);
  }

  dispose() {
    const keyboard = this.scene?.input?.keyboard;
    if (keyboard) this.bindings.forEach(([event, handler]) => keyboard.off(event, handler));
    this.bindings = [];
    this.pulseTween?.remove?.();
    this.ring?.destroy();
    this.items = [];
  }
}
