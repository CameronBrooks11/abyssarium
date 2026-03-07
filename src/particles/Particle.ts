/** Particle — a lightweight simulation object with finite lifetime.
 *  Stub for Phase 04 dependency resolution; fully implemented in Phase 06.
 *
 *  Implements HasPosition via a getter so it is accepted by SpatialHash<Particle>. */

import type { Vec2 } from '@/utils/vec2';
import { vec2Zero, vec2Clone } from '@/utils/vec2';
import type { HSLA } from '@/utils/color';
import type { ParticleId, ParticleKind, RigidBody } from '@/types/entities';

export interface Particle {
  readonly id: ParticleId;
  readonly kind: ParticleKind;
  body: RigidBody;
  /** Position snapshot for render interpolation. */
  prevPosition: Vec2;
  /** Spatial position — mirrors body.position; needed for SpatialHash<Particle>. */
  readonly position: Vec2;
  /** Radius in pixels. */
  radius: number;
  /** Remaining lifetime in seconds. Zero = expired. */
  life: number;
  /** Maximum lifetime, used to compute alpha fade fraction. */
  maxLife: number;
  /** Visual color. */
  color: HSLA;
  /** Spin direction for debris tumble. */
  spin: number;
}

/** Minimal RigidBody factory used by particle spawners. */
export const makeParticleBody = (
  position: Vec2,
  velocity: Vec2,
  mass: number,
  drag: number,
): RigidBody => ({
  position: vec2Clone(position),
  velocity: vec2Clone(velocity),
  acceleration: vec2Zero(),
  angle: 0,
  angularVel: 0,
  mass,
  drag,
  angularDrag: 0.3,
});
