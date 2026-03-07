/** computeWander — delegates to the steering wander helper.
 *  Mutates creature.wanderAngle in place and returns the force. */

import { wander } from '@/utils/steering';
import type { Creature } from '@/creatures/Creature';
import type { Vec2 } from '@/utils/vec2';
import type { Rng } from '@/utils/rng';

export const computeWander = (creature: Creature, rng: Rng): Vec2 => {
  const result = wander(
    creature.body,
    creature.wanderAngle,
    30, // wanderRadius
    60, // wanderDist
    0.5, // wanderJitter
    rng,
    creature.traits.speed * 0.4, // maxForce
  );
  creature.wanderAngle = result.nextWanderAngle;
  return result.force;
};
