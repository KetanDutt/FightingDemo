import Phaser from 'phaser';

/**
 * Application wide event bus.
 *
 * Scenes are intentionally decoupled: the fight scene emits combat events, the
 * HUD scene renders them. Going through a single emitter keeps that contract
 * explicit and avoids scenes reaching into each other's internals.
 */
export const bus = new Phaser.Events.EventEmitter();

export function emit(event, payload) {
  bus.emit(event, payload);
}

export function on(event, handler, context) {
  bus.on(event, handler, context);
  return () => bus.off(event, handler, context);
}

export function once(event, handler, context) {
  bus.once(event, handler, context);
  return () => bus.off(event, handler, context);
}
