import { BLOCK, COMBO } from '../config/balance.js';

/**
 * Pure combat maths, kept free of Phaser so it can be unit tested (and reused
 * by tooling) without booting a renderer.
 */

/**
 * Longer combos hit for less: `1 - 8%` per extra hit, floored at
 * `COMBO.minScale`.
 * @param {number} comboCount 1-based hit count of the current combo
 */
export function damageScale(comboCount) {
  const hits = Math.max(1, Number(comboCount) || 1);
  const scale = 1 - COMBO.scalingPerHit * Math.min(hits - 1, COMBO.scalingCap);
  return Math.max(COMBO.minScale, scale);
}

/** Final damage for a clean hit inside a combo. */
export function scaledDamage(baseDamage, comboCount) {
  return Math.round(baseDamage * damageScale(comboCount) * 10) / 10;
}

/** Damage that leaks through a block. */
export function chipDamage(attack) {
  return attack.chipDamage + (attack.damage - attack.chipDamage) * BLOCK.chipScale || 0;
}

/** Axis aligned overlap test between an attack box and a body box. */
export function boxesOverlap(hitbox, hurtbox) {
  if (!hitbox || !hurtbox) return false;
  const horizontal = Math.abs(hitbox.x - hurtbox.x) <= hitbox.halfWidth + hurtbox.halfWidth;
  const vertical =
    hitbox.y + hitbox.halfHeight > hurtbox.top && hitbox.y - hitbox.halfHeight < hurtbox.bottom;
  return horizontal && vertical;
}

/**
 * Decides the winner when the round timer runs out.
 * @returns {'player'|'enemy'|'draw'}
 */
export function judgeTimeout(playerHealthRatio, enemyHealthRatio) {
  if (playerHealthRatio === enemyHealthRatio) return 'draw';
  return playerHealthRatio > enemyHealthRatio ? 'player' : 'enemy';
}
