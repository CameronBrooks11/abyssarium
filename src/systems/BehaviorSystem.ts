/** BehaviorSystem — composited weighted steering for all Alive creatures.
 *
 *  Each fixed timestep:
 *  1. Dying creatures progress their countdown (no steering).
 *  2. Alive creatures have five weighted forces computed and summed.
 *  3. Light-pulse reactions spike or suppress glow.
 *  4. Glow decays toward traits.glow.
 *  5. Worm segments are updated. */

import type { Tank } from '@/tank/Tank';
import type { Creature } from '@/creatures/Creature';
import { applyForce } from '@/systems/Physics';
import { computeWander } from '@/creatures/behaviors/wander';
import { computeSeekFood } from '@/creatures/behaviors/seekFood';
import { computeAvoidPredator } from '@/creatures/behaviors/avoidPredator';
import { computeBoids } from '@/creatures/behaviors/boids';
import { computeFluidDrift } from '@/creatures/behaviors/fluidDrift';
import { vec2Add, vec2Scale } from '@/utils/vec2';
import { createRng } from '@/utils/rng';
import { CreatureLifeState, BodyPlan } from '@/types/entities';

/** Behavior weights — tune in Phase 15 polish. */
const W = {
  wander: 1.0,
  seekFood: 2.5,
  avoid: 3.0,
  boids: 1.2,
  fluid: 0.6,
};

export class BehaviorSystem {
  /** Dedicated RNG so wander is independent of factory/event RNG. */
  private readonly rng = createRng(0xdeadbeef);

  update(tank: Tank, dt: number): void {
    for (const creature of tank.creatures) {
      if (creature.lifeState !== CreatureLifeState.Alive) {
        creature.tickDying(dt);
        continue;
      }
      this.updateCreature(creature, tank, dt);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private updateCreature(creature: Creature, tank: Tank, dt: number): void {
    creature.recordPrevPosition();
    creature.drainEnergy(dt);

    // ── Compute individual behavior forces ─────────────────────────────────
    const hungerScale = 1 + creature.hunger * 2.0;
    // Parentheses are load-bearing: avoidScale must be 1 or 2.5, never 0
    const avoidScale = 1 + (creature.traits.aggression < 0.4 ? 1.5 : 0);

    const wanderForce = computeWander(creature, this.rng);
    const foodForce = computeSeekFood(creature, tank);
    const avoidForce = computeAvoidPredator(creature, tank);
    const boidsForce = computeBoids(creature, tank);
    const fluidForce = computeFluidDrift(creature, tank);

    // ── Weighted composition ───────────────────────────────────────────────
    let force = { x: 0, y: 0 };
    force = vec2Add(force, vec2Scale(wanderForce, W.wander));
    force = vec2Add(force, vec2Scale(foodForce, W.seekFood * hungerScale));
    force = vec2Add(force, vec2Scale(avoidForce, W.avoid * avoidScale));
    force = vec2Add(force, vec2Scale(boidsForce, W.boids));
    force = vec2Add(force, vec2Scale(fluidForce, W.fluid));

    applyForce(creature.body, force);

    // ── Light pulse reaction ────────────────────────────────────────────────
    this.reactToLight(creature, tank);

    // ── Glow decay toward resting value ────────────────────────────────────
    creature.glowIntensity += (creature.traits.glow - creature.glowIntensity) * dt * 2.5;

    // ── Segment update for worm body plan ──────────────────────────────────
    if (creature.traits.bodyPlan === BodyPlan.Worm) {
      creature.updateSegments(8 * creature.traits.scale);
    }

    // ── Animation phase advance ────────────────────────────────────────────
    creature.animPhase += dt * (2 + creature.traits.speed / 100);
  }

  private reactToLight(creature: Creature, tank: Tank): void {
    if (tank.lightIntensity < 0.05) return;

    if (creature.traits.photophobic) {
      // Scatter away from tank centre
      const cx = tank.width / 2;
      const cy = tank.height / 2;
      const dx = creature.body.position.x - cx;
      const dy = creature.body.position.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      applyForce(creature.body, {
        x: (dx / dist) * 250 * tank.lightIntensity,
        y: (dy / dist) * 250 * tank.lightIntensity,
      });
      creature.glowIntensity = Math.max(0, creature.glowIntensity - 0.3);
    } else {
      // Photophilic — glow brightly
      creature.glowIntensity = Math.min(1, creature.glowIntensity + tank.lightIntensity * 0.8);
    }
  }
}
