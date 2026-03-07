/** Creature — data container for a simulation agent.
 *
 *  Implements HasPosition via a getter so it is accepted by SpatialHash<Creature>.
 *  No behaviour or rendering logic lives here — this is a pure data holder with
 *  a minimal lifecycle state machine (alive → dying → dead). */

import type { Vec2 } from '@/utils/vec2';
import { vec2Zero, vec2Clone } from '@/utils/vec2';
import type { CreatureId, RigidBody, CreatureTraits, CreatureLifeState } from '@/types/entities';
import { CreatureLifeState as LS } from '@/types/entities';

export interface CreatureSpec {
  id: CreatureId;
  species: string;
  position: Vec2;
  traits: CreatureTraits;
  angle?: number;
  animPhase?: number;
}

export class Creature {
  // ── Identity ───────────────────────────────────────────────────────────────
  readonly id: CreatureId;
  readonly species: string;

  // ── Physics ────────────────────────────────────────────────────────────────
  body: RigidBody;
  /** Position at the start of the previous fixed step — for render lerp. */
  prevPosition: Vec2;

  // ── Traits (immutable after creation) ────────────────────────────────────
  readonly traits: CreatureTraits;

  /** Effective radius in pixels derived from traits.scale. */
  get radius(): number {
    return 10 * this.traits.scale;
  }

  // ── Vital stats ───────────────────────────────────────────────────────────
  /**
   * Energy [0, 100]. Drains over time and from movement. Replenishes from food.
   * When energy ≤ 0, creature enters Dying state.
   */
  energy: number = 70;
  /** [0, 1] — how urgently the creature seeks food. */
  hunger: number = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  lifeState: CreatureLifeState = LS.Alive;
  /** Countdown timer for the Dying phase (seconds). */
  dyingTimer: number = 0;

  // ── Behavioral state ──────────────────────────────────────────────────────
  /** Current steering angle for wander behaviour. Mutated each frame. */
  wanderAngle: number = 0;

  /**
   * Glow intensity [0, 1]. Normally equals traits.glow, but spikes on
   * light pulse (photophilic) or drops (photophobic).
   */
  glowIntensity: number;

  /**
   * Phase offset for body animation (pulsing, undulation).
   * Randomised at construction so creatures don't all pulse in sync.
   */
  animPhase: number;

  // ── Segment chain (worm/chain body plans) ────────────────────────────────
  /**
   * Positions of body segments. segments[0] mirrors body.position.
   * Length = traits.segmentCount.
   */
  segments: Vec2[];

  constructor(spec: CreatureSpec) {
    this.id = spec.id;
    this.species = spec.species;
    this.traits = spec.traits;

    this.body = {
      position: vec2Clone(spec.position),
      velocity: vec2Zero(),
      acceleration: vec2Zero(),
      angle: spec.angle ?? Math.random() * Math.PI * 2,
      angularVel: 0,
      mass: 0.5 + spec.traits.scale * 1.5,
      drag: 0.04 + (1 / spec.traits.speed) * 0.02,
      angularDrag: 0.4,
    };

    this.prevPosition = vec2Clone(spec.position);
    this.glowIntensity = spec.traits.glow;
    this.animPhase = spec.animPhase ?? Math.random() * Math.PI * 2;

    this.segments = Array.from({ length: spec.traits.segmentCount }, () =>
      vec2Clone(spec.position),
    );
  }

  // ── HasPosition (required by SpatialHash<Creature>) ───────────────────────

  get position(): Vec2 {
    return this.body.position;
  }

  // ── Public API used by BehaviorSystem & ParticleSystem ───────────────────

  /** Called each physics tick to record position for interpolated rendering. */
  recordPrevPosition(): void {
    this.prevPosition = vec2Clone(this.body.position);
  }

  /**
   * Decrement energy by a per-frame cost and update hunger.
   * Transitions to Dying when energy ≤ 0.
   * @param dt Fixed timestep in seconds.
   */
  drainEnergy(dt: number): void {
    const speedCost = (this.traits.speed / 300) * 2.5;
    const baseMetaRate = 1.2;
    this.energy -= (baseMetaRate + speedCost) * dt;
    this.hunger = Math.max(0, Math.min(1, 1 - this.energy / 60));

    if (this.energy <= 0 && this.lifeState === LS.Alive) {
      this.lifeState = LS.Dying;
      this.dyingTimer = 1.2;
    }
  }

  /** Feed the creature — increases energy, capped at 100. */
  feed(amount: number): void {
    this.energy = Math.min(100, this.energy + amount);
  }

  /**
   * Instantly reduce energy by amount (e.g. from toxic events).
   * Clamps to 0 but does not trigger the Dying state by itself.
   * Callers that need a dying transition should check energy afterward.
   */
  drain(amount: number): void {
    this.energy = Math.max(0, this.energy - amount);
  }

  /**
   * Progress the dying countdown. Returns true once the creature is fully Dead.
   */
  tickDying(dt: number): boolean {
    if (this.lifeState !== LS.Dying) return false;
    this.dyingTimer -= dt;
    if (this.dyingTimer <= 0) {
      this.lifeState = LS.Dead;
      return true;
    }
    return false;
  }

  /**
   * Update the worm segment chain by pulling each segment toward the previous.
   * @param spacing Target spacing in pixels between segments.
   */
  updateSegments(spacing: number): void {
    if (this.segments.length <= 1) return;
    this.segments[0] = vec2Clone(this.body.position);
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1]!;
      const curr = this.segments[i]!;
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = Math.max(0, dist - spacing) / dist;
      this.segments[i] = {
        x: curr.x + dx * pull * 0.6,
        y: curr.y + dy * pull * 0.6,
      };
    }
  }
}
