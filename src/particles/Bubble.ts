/** spawnBubble — creates a bubble particle that rises toward the surface.
 *  Bubbles pop when they reach the top 5% of the tank. */

import type { Vec2 } from '@/utils/vec2';
import type { Rng } from '@/utils/rng';
import { rngFloat } from '@/utils/rng';
import { hsla } from '@/utils/color';
import { nextId, ParticleKind } from '@/types/entities';
import { makeBody, Particle } from './Particle';

export const spawnBubble = (position: Readonly<Vec2>, rng: Rng): Particle => {
  const pos = { x: position.x + rngFloat(rng, -20, 20), y: position.y };
  const vel = { x: rngFloat(rng, -8, 8), y: rngFloat(rng, -60, -30) };
  const life = rngFloat(rng, 3, 8);
  return new Particle({
    id: nextId('bb'),
    kind: ParticleKind.Bubble,
    body: makeBody(pos, vel, 0.1, 0.18),
    prevPosition: { ...pos },
    radius: rngFloat(rng, 2, 7),
    life,
    maxLife: 6,
    color: hsla(200, 60, 80, 0.35),
    spin: 0,
  });
};
