/** computeSeekFood — finds the nearest food particle and steers toward it.
 *  Consumes the particle on contact and grants energy. */

import { arrive } from '@/utils/steering';
import { vec2DistSq } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import type { Creature } from '@/creatures/Creature';
import type { Tank } from '@/tank/Tank';
import type { Particle } from '@/particles/Particle';

const PERCEPTION_RADIUS = 180;
const EAT_DISTANCE_SQ = 16 * 16; // 16 px
const FOOD_ENERGY_GAIN = 18;

export const computeSeekFood = (creature: Creature, tank: Tank): Vec2 => {
  // Carnivores hunt prey, not food particles
  if (creature.traits.foodPreference === 'carnivore') {
    creature.targetFoodId = null;
    return { x: 0, y: 0 };
  }

  const nearby: Particle[] = [];
  tank.particleHash.queryRadius(
    creature.body.position.x,
    creature.body.position.y,
    PERCEPTION_RADIUS,
    nearby,
  );

  let bestDistSq = Infinity;
  let bestFood: Particle | null = null;

  for (const p of nearby) {
    if (p.kind !== 'food' || p.life <= 0) continue;
    const dSq = vec2DistSq(creature.body.position, p.body.position);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestFood = p;
    }
  }

  if (bestFood === null) {
    creature.targetFoodId = null;
    return { x: 0, y: 0 };
  }

  creature.targetFoodId = bestFood.id;

  // Consume on contact
  if (bestDistSq <= EAT_DISTANCE_SQ) {
    bestFood.life = 0;
    creature.feed(FOOD_ENERGY_GAIN);
    creature.targetFoodId = null;
    return { x: 0, y: 0 };
  }

  return arrive(
    creature.body,
    bestFood.body.position,
    creature.traits.speed,
    creature.traits.speed * 0.5,
    60,
  );
};
