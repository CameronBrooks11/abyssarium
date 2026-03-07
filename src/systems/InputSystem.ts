/** InputSystem — buffers UI events and translates them into TankEvents.
 *  Stub for Phase 05 dependency resolution; fully implemented in Phase 11. */

import type { Tank } from '@/tank/Tank';

export class InputSystem {
  /**
   * Drain the input queue and emit corresponding TankEvents onto tank.events.
   * Called at the start of each fixed timestep, before behaviors run.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  flush(_tank: Tank): void {
    // Implemented in Phase 11
  }
}
