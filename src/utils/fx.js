import Phaser from 'phaser';

/**
 * Reusable tween snippets.
 *
 * Every helper is defensive about destroyed objects (tweens can easily
 * outlive the object they animate when a scene shuts down mid-transition).
 */

const alive = (target) => Boolean(target && target.scene && target.active !== false);

/** Scale-up entrance with a springy overshoot. */
export function popIn(target, options = {}) {
  if (!alive(target)) return null;
  const {
    from = 0.6,
    to = target.scaleX ?? 1,
    duration = 280,
    delay = 0,
    ease = 'Back.easeOut',
  } = options;

  target.setScale(from);
  target.setAlpha(options.fromAlpha ?? 1);
  return target.scene.tweens.add({
    targets: target,
    scaleX: to,
    scaleY: to,
    alpha: options.toAlpha ?? 1,
    duration,
    delay,
    ease,
  });
}

/** Scale-down exit; returns a promise-ish tween. */
export function popOut(target, options = {}) {
  if (!alive(target)) return null;
  const { duration = 180, delay = 0, to = 0.7, ease = 'Back.easeIn', destroy = false } = options;
  return target.scene.tweens.add({
    targets: target,
    scaleX: to,
    scaleY: to,
    alpha: 0,
    duration,
    delay,
    ease,
    onComplete: () => {
      if (destroy && alive(target)) target.destroy();
    },
  });
}

/** Quick "thump" — great for buttons, counters and banners. */
export function pulse(target, options = {}) {
  if (!alive(target)) return null;
  const { amount = 1.12, duration = 130, baseScale = target.scaleX ?? 1 } = options;
  return target.scene.tweens.add({
    targets: target,
    scaleX: baseScale * amount,
    scaleY: baseScale * amount,
    duration,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => {
      if (alive(target)) target.setScale(baseScale);
    },
  });
}

/** Idle breathing/bobbing loop. */
export function bob(target, options = {}) {
  if (!alive(target)) return null;
  const { offset = -14, duration = 1600, ease = 'Sine.easeInOut' } = options;
  const baseY = target.y;
  return target.scene.tweens.add({
    targets: target,
    y: baseY + offset,
    duration,
    ease,
    yoyo: true,
    repeat: -1,
  });
}

/** Gentle infinite rotation (sparks, coins, loading rings). */
export function spin(target, options = {}) {
  if (!alive(target)) return null;
  const { duration = 2000, direction = 1 } = options;
  return target.scene.tweens.add({
    targets: target,
    angle: 360 * direction,
    duration,
    repeat: -1,
    ease: 'Linear',
  });
}

/** Slides + fades an object into place. */
export function slideIn(target, options = {}) {
  if (!alive(target)) return null;
  const { from = 60, axis = 'y', duration = 320, delay = 0, ease = 'Cubic.easeOut' } = options;
  const base = axis === 'x' ? target.x : target.y;
  const start = base + from;
  if (axis === 'x') target.x = start;
  else target.y = start;
  target.setAlpha(0);
  return target.scene.tweens.add({
    targets: target,
    [axis]: base,
    alpha: 1,
    duration,
    delay,
    ease,
  });
}

export function fadeIn(target, options = {}) {
  if (!alive(target)) return null;
  const { duration = 220, delay = 0, from = 0 } = options;
  target.setAlpha(from);
  return target.scene.tweens.add({
    targets: target,
    alpha: 1,
    duration,
    delay,
    ease: 'Quad.easeOut',
  });
}

export function fadeOut(target, options = {}) {
  if (!alive(target)) return null;
  const { duration = 220, delay = 0, destroy = false } = options;
  return target.scene.tweens.add({
    targets: target,
    alpha: 0,
    duration,
    delay,
    ease: 'Quad.easeIn',
    onComplete: () => {
      if (destroy && alive(target)) target.destroy();
    },
  });
}

/** Flashes a sprite white (or any colour) for a few frames. */
export function flashTint(sprite, options = {}) {
  if (!alive(sprite)) return null;
  const { color = 0xffffff, duration = 90, clearTint = true } = options;
  sprite.setTintFill(color);
  sprite.scene.time.delayedCall(duration, () => {
    if (!alive(sprite)) return;
    if (clearTint) sprite.clearTint();
  });
  return sprite;
}

/** Horizontal jitter — used for UI elements that take a hit. */
export function shakeObject(target, options = {}) {
  if (!alive(target)) return null;
  const { intensity = 8, duration = 220 } = options;
  const baseX = target.x;
  return target.scene.tweens.add({
    targets: target,
    x: { from: baseX - intensity, to: baseX + intensity },
    duration: Math.max(40, Math.floor(duration / 4)),
    yoyo: true,
    repeat: 3,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      if (alive(target)) target.x = baseX;
    },
  });
}

/** Tweens a numeric property with an `onUpdate` callback (counters, timers). */
export function tweenNumber(scene, options = {}) {
  const { from = 0, to = 1, duration = 400, delay = 0, ease = 'Quad.easeOut', onUpdate } = options;
  const proxy = { value: from };
  return scene.tweens.add({
    targets: proxy,
    value: to,
    duration,
    delay,
    ease,
    onUpdate: () => onUpdate?.(proxy.value),
  });
}

/** Convenience: builds a Phaser colour as a CSS string for Text styles. */
export function toCssColor(color) {
  return `#${Phaser.Display.Color.IntegerToColor(color).color.toString(16).padStart(6, '0')}`;
}
