/** computeFluidDrift — gently pushes the creature with the ambient fluid current.
 *  Smaller (lower scale) creatures are pushed more strongly. */

import { vec2Scale } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import type { Creature } from '@/creatures/Creature';
import type { Tank } from '@/tank/Tank';

export const computeFluidDrift = (creature: Creature, tank: Tank): Vec2 => {
  const fluidVel = tank.fluid.sampleAt(creature.body.position.x, creature.body.position.y);
  // Coupling strength is inversely proportional to scale — smaller = more pushed
  const coupling = 0.6 / creature.traits.scale;
  return vec2Scale(fluidVel, coupling);
};
