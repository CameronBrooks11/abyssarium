import type { Vec2 } from '@/utils/vec2';
import type { Rng } from '@/utils/rng';
import { rngFloat } from '@/utils/rng';
import { hsla } from '@/utils/color';
import type { HSLA } from '@/utils/color';
import { nextId, ParticleKind } from '@/types/entities';
import { makeBody, Particle } from './Particle';

export const spawnFood = (position: Readonly<Vec2>, rng: Rng, colorOverride?: HSLA): Particle => {
  const pos = { x: position.x + rngFloat(rng, -8, 8), y: position.y };
  const vel = { x: rngFloat(rng, -15, 15), y: rngFloat(rng, 5, 25) };
  const life = rngFloat(rng, 12, 20);
  return new Particle({
    id: nextId('fd'),
    kind: ParticleKind.Food,
    body: makeBody(pos, vel, 0.3, 0.08),
    prevPosition: { ...pos },
    radius: rngFloat(rng, 2.5, 5),
    life,
    maxLife: 18,
    color: colorOverride ?? hsla(rngFloat(rng, 45, 65), 80, 72),
    spin: 0,
  });
};
