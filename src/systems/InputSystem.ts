/** InputSystem — buffers user-triggered events and drains them into tank.events
 *  at the start of each fixed simulation step.
 *
 *  This is the synchronisation boundary between the DOM event loop and the
 *  simulation loop. Clicks/button presses are enqueued here; the simulation
 *  loop calls flush(tank) before running behaviors so all queued actions
 *  take effect on the same physics tick. */

import type { Tank } from '@/tank/Tank';
import type { TankEvent, CatastropheKind } from '@/types/entities';
import type { Vec2 } from '@/utils/vec2';

export class InputSystem {
  private readonly queue: TankEvent[] = [];

  // ── Public API — called by controls.ts button/canvas handlers ─────────────

  queueAddFood(position: Vec2, count = 8): void {
    this.queue.push({ type: 'AddFood', position, count });
  }

  queueShakeTank(magnitude = 180): void {
    this.queue.push({ type: 'ShakeTank', magnitude });
  }

  queueLightPulse(intensity = 1): void {
    this.queue.push({ type: 'LightPulse', intensity });
  }

  queueSpawnCreature(position?: Vec2): void {
    const event: TankEvent =
      position !== undefined ? { type: 'SpawnCreature', position } : { type: 'SpawnCreature' };
    this.queue.push(event);
  }

  queueCatastrophe(kind: CatastropheKind): void {
    this.queue.push({ type: 'Catastrophe', kind });
  }

  // ── Called by SimulationLoop at start of each fixed step ──────────────────

  /** Drain the queue, emitting each pending action as a TankEvent. */
  flush(tank: Tank): void {
    for (const event of this.queue) tank.events.emit(event);
    this.queue.length = 0;
  }
}
