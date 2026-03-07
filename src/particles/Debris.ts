/** spawnDebris — creates a debris fragment emitted when a creature dies.
 *  Debris tumbles with angular velocity and fades out over 2–5 seconds. */

import type { Vec2 } from '@/utils/vec2';
import type { HSLA } from '@/utils/color';
import { hslaWithAlpha } from '@/utils/color';
import type { Rng } from '@/utils/rng';
import { rngFloat, rngGaussian } from '@/utils/rng';
import { nextId, ParticleKind } from '@/types/entities';
import { makeBody, Particle } from './Particle';

export const spawnDebris = (
  position: Readonly<Vec2>,
  direction: Readonly<Vec2>,
  color: HSLA,
  rng: Rng,
): Particle => {
  const speed = rngFloat(rng, 20, 90);
  const angle = Math.atan2(direction.y, direction.x) + rngGaussian(rng, 0, 0.8);
  const pos = { ...position };
  const vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  const life = rngFloat(rng, 2, 5);
  return new Particle({
    id: nextId('db'),
    kind: ParticleKind.Debris,
    body: makeBody(pos, vel, 0.5, 0.12),
    prevPosition: { ...pos },
    radius: rngFloat(rng, 1.5, 4),
    life,
    maxLife: 4,
    color: hslaWithAlpha(color, 0.8),
    spin: rngFloat(rng, -6, 6),
  });
};
