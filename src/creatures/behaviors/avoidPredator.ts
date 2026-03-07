/** computeAvoidPredator — steers away from nearby larger, more aggressive creatures.
 *  Apex predators (aggression > 0.6) never flee. */

import { flee } from '@/utils/steering';
import { vec2DistSq } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import type { Creature } from '@/creatures/Creature';
import type { Tank } from '@/tank/Tank';

const THREAT_RADIUS = 200;

export const computeAvoidPredator = (creature: Creature, tank: Tank): Vec2 => {
  if (creature.traits.aggression > 0.6) return { x: 0, y: 0 }; // apex predators don't flee

  const nearby: Creature[] = [];
  tank.creatureHash.queryRadius(
    creature.body.position.x,
    creature.body.position.y,
    THREAT_RADIUS,
    nearby,
  );

  let closestThreat: Creature | null = null;
  let closestDSq = Infinity;

  for (const other of nearby) {
    if (other.id === creature.id) continue;
    // A threat is something more aggressive and/or bigger
    if (
      other.traits.aggression <= creature.traits.aggression + 0.25 ||
      other.traits.scale <= creature.traits.scale - 0.2
    )
      continue;

    const dSq = vec2DistSq(creature.body.position, other.body.position);
    if (dSq < closestDSq) {
      closestDSq = dSq;
      closestThreat = other;
    }
  }

  if (closestThreat === null) {
    return { x: 0, y: 0 };
  }

  return flee(
    creature.body,
    closestThreat.body.position,
    creature.traits.speed * 1.3, // flee slightly faster
    creature.traits.speed * 0.7,
  );
};
