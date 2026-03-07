/** ParticleSystem — manages particle lifecycle, spawning, and per-frame updates.
 *  Stub for Phase 05 dependency resolution; fully implemented in Phase 06. */

import type { Tank } from '@/tank/Tank';

export class ParticleSystem {
  /** Called once per fixed timestep. Decrements lifetimes, spawns debris, applies forces. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_tank: Tank, _dt: number): void {
    // Implemented in Phase 06
  }
}
