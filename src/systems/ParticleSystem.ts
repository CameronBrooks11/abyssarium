/** ParticleSystem — manages particle lifecycle, fluid coupling, and spawning.
 *
 *  Responsibilities per fixed timestep:
 *  - Save prevPosition for interpolated rendering
 *  - Apply fluid coupling forces
 *  - Apply kind-specific forces (bubble buoyancy)
 *  - Pop bubbles at the surface
 *  - Decrement lifetime
 *  - Emit debris from dying creatures (4 fragments/frame while Dying)
 *  - Spawn ambient background bubbles at a steady rate */

import type { Tank } from '@/tank/Tank';
import { spawnDebris } from '@/particles/Debris';
import { spawnBubble } from '@/particles/Bubble';
import { applyForce } from '@/systems/Physics';
import { createRng } from '@/utils/rng';
import { vec2Scale } from '@/utils/vec2';
import { CreatureLifeState } from '@/types/entities';

/** Hard cap on simultaneous particles. */
const MAX_PARTICLES = 600;

/** Ambient bubble emission rate in bubbles per second. */
const BUBBLE_RATE = 2.5;

export class ParticleSystem {
  private readonly rng = createRng(Date.now() & 0xffffffff);
  private bubbleAccum = 0;

  update(tank: Tank, dt: number): void {
    this.tickParticles(tank, dt);
    this.spawnDebrisFromDying(tank);
    this.spawnAmbientBubbles(tank, dt);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private tickParticles(tank: Tank, dt: number): void {
    for (const p of tank.particles) {
      // Save previous position before physics mutates body.position
      p.prevPosition = { ...p.body.position };

      // Fluid coupling: ambient current nudges particles
      const fluidVel = tank.fluid.sampleAt(p.body.position.x, p.body.position.y);
      applyForce(p.body, vec2Scale(fluidVel, 0.4));

      // Kind-specific: extra upward force for bubbles
      if (p.kind === 'bubble') {
        applyForce(p.body, { x: 0, y: -60 });
      }

      // Pop bubbles that reach the top 5% of the tank
      if (p.kind === 'bubble' && p.body.position.y < tank.height * 0.05) {
        p.life = 0;
        continue;
      }

      // Spin debris
      p.body.angle += p.spin * dt;

      // Decrement lifetime
      p.life -= dt;
    }
  }

  /** Emit 4 debris fragments per frame for every Dying creature. */
  private spawnDebrisFromDying(tank: Tank): void {
    if (tank.particles.length >= MAX_PARTICLES) return;
    for (const creature of tank.creatures) {
      if (creature.lifeState !== CreatureLifeState.Dying) continue;
      const count = 4;
      for (let i = 0; i < count; i++) {
        if (tank.particles.length >= MAX_PARTICLES) break;
        tank.particles.push(
          spawnDebris(
            creature.body.position,
            creature.body.velocity,
            creature.traits.palette[0],
            this.rng,
          ),
        );
      }
    }
  }

  /** Trickle in ambient bubbles from the lower half of the tank. */
  private spawnAmbientBubbles(tank: Tank, dt: number): void {
    if (tank.particles.length >= MAX_PARTICLES) return;
    this.bubbleAccum += BUBBLE_RATE * dt;
    while (this.bubbleAccum >= 1) {
      this.bubbleAccum--;
      const x = this.rng() * tank.width;
      const y = tank.height * (0.6 + this.rng() * 0.4);
      tank.particles.push(spawnBubble({ x, y }, this.rng));
    }
  }
}
