import { COMBO, FIGHTER_STATS } from '../config/balance.js';
import { EVENTS, GROUND_Y } from '../config/constants.js';
import { CSS_COLORS } from '../config/palette.js';
import { bus } from '../core/EventBus.js';
import { audio } from '../audio/index.js';
import { boxesOverlap, chipDamage, scaledDamage } from './combatMath.js';

const POWER_BY_KEY = { punch: 'light', headbutt: 'medium', stomp: 'heavy' };

/**
 * Resolves attacks: hit box vs hurt box overlap, damage, blocking, combos and
 * all of the feedback that goes with a landed hit (VFX, SFX, screen shake and
 * hit stop).
 */
export class CombatSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.vfx = options.vfx ?? null;
    this.text = options.floatingText ?? null;
    this.cameraFx = options.cameraFx ?? null;
    this.onHit = options.onHit ?? null;

    /** fighter -> { count, timer } */
    this.combos = new Map();
  }

  reset() {
    this.combos.clear();
  }

  #comboFor(fighter) {
    if (!this.combos.has(fighter)) this.combos.set(fighter, { count: 0, timer: 0 });
    return this.combos.get(fighter);
  }

  #advanceCombo(fighter) {
    const combo = this.#comboFor(fighter);
    if (combo.timer > 0) combo.count += 1;
    else combo.count = 1;
    combo.timer = COMBO.window;
    return combo.count;
  }

  /** Ages combo timers; called once per frame. */
  update(dt) {
    this.combos.forEach((combo) => {
      if (combo.timer > 0) {
        combo.timer = Math.max(0, combo.timer - dt);
        if (combo.timer === 0) {
          combo.count = 0;
          bus.emit(EVENTS.COMBO_CHANGED, { count: 0, side: 'player' });
          bus.emit(EVENTS.COMBO_CHANGED, { count: 0, side: 'enemy' });
        }
      }
    });
  }

  /**
   * Runs hit detection for a pair of fighters.
   * @returns {number} hit stop requested this frame (ms)
   */
  resolve(attacker, defender) {
    let hitStop = 0;
    if (!attacker || !defender) return hitStop;

    hitStop += this.#check(attacker, defender);
    hitStop += this.#check(defender, attacker);
    return hitStop;
  }

  #check(attacker, defender) {
    const hitbox = attacker.getAttackHitbox();
    if (!hitbox) return 0;
    if (defender.isInvulnerable) return 0;
    if (defender.isKO) return 0;

    const hurt = defender.getHurtbox();
    if (!boxesOverlap(hitbox, hurt)) return 0;

    // Airborne fighters dodge ground level attacks.
    if (defender.airborneHeight > FIGHTER_STATS.airborneDodgeHeight) return 0;

    const def = hitbox.def;
    hitbox.attack.hasHit = true;

    const comesFromFront =
      Math.sign(attacker.x - defender.x) === defender.facing ||
      Math.abs(attacker.x - defender.x) < 40;
    // A guard is either the block button or holding away from the attacker.
    const guarded = defender.isBlocking || defender.isGuarding;
    const blocked = guarded && comesFromFront && !def.knockDown;

    const comboCount = blocked ? 0 : this.#advanceCombo(attacker);
    const damage = blocked ? chipDamage(def) : scaledDamage(def.damage, comboCount);

    const result = defender.receiveHit({ def, damage, from: attacker, blocked });

    this.#feedback({
      attacker,
      defender,
      hitbox,
      hurt,
      def,
      blocked,
      damage: result.damage,
      comboCount,
    });

    bus.emit(EVENTS.HIT, {
      attacker,
      defender,
      damage: result.damage,
      blocked,
      combo: comboCount,
      killed: result.killed,
    });
    this.onHit?.({
      attacker,
      defender,
      damage: result.damage,
      blocked,
      combo: comboCount,
      killed: result.killed,
    });

    return blocked ? Math.round(def.hitStop * 0.4) : def.hitStop;
  }

  #feedback({ attacker, defender, hitbox, hurt, def, blocked, damage, comboCount }) {
    const power = POWER_BY_KEY[def.key] ?? 'light';
    const impactX = (hitbox.x + hurt.x) / 2;
    const impactY = hitbox.y;
    const direction = Math.sign(defender.x - attacker.x) || attacker.facing;

    // --- VFX ---
    if (blocked) {
      this.vfx?.impact(impactX, impactY, { power: 'block', direction });
      this.vfx?.ring(defender.x + defender.facing * 60, impactY, {
        color: 0xa9e4ff,
        endScale: 1.1,
        duration: 260,
      });
    } else {
      this.vfx?.impact(impactX, impactY, { power, direction });
      if (power === 'heavy') this.vfx?.dustPuff(defender.x, GROUND_Y + 6, { amount: 8, direction });
    }
    this.vfx?.afterimage(defender, defender.sprite, { alpha: 0.35, duration: 200 });

    // --- Camera ---
    this.cameraFx?.shake(def.shake, blocked ? 120 : power === 'heavy' ? 260 : 170);
    if (power === 'heavy' && !blocked) this.cameraFx?.zoomPunch(1.025, 240);

    // --- SFX ---
    audio.play(blocked ? 'block' : def.sfx.hit, { volume: blocked ? 0.85 : 1 });

    // --- Floating text ---
    if (this.text) {
      if (blocked) {
        this.text.spawn(defender.x, impactY - 120, 'BLOCK', {
          color: CSS_COLORS.blue,
          fontSize: 48,
          rise: 90,
        });
      } else {
        const label = `${Math.round(damage)}`;
        const color =
          power === 'heavy' ? CSS_COLORS.gold : power === 'medium' ? '#ffd08a' : CSS_COLORS.white;
        this.text.spawn(defender.x, impactY - 130, label, {
          color,
          fontSize: power === 'heavy' ? 74 : 56,
          rise: 120,
          drift: direction * 30,
        });
        if (comboCount >= 2) {
          this.text.spawn(defender.x + direction * 140, impactY - 60, `${comboCount} HITS`, {
            color: CSS_COLORS.gold,
            fontSize: 46,
            rise: 150,
            delay: 80,
          });
          audio.play('combo', { combo: comboCount });
        }
      }
    }

    if (!blocked && comboCount >= 2) {
      bus.emit(EVENTS.COMBO_CHANGED, {
        count: comboCount,
        side: attacker.isPlayer ? 'player' : 'enemy',
      });
    }
  }
}

export { POWER_BY_KEY };
