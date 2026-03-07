/** Creature — data container for a simulation agent.
 *  Stub for Phase 04 dependency resolution; fully implemented in Phase 07.
 *
 *  Implements HasPosition via a getter so it is accepted by SpatialHash<Creature>. */

import type { Vec2 } from '@/utils/vec2';
import { vec2Zero, vec2Clone } from '@/utils/vec2';
import type { RigidBody, CreatureId, CreatureTraits, CreatureLifeState } from '@/types/entities';
import { CreatureLifeState as LS } from '@/types/entities';

export interface CreatureSpec {
  id: CreatureId;
  species: string;
  position: Vec2;
  traits: CreatureTraits;
}

export class Creature {
  // ── Identity ───────────────────────────────────────────────────────────────
  readonly id: CreatureId;
  readonly species: string;

  // ── Physics ────────────────────────────────────────────────────────────────
  body: RigidBody;
  /** Position snapshot from the start of the previous fixed step — for render lerp. */
  prevPosition: Vec2;

  // ── Traits ────────────────────────────────────────────────────────────────
  readonly traits: CreatureTraits;

  // ── Vital stats ───────────────────────────────────────────────────────────
  energy = 70;
  hunger = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  lifeState: CreatureLifeState = LS.Alive;
  dyingTimer = 0;

  // ── Wander state (owned by BehaviorSystem but stored here for locality) ───
  wanderAngle = 0;

  // ── Segment positions (worm body-plan chain) ──────────────────────────────
  segments: Vec2[] = [];

  constructor(spec: CreatureSpec) {
    this.id = spec.id;
    this.species = spec.species;
    this.traits = spec.traits;
    this.prevPosition = vec2Clone(spec.position);

    this.body = {
      position: vec2Clone(spec.position),
      velocity: vec2Zero(),
      acceleration: vec2Zero(),
      angle: 0,
      angularVel: 0,
      mass: spec.traits.scale * 2,
      drag: 0.01,
      angularDrag: 0.4,
    };
  }

  // ── HasPosition (required by SpatialHash<Creature>) ───────────────────────

  get position(): Vec2 {
    return this.body.position;
  }

  // ── Derived geometry ──────────────────────────────────────────────────────

  /** Radius in pixels derived from traits.scale. */
  get radius(): number {
    return 10 * this.traits.scale;
  }
}
