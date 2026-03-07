/** Particle — a lightweight simulation object with a finite lifetime.
 *
 *  Implemented as a class so the `position` getter always reflects
 *  `body.position`, which is replaced (not mutated) on each physics step.
 *  This keeps SpatialHash<Particle> queries consistent. */

import type { Vec2 } from '@/utils/vec2';
import { vec2Zero, vec2Clone } from '@/utils/vec2';
import type { HSLA } from '@/utils/color';
import type { ParticleId, ParticleKind, RigidBody } from '@/types/entities';

// ── RigidBody factory ─────────────────────────────────────────────────────────

/** Build a RigidBody for a particle with sensible angular defaults. */
export const makeBody = (
  position: Readonly<Vec2>,
  velocity: Readonly<Vec2>,
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

// ── Particle class ────────────────────────────────────────────────────────────

export class Particle {
  readonly id: ParticleId;
  readonly kind: ParticleKind;

  body: RigidBody;

  /** Position at the start of the previous physics step — for render lerp. */
  prevPosition: Vec2;

  /** Radius in pixels. */
  radius: number;

  /** Remaining lifetime in seconds. Zero = expired and will be pruned. */
  life: number;

  /** Maximum lifetime — used to compute alpha fade. */
  maxLife: number;

  /** Visual color. */
  color: HSLA;

  /** Spin rate (radians/s). Non-zero only for debris. */
  spin: number;

  constructor(init: {
    id: ParticleId;
    kind: ParticleKind;
    body: RigidBody;
    prevPosition: Vec2;
    radius: number;
    life: number;
    maxLife: number;
    color: HSLA;
    spin: number;
  }) {
    this.id = init.id;
    this.kind = init.kind;
    this.body = init.body;
    this.prevPosition = init.prevPosition;
    this.radius = init.radius;
    this.life = init.life;
    this.maxLife = init.maxLife;
    this.color = init.color;
    this.spin = init.spin;
  }

  /**
   * Live position for SpatialHash<Particle> — always reflects body.position,
   * which is replaced on each physics integration step.
   */
  get position(): Vec2 {
    return this.body.position;
  }
}
