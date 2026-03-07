/** Entity interface contracts — shared by all simulation modules.
 *  No business logic lives here: only types, interfaces, and const enums. */

import type { Vec2 } from '@/utils/vec2';
import type { HSLA } from '@/utils/color';

// ── Branded ID types ──────────────────────────────────────────────────────────
// Branded strings prevent accidental cross-type ID substitution at compile time.

declare const __brand: unique symbol;
type Brand<B> = { readonly [__brand]: B };

export type CreatureId = string & Brand<'CreatureId'>;
export type ParticleId = string & Brand<'ParticleId'>;
export type EventId = string & Brand<'EventId'>;

let _idCounter = 0;

/** Generate a unique branded ID with the given prefix. */
export const nextId = <T extends string>(prefix: string): T =>
  `${prefix}_${(++_idCounter).toString(36)}` as T;

// ── Axis-aligned bounding box ─────────────────────────────────────────────────

export interface Aabb {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// ── Rigid body physics state ──────────────────────────────────────────────────

export interface RigidBody {
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  angle: number; // radians
  angularVel: number; // radians per second
  mass: number; // kg (abstract units)
  drag: number; // linear drag coefficient [0, 1]
  angularDrag: number; // rotational drag [0, 1]
}

// ── Creature traits ───────────────────────────────────────────────────────────

export interface CreatureTraits {
  speed: number; // max px/s [20, 300]
  curiosity: number; // tendency to seek unknowns [0, 1]
  aggression: number; // predatory drive [0, 1]
  glow: number; // bioluminescence intensity [0, 1]
  photophobic: boolean; // flees from light pulses
  foodPreference: FoodPreference;
  bodyPlan: BodyPlan;
  palette: readonly [HSLA, HSLA]; // [base color, accent color]
  scale: number; // size multiplier [0.4, 2.5]
  segmentCount: number; // chain bodies [1, 12]
  spineCount: number; // star bodies [3, 8]
}

export const FoodPreference = {
  Omnivore: 'omnivore',
  Herbivore: 'herbivore',
  Carnivore: 'carnivore',
} as const;
export type FoodPreference = (typeof FoodPreference)[keyof typeof FoodPreference];

export const BodyPlan = {
  Blob: 'blob',
  Triangle: 'triangle',
  Star: 'star',
  Worm: 'worm',
  Orb: 'orb',
} as const;
export type BodyPlan = (typeof BodyPlan)[keyof typeof BodyPlan];

// ── Creature lifecycle state ──────────────────────────────────────────────────

export const CreatureLifeState = {
  Alive: 'alive',
  Dying: 'dying',
  Dead: 'dead',
} as const;
export type CreatureLifeState = (typeof CreatureLifeState)[keyof typeof CreatureLifeState];

// ── Particle kinds ────────────────────────────────────────────────────────────

export const ParticleKind = {
  Food: 'food',
  Bubble: 'bubble',
  Debris: 'debris',
  Glow: 'glow',
} as const;
export type ParticleKind = (typeof ParticleKind)[keyof typeof ParticleKind];

// ── Tank event types ──────────────────────────────────────────────────────────

export const TankEventType = {
  AddFood: 'AddFood',
  ShakeTank: 'ShakeTank',
  LightPulse: 'LightPulse',
  SpawnCreature: 'SpawnCreature',
  Catastrophe: 'Catastrophe',
} as const;
export type TankEventType = (typeof TankEventType)[keyof typeof TankEventType];

export const CatastropheKind = {
  PredatorSpawn: 'predator_spawn',
  ToxicBloom: 'toxic_bloom',
  FreezingShock: 'freezing_shock',
  OxygenStorm: 'oxygen_storm',
} as const;
export type CatastropheKind = (typeof CatastropheKind)[keyof typeof CatastropheKind];

// ── Tank event ────────────────────────────────────────────────────────────────

export interface TankEvent {
  readonly id: EventId;
  readonly type: TankEventType;
  readonly timestamp: number; // performance.now() at time of emission
  readonly payload: TankEventPayload;
}

export type TankEventPayload =
  | { type: 'AddFood'; position: Vec2; count: number }
  | { type: 'ShakeTank'; magnitude: number }
  | { type: 'LightPulse'; intensity: number; duration: number }
  | { type: 'SpawnCreature'; position?: Vec2 }
  | { type: 'Catastrophe'; kind: CatastropheKind };
