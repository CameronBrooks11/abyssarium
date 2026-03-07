# Phase 02 — Math Primitives & Shared Type Contracts

## Goal

Define every shared data type, interface, and math utility the entire project
will consume. This phase produces zero runtime behaviour on its own — it is a
**pure contract layer**. Everything else will import from here. Getting this
right before writing any simulation code eliminates downstream refactoring.

---

## Design Principles

1. **Value types over classes for math** — `Vec2` is a plain object `{x, y}`.
   Operations are free functions (`vec2Add`, `vec2Scale`, etc.). This keeps
   allocation hot-paths fast and makes values trivially serialisable.

2. **`readonly` everywhere reasonable** — Mutation is explicit and deliberate.
   Input arguments to pure functions are `Readonly<Vec2>`.

3. **Nominal IDs** — Entity IDs are branded strings, preventing accidental
   cross-type ID substitution.

4. **Enums as `const` objects** — Avoids TypeScript enum runtime overhead and
   tree-shaking issues. Pattern: `export const CreatureState = { ... } as const;
   export type CreatureState = typeof CreatureState[keyof typeof CreatureState];`

---

## Files Produced

| File | Exports |
|---|---|
| `src/types/index.ts` | Re-exports everything for a single import path |
| `src/utils/vec2.ts` | `Vec2` type + full function library |
| `src/utils/math.ts` | Scalar math helpers |
| `src/utils/color.ts` | HSLA color type + helpers |
| `src/utils/rng.ts` | Seeded PRNG + distribution helpers |
| `src/types/entities.ts` | All entity interface contracts |
| `src/types/events.ts` | Tank event definitions |
| `src/types/traits.ts` | CreatureTrait definitions |

---

## Step-by-Step Execution

### 1. Vec2 (`src/utils/vec2.ts`)

The core 2D vector type used everywhere for position, velocity, force, etc.

```ts
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

// ── Construction ──────────────────────────────────────────────────────────────

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });
export const vec2Zero = (): Vec2 => ({ x: 0, y: 0 });
export const vec2Clone = (v: Readonly<Vec2>): Vec2 => ({ x: v.x, y: v.y });

// ── Arithmetic ────────────────────────────────────────────────────────────────

export const vec2Add   = (a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 =>
  ({ x: a.x + b.x, y: a.y + b.y });

export const vec2Sub   = (a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 =>
  ({ x: a.x - b.x, y: a.y - b.y });

export const vec2Scale = (v: Readonly<Vec2>, s: number): Vec2 =>
  ({ x: v.x * s, y: v.y * s });

export const vec2Lerp  = (a: Readonly<Vec2>, b: Readonly<Vec2>, t: number): Vec2 =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const vec2Negate = (v: Readonly<Vec2>): Vec2 =>
  ({ x: -v.x, y: -v.y });

// ── Measurement ───────────────────────────────────────────────────────────────

export const vec2LenSq = (v: Readonly<Vec2>): number =>
  v.x * v.x + v.y * v.y;

export const vec2Len   = (v: Readonly<Vec2>): number =>
  Math.sqrt(vec2LenSq(v));

export const vec2Dist  = (a: Readonly<Vec2>, b: Readonly<Vec2>): number =>
  vec2Len(vec2Sub(b, a));

export const vec2DistSq = (a: Readonly<Vec2>, b: Readonly<Vec2>): number =>
  vec2LenSq(vec2Sub(b, a));

export const vec2Dot   = (a: Readonly<Vec2>, b: Readonly<Vec2>): number =>
  a.x * b.x + a.y * b.y;

export const vec2Cross = (a: Readonly<Vec2>, b: Readonly<Vec2>): number =>
  a.x * b.y - a.y * b.x;

// ── Normalisation ─────────────────────────────────────────────────────────────

export const vec2Normalise = (v: Readonly<Vec2>): Vec2 => {
  const len = vec2Len(v);
  if (len < 1e-9) return vec2Zero();
  return { x: v.x / len, y: v.y / len };
};

// ── Rotation ──────────────────────────────────────────────────────────────────

export const vec2Rotate = (v: Readonly<Vec2>, angle: number): Vec2 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
};

export const vec2Angle = (v: Readonly<Vec2>): number => Math.atan2(v.y, v.x);

export const vec2FromAngle = (angle: number, len = 1): Vec2 =>
  ({ x: Math.cos(angle) * len, y: Math.sin(angle) * len });

// ── Clamping / Truncation ────────────────────────────────────────────────────

export const vec2Limit = (v: Readonly<Vec2>, maxLen: number): Vec2 => {
  const lenSq = vec2LenSq(v);
  if (lenSq <= maxLen * maxLen) return vec2Clone(v);
  return vec2Scale(vec2Normalise(v), maxLen);
};

export const vec2Clamp = (
  v: Readonly<Vec2>,
  minX: number, maxX: number,
  minY: number, maxY: number,
): Vec2 => ({
  x: Math.max(minX, Math.min(maxX, v.x)),
  y: Math.max(minY, Math.min(maxY, v.y)),
});

// ── Reflect ───────────────────────────────────────────────────────────────────

/** Reflect v off a surface with the given unit normal. */
export const vec2Reflect = (v: Readonly<Vec2>, normal: Readonly<Vec2>): Vec2 => {
  const dot2 = 2 * vec2Dot(v, normal);
  return vec2Sub(v, vec2Scale(normal, dot2));
};
```

---

### 2. Scalar Math Helpers (`src/utils/math.ts`)

```ts
/** Linear interpolation between a and b by t ∈ [0,1]. */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** Clamp n to [min, max]. */
export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

/** Map n from [inMin, inMax] to [outMin, outMax]. */
export const remap = (
  n: number,
  inMin: number, inMax: number,
  outMin: number, outMax: number,
): number => outMin + ((n - inMin) / (inMax - inMin)) * (outMax - outMin);

/** Reduce angle to [0, 2π). */
export const wrapAngle = (angle: number): number => {
  const TAU = Math.PI * 2;
  return ((angle % TAU) + TAU) % TAU;
};

/** Shortest angular difference from a to b, in [-π, π]. */
export const angleDiff = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI)  d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Smooth-step (Hermite) interpolation. */
export const smoothStep = (t: number): number => t * t * (3 - 2 * t);

/** Perlin-like smooth step (6t^5 - 15t^4 + 10t^3). */
export const smootherStep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
```

---

### 3. Color Type & Helpers (`src/utils/color.ts`)

```ts
export interface HSLA {
  readonly h: number; // [0, 360)
  readonly s: number; // [0, 100]
  readonly l: number; // [0, 100]
  readonly a: number; // [0, 1]
}

export const hsla = (h: number, s: number, l: number, a = 1): HSLA => ({ h, s, l, a });

export const hslaToString = (c: Readonly<HSLA>): string =>
  `hsla(${c.h.toFixed(1)},${c.s.toFixed(1)}%,${c.l.toFixed(1)}%,${c.a.toFixed(3)})`;

export const hslaLerp = (a: Readonly<HSLA>, b: Readonly<HSLA>, t: number): HSLA => ({
  h: a.h + angleFraction(a.h, b.h) * t,
  s: a.s + (b.s - a.s) * t,
  l: a.l + (b.l - a.l) * t,
  a: a.a + (b.a - a.a) * t,
});

/** Hue interpolation taking the short path around the circle. */
const angleFraction = (from: number, to: number): number => {
  let d = to - from;
  if (d >  180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

export const hslaWithAlpha = (c: Readonly<HSLA>, a: number): HSLA => ({ ...c, a });
export const hslaWithLightness = (c: Readonly<HSLA>, l: number): HSLA => ({ ...c, l });
```

---

### 4. Seeded PRNG (`src/utils/rng.ts`)

A deterministic Mulberry32 PRNG so random sequences are reproducible for testing.

```ts
export type Rng = () => number;

/** Create a seeded PRNG returning values in [0, 1). */
export const createRng = (seed: number): Rng => {
  let s = seed >>> 0;
  return (): number => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform float in [min, max). */
export const rngFloat = (rng: Rng, min: number, max: number): number =>
  min + rng() * (max - min);

/** Uniform integer in [min, max]. */
export const rngInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

/** Pick one item from an array uniformly. */
export const rngPick = <T>(rng: Rng, items: readonly T[]): T => {
  if (items.length === 0) throw new RangeError('rngPick: empty array');
  return items[Math.floor(rng() * items.length)]!;
};

/** Return true with probability p ∈ [0, 1]. */
export const rngChance = (rng: Rng, p: number): boolean => rng() < p;

/** Gaussian (normal) distribution via Box-Muller. */
export const rngGaussian = (rng: Rng, mean = 0, stddev = 1): number => {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
};
```

---

### 5. Branded ID Utilities (`src/types/entities.ts`)

```ts
import type { Vec2 } from '@/utils/vec2';
import type { HSLA } from '@/utils/color';

// ── Branded ID types ──────────────────────────────────────────────────────────
declare const __brand: unique symbol;
type Brand<B> = { readonly [__brand]: B };

export type CreatureId  = string & Brand<'CreatureId'>;
export type ParticleId  = string & Brand<'ParticleId'>;
export type EventId     = string & Brand<'EventId'>;

let _idCounter = 0;
export const nextId = <T extends string>(prefix: string): T =>
  `${prefix}_${(++_idCounter).toString(36)}` as T;

// ── Aabb (axis-aligned bounding box) ─────────────────────────────────────────
export interface Aabb {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// ── Rigid body physics state ──────────────────────────────────────────────────
export interface RigidBody {
  position:     Vec2;
  velocity:     Vec2;
  acceleration: Vec2;
  angle:        number; // radians
  angularVel:   number; // radians per second
  mass:         number;
  drag:         number; // linear drag coefficient [0,1]
  angularDrag:  number;
}

// ── Creature Traits ───────────────────────────────────────────────────────────
export interface CreatureTraits {
  speed:          number; // max pixels/s [20, 300]
  curiosity:      number; // tendency to seek unknowns [0,1]
  aggression:     number; // predatory drive [0,1]
  glow:           number; // bioluminescence intensity [0,1]
  photophobic:    boolean;// flees from light pulses
  foodPreference: FoodPreference;
  bodyPlan:       BodyPlan;
  palette:        readonly [HSLA, HSLA]; // base + accent colors
  scale:          number; // size multiplier [0.4, 2.5]
  segmentCount:   number; // for worm / chain types [1, 12]
  spineCount:     number; // for star types [3, 8]
}

export const FoodPreference = {
  Omnivore:   'omnivore',
  Herbivore:  'herbivore',
  Carnivore:  'carnivore',
} as const;
export type FoodPreference = typeof FoodPreference[keyof typeof FoodPreference];

export const BodyPlan = {
  Blob:     'blob',
  Triangle: 'triangle',
  Star:     'star',
  Worm:     'worm',
  Orb:      'orb',
} as const;
export type BodyPlan = typeof BodyPlan[keyof typeof BodyPlan];

// ── Creature State ────────────────────────────────────────────────────────────
export const CreatureLifeState = {
  Alive:       'alive',
  Dying:       'dying',
  Dead:        'dead',
} as const;
export type CreatureLifeState = typeof CreatureLifeState[keyof typeof CreatureLifeState];

// ── Particle kinds ───────────────────────────────────────────────────────────
export const ParticleKind = {
  Food:    'food',
  Bubble:  'bubble',
  Debris:  'debris',
  Glow:    'glow',
} as const;
export type ParticleKind = typeof ParticleKind[keyof typeof ParticleKind];

// ── Tank event types ──────────────────────────────────────────────────────────
export const TankEventType = {
  AddFood:     'AddFood',
  ShakeTank:   'ShakeTank',
  LightPulse:  'LightPulse',
  SpawnCreature: 'SpawnCreature',
  Catastrophe: 'Catastrophe',
} as const;
export type TankEventType = typeof TankEventType[keyof typeof TankEventType];

export const CatastropheKind = {
  PredatorSpawn:  'predator_spawn',
  ToxicBloom:     'toxic_bloom',
  FreezingShock:  'freezing_shock',
  OxygenStorm:    'oxygen_storm',
} as const;
export type CatastropheKind = typeof CatastropheKind[keyof typeof CatastropheKind];

// ── Tank event ────────────────────────────────────────────────────────────────
export interface TankEvent {
  readonly id:        EventId;
  readonly type:      TankEventType;
  readonly timestamp: number;
  readonly payload:   TankEventPayload;
}

export type TankEventPayload =
  | { type: 'AddFood';       position: Vec2; count: number }
  | { type: 'ShakeTank';     magnitude: number }
  | { type: 'LightPulse';    intensity: number; duration: number }
  | { type: 'SpawnCreature'; position?: Vec2 }
  | { type: 'Catastrophe';   kind: CatastropheKind };
```

---

### 6. Tank Events (`src/types/events.ts`)

This thin file documents observer/emitter patterns used throughout:

```ts
/**
 * EventBus — lightweight typed emitter.
 * Keeps simulation code decoupled from UI code.
 *
 * Usage:
 *   const bus = new EventBus<TankEvent>();
 *   bus.on('AddFood', handler);
 *   bus.emit({ type: 'AddFood', ... });
 */

type Handler<T> = (event: T) => void;

export class EventBus<T extends { type: string }> {
  private readonly listeners = new Map<string, Set<Handler<T>>>();

  on<K extends T['type']>(
    type: K,
    handler: Handler<Extract<T, { type: K }>>,
  ): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    const set = this.listeners.get(type)!;
    set.add(handler as Handler<T>);
    return () => set.delete(handler as Handler<T>);
  }

  emit(event: T): void {
    this.listeners.get(event.type)?.forEach(h => h(event));
  }

  clear(): void {
    this.listeners.clear();
  }
}
```

---

### 7. Re-export barrel (`src/types/index.ts`)

```ts
export * from '@/utils/vec2';
export * from '@/utils/math';
export * from '@/utils/color';
export * from '@/utils/rng';
export * from '@/types/entities';
export * from '@/types/events';
```

---

## Dependency Graph (this phase only)

```
vec2.ts    ─────────────────────────────────────────┐
math.ts    ──────────────────────────────────────────│
color.ts   ──────────────────────────────────────────┼──► types/index.ts
rng.ts     ──────────────────────────────────────────│
types/entities.ts (imports vec2, color) ─────────────┤
types/events.ts ────────────────────────────────────-┘
```

All arrows point inward — **no module in this layer imports from `tank/`,
`creatures/`, `particles/`, or `systems/`**.

---

## Acceptance Criteria

- [ ] `tsc --noEmit` passes with zero errors
- [ ] `vec2Add`, `vec2Sub`, `vec2Scale`, `vec2Normalise`, `vec2Limit` all have unit tests (Phase 14) passing
- [ ] `createRng` produces identical sequences for identical seeds (verified in tests)
- [ ] No class instances in `src/utils/` — all pure functions
- [ ] `EventBus` `on()` returns an unsubscribe function that works correctly
- [ ] All `const` enum objects follow the `as const` + derived type pattern

---

## Notes & Decisions

- **No `class Vec2`** — class-based vector incurs heap allocation on every
  operation. Struct-of-arrays or plain object literals with free functions is
  the modern performance pattern for tight simulation loops.
- **Mulberry32** was chosen over Math.random() because it is deterministic,
  fast (32-bit), and produces good uniform distribution for simulation use.
- **HSLA over RGBA** — procedural color generation is far more ergonomic in
  HSL space (hue rotation, saturation sweeps, lightness variation).
- `EventBus` lives in `types/` not `systems/` because it is a structural
  primitive, not a simulation system.
