import Phaser from 'phaser';

/**
 * Collects player intent from keyboard, touch controls and gamepad into a
 * single, controller agnostic structure:
 *
 *   { moveX: -1|0|1, jump: bool, block: bool, attack: 'punch'|'headbutt'|'stomp'|null }
 *
 * `jump` and `attack` are edge triggered (one frame), `block` and `moveX` are
 * levels (held).
 */
export class InputManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.onPause = options.onPause ?? null;

    this.moveLeft = false;
    this.moveRight = false;
    this.blockHeld = false;
    this.jumpQueued = false;
    this.attackQueue = [];
    this.enabled = true;

    // Gamepad state is polled once per frame; `null` means "not connected".
    this.padLeft = false;
    this.padRight = false;
    this.padBlock = false;
    this.padUp = false;
    this.padA = false;
    this.padX = false;
    this.padY = false;

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys({
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        d: Phaser.Input.Keyboard.KeyCodes.D,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        s: Phaser.Input.Keyboard.KeyCodes.S,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
        j: Phaser.Input.Keyboard.KeyCodes.J,
        k: Phaser.Input.Keyboard.KeyCodes.K,
        l: Phaser.Input.Keyboard.KeyCodes.L,
        z: Phaser.Input.Keyboard.KeyCodes.Z,
        x: Phaser.Input.Keyboard.KeyCodes.X,
        c: Phaser.Input.Keyboard.KeyCodes.C,
      });

      keyboard.on('keydown-W', this.#queueJump, this);
      keyboard.on('keydown-UP', this.#queueJump, this);
      keyboard.on('keydown-SPACE', this.#queueJump, this);

      keyboard.on('keydown-J', () => this.queueAttack('punch'));
      keyboard.on('keydown-Z', () => this.queueAttack('punch'));
      keyboard.on('keydown-K', () => this.queueAttack('headbutt'));
      keyboard.on('keydown-X', () => this.queueAttack('headbutt'));
      keyboard.on('keydown-L', () => this.queueAttack('stomp'));
      keyboard.on('keydown-C', () => this.queueAttack('stomp'));

      keyboard.on('keydown-ESC', this.#requestPause, this);
      keyboard.on('keydown-P', this.#requestPause, this);
    }

    this.onDestroy = () => this.dispose();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onDestroy);
  }

  #queueJump() {
    if (this.enabled) this.jumpQueued = true;
  }

  #requestPause() {
    this.onPause?.();
  }

  /** Queues an attack (also used by the touch buttons). */
  queueAttack(name) {
    if (!this.enabled) return;
    if (this.attackQueue.length < 2) this.attackQueue.push(name);
  }

  /** Touch d-pad hook. */
  setTouchDirection(direction, isDown) {
    if (direction === 'left') this.moveLeft = isDown;
    if (direction === 'right') this.moveRight = isDown;
    if (direction === 'up' && isDown) this.jumpQueued = true;
    if (direction === 'down') this.blockHeld = isDown;
  }

  /** Touch action button hook. */
  setTouchAction(action, isDown) {
    if (action === 'block') {
      this.blockHeld = isDown;
      return;
    }
    if (isDown) this.queueAttack(action);
  }

  /** Polls the gamepad (Phaser exposes it through `scene.input.gamepad`). */
  update() {
    const pad = this.scene.input?.gamepad?.getPad?.(0);
    if (!pad) return;

    const axisX = pad.leftStick?.x ?? 0;
    this.padLeft = axisX < -0.35 || Boolean(pad.left);
    this.padRight = axisX > 0.35 || Boolean(pad.right);
    this.padBlock = Boolean(pad.down || pad.B || pad.R1 || pad.R2);

    if (pad.up && !this.padUp) this.jumpQueued = true;
    if (pad.A && !this.padA) this.queueAttack('punch');
    if (pad.X && !this.padX) this.queueAttack('headbutt');
    if (pad.Y && !this.padY) this.queueAttack('stomp');

    this.padUp = Boolean(pad.up);
    this.padA = Boolean(pad.A);
    this.padX = Boolean(pad.X);
    this.padY = Boolean(pad.Y);
  }

  /** Reads and consumes the current intent. Call once per frame. */
  read() {
    const keys = this.keys;
    let left = this.moveLeft || this.padLeft;
    let right = this.moveRight || this.padRight;
    let block = this.blockHeld || this.padBlock;

    if (keys) {
      if (keys.left.isDown || keys.a.isDown) left = true;
      if (keys.right.isDown || keys.d.isDown) right = true;
      if (keys.s.isDown || keys.down.isDown) block = true;
    }

    const intent = {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      jump: this.jumpQueued,
      block,
      attack: this.attackQueue.shift() ?? null,
    };

    this.jumpQueued = false;
    this.attackQueue.length = 0;
    return intent;
  }

  /** Clears held state (used when the scene is paused / focus lost). */
  clear() {
    this.moveLeft = false;
    this.moveRight = false;
    this.blockHeld = false;
    this.jumpQueued = false;
    this.attackQueue.length = 0;
    this.padLeft = false;
    this.padRight = false;
    this.padBlock = false;
  }

  dispose() {
    const keyboard = this.scene?.input?.keyboard;
    if (keyboard) {
      keyboard.off('keydown-W', this.#queueJump, this);
      keyboard.off('keydown-UP', this.#queueJump, this);
      keyboard.off('keydown-SPACE', this.#queueJump, this);
      keyboard.off('keydown-ESC', this.#requestPause, this);
      keyboard.off('keydown-P', this.#requestPause, this);
    }
    if (this.scene?.events)
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onDestroy, this);
  }
}
