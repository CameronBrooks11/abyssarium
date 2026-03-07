/** computeBoids — classic Reynolds boids: separation + alignment + cohesion.
 *  Applied only among same-species creatures; loners (curiosity < 0.4) skip. */

import { vec2Add, vec2Scale, vec2Normalise, vec2Zero } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import type { Creature } from '@/creatures/Creature';
import type { Tank } from '@/tank/Tank';

const BOID_RADIUS = 120;
const SEPARATION_RADIUS = 35;
const MAX_BOID_FORCE = 80;

export const computeBoids = (creature: Creature, tank: Tank): Vec2 => {
  if (creature.traits.curiosity < 0.4) return vec2Zero(); // loners ignore flocking

  const nearby: Creature[] = [];
  tank.creatureHash.queryRadius(
    creature.body.position.x,
    creature.body.position.y,
    BOID_RADIUS,
    nearby,
  );

  let sepX = 0,
    sepY = 0,
    sepCount = 0;
  let alignX = 0,
    alignY = 0;
  let cohX = 0,
    cohY = 0,
    cohCount = 0;

  for (const other of nearby) {
    if (other.id === creature.id) continue;
    if (other.species !== creature.species) continue;

    const dx = creature.body.position.x - other.body.position.x;
    const dy = creature.body.position.y - other.body.position.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    // Separation
    if (d < SEPARATION_RADIUS && d > 0.001) {
      sepX += dx / d;
      sepY += dy / d;
      sepCount++;
    }

    // Alignment
    alignX += other.body.velocity.x;
    alignY += other.body.velocity.y;

    // Cohesion
    cohX += other.body.position.x;
    cohY += other.body.position.y;
    cohCount++;
  }

  if (cohCount === 0) return vec2Zero();

  let force: Vec2 = vec2Zero();

  if (sepCount > 0) {
    const sf = { x: sepX / sepCount, y: sepY / sepCount };
    force = vec2Add(force, vec2Scale(vec2Normalise(sf), MAX_BOID_FORCE * 1.2));
  }

  const avgAlign = { x: alignX / cohCount, y: alignY / cohCount };
  force = vec2Add(force, vec2Scale(vec2Normalise(avgAlign), MAX_BOID_FORCE * 0.5));

  const avgCoh = {
    x: cohX / cohCount - creature.body.position.x,
    y: cohY / cohCount - creature.body.position.y,
  };
  force = vec2Add(force, vec2Scale(vec2Normalise(avgCoh), MAX_BOID_FORCE * 0.3));

  return force;
};
