import { settings } from '../core/Settings.js';

/**
 * One-shot vibration for touch devices (`navigator.vibrate`).
 *
 * Silently does nothing on desktop, on browsers without the API, and when
 * reduced motion is on — vibration is motion feedback like any other.
 * @param {number|number[]} pattern milliseconds (or an [on, off, on…] pattern)
 */
export function vibrate(pattern) {
  if (settings.get('reducedMotion')) return false;
  try {
    const navigatorRef = globalThis.navigator;
    if (typeof navigatorRef?.vibrate !== 'function') return false;
    return navigatorRef.vibrate(pattern);
  } catch {
    return false;
  }
}
