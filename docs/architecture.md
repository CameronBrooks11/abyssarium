# Abyssarium — Architecture & Design Decisions

This document captures the technical architecture, design rationale, and key
constants that govern the codebase. Read this before extending any core system.

---

## Module Structure

```
src/
├── main.ts                     Bootstrap — constructs all systems, starts loop
├── tank/
│   ├── Tank.ts                 Aggregate root — owns all simulation state
│   ├── Fluid.ts                2D velocity field
│   └── SimulationLoop.ts       Fixed-timestep orchestrator
├── creatures/
│   ├── Creature.ts             Data container + lifecycle state machine
│   ├── CreatureFactory.ts      Procedural creature generator
│   └── behaviors/              One file per behavior function (pure)
│       ├── wander.ts
│       ├── seekFood.ts
│       ├── avoidPredator.ts
│       ├── boids.ts
│       └── fluidDrift.ts
├── particles/
│   ├── Particle.ts             Base particle class
│   ├── Food.ts
│   ├── Bubble.ts
│   └── Debris.ts
├── systems/
│   ├── Physics.ts              Integration, drag, boundary, spatial hash helpers
│   ├── BehaviorSystem.ts       Drives all creature AI each fixed step
│   ├── ParticleSystem.ts       Particle lifecycle, debris spawning
│   ├── Renderer.ts             Read-only canvas rendering
│   ├── InputSystem.ts          Event queue buffering
│   ├── InteractionHandlers.ts  TankEvent side-effect handlers
│   ├── drawCreature.ts         Per-body-plan draw functions
│   ├── drawParticle.ts
│   └── drawBackground.ts
├── types/
│   ├── entities.ts             All entity interfaces, ID types, const enums
│   ├── events.ts               TankEvent definitions, EventBus<T>
│   └── index.ts                Re-export surface
└── utils/
    ├── vec2.ts                 Pure Vec2 function library
    ├── math.ts                 Scalar helpers
    ├── color.ts                HSLA type + helpers
    ├── rng.ts                  Mulberry32 PRNG + distributions
    ├── spatialHash.ts          Generic grid spatial hash
    └── steering.ts             Autonomous steering forces
```

---

## Core Design Principles

### 1. Separated data from behaviour
`Creature` is a pure data container. `BehaviorSystem` reads and writes it from
outside. There is no `creature.think()`, no `creature.draw()`. This makes
systems independently testable in Node without a canvas or DOM.

### 2. No external runtime dependencies
Everything — physics, fluid, PRNG, math, rendering — is hand-written TypeScript.
`devDependencies` only: `vite`, `typescript`, `vitest`, `prettier`.

### 3. DOM isolation
Only `src/main.ts`, `src/ui/`, `src/systems/InputSystem.ts`, and
`src/systems/Renderer.ts` may touch the DOM. All other modules are
`environment: 'node'` testable.

### 4. Constructor injection, no singletons
All system instances are constructed in `main.ts` and injected. No
`getInstance()`. The only module-level mutable state allowed is in
`main.ts` itself (e.g. the resize timer reference).

### 5. Value types for math
`Vec2` is a plain `{ x, y }` object, not a class. All operations are pure
free functions (`vec2Add`, `vec2Scale`, etc.). This keeps hot-path allocation
controlled and values trivially serialisable. Input arguments are
`Readonly<Vec2>`.

### 6. Enums as `const` objects
TypeScript `enum` has runtime overhead and tree-shaking issues. Pattern used
throughout:
```ts
export const BodyPlan = { Blob: 'blob', Triangle: 'triangle', ... } as const;
export type BodyPlan = typeof BodyPlan[keyof typeof BodyPlan];
```

### 7. `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
Both enabled in `tsconfig.json`. Be explicit about `undefined` presence in
optional fields and always guard array index access.

---

## System Update Order (per fixed step)

Each fixed step inside `SimulationLoop` runs in this exact order:

```
1. input.flush(tank)               — drain UI event queue → emit to tank.events
2. tank.creatureHash.rebuild(...)  — rebuild spatial hash for creature queries
3. tank.particleHash.rebuild(...)  — rebuild spatial hash for particle queries
4. tank.fluid.step(dt)            — diffuse + decay velocity field
5. behaviors.update(tank, dt)     — compute steering forces → apply to body.acceleration
6. physics.integrate(bodies, dt)  — consume acceleration → velocity → position
7. physics.clampToBounds(...)      — wall bounce
8. particles.update(tank, dt)     — lifecycle decay, debris spawn from dead creatures
9. tank.prune()                   — remove Dead creatures + expired particles
10. tank.tickFields(dt)           — advance time, decay lightIntensity/turbulence
```

After all fixed steps:
```
11. renderer.render(tank, alpha)  — interpolated render, read-only
```

---

## Fixed Timestep Loop

```
FIXED_DT  = 1/60 s   (≈16.67ms per physics step)
MAX_DT    = 1/20 s   (50ms cap — prevents spiral of death on tab blur)
MAX_STEPS = 5        (max fixed steps per render frame)
```

Wall-clock `Δt` is capped and consumed in `FIXED_DT` slices. The remainder
drives the `alpha` interpolation value passed to the renderer, eliminating
visual jitter between physics ticks. FPS is tracked with an exponential moving
average (EMA) to smooth display.

---

## Physics

**Integration method:** Semi-implicit Euler (velocity integrated before position).
More stable than explicit Euler for the spring-like steering forces.

**Force accumulator pattern:** External code never directly sets velocity.
`applyForce(body, f)` accumulates `f/m` onto `body.acceleration`.
`applyImpulse(body, j)` adds directly to velocity for instantaneous effects
(explosions, catastrophes). Acceleration is zeroed after each integration step.

**Drag:** Applied as `velocity × (1 − drag)^dt`. Each body carries its own
`drag` coefficient set at creation time.

**Boundary collisions:** Hard clamp + zero outward velocity component on
contact. Creatures get a `radius`-width margin; particles use a 0px margin.

**Spatial hash:** Cantor pairing hash to convert 2D cell coordinates (including
negatives) to a single integer key. Rebuilt from scratch each fixed step
(faster than maintaining incremental inserts for fast-moving entities).
Cell size = 80px (≈ 2× largest typical creature radius).

---

## Fluid Field

A simplified Jos Stam-style 2D velocity grid — diffusion + exponential decay
only. No pressure solve, no advection of density.

```
Cell size:  40px
Cols/rows:  Math.ceil(width / 40)  ×  Math.ceil(height / 40)
Diffusion:  0.12  (spread to neighbours per second)
Decay:      0.55  (velocity × (1 − 0.55)^dt per step)
```

Velocity is stored as an interleaved `Float32Array` for cache locality.
`sampleAt(px, py)` bilinearly interpolates over the four surrounding cells.
`addVelocityAt(px, py, vx, vy)` injects into the containing cell; events
(ShakeTank, OxygenStorm) call this across a grid of points.

---

## Behavior Composition

Each creature gets a weighted sum of steering forces each tick:

| Behavior | Applied when | Weight multiplier |
|---|---|---|
| Wander | Always (base locomotion) | 1.0 |
| SeekFood | `foodPreference != 'carnivore'` | 1.0; ×3.0 when hunger > 0.85 |
| AvoidPredator | `aggression ≤ 0.6` | 1.0; suppressed for apex predators |
| Boids | Always (same-species only) | 1.0 |
| FluidDrift | Always | `traits.fluidSensitivity` |

Wander is **suppressed** when the creature has a live food target or a live
threat target (to prevent directional noise from fighting against goal-seeking).

**Priority override:** When `hunger > 0.85`, food-seek weight is multiplied by
3× and wander weighting is zeroed. This creates urgency without a rigid FSM.

### Key behavior constants

| Constant | Value | Location |
|---|---|---|
| Perception radius (food) | 180 px | `seekFood.ts` |
| Eat distance | 16 px radius | `seekFood.ts` |
| Food energy gain | +18 energy | `seekFood.ts` |
| Threat radius | 200 px | `avoidPredator.ts` |
| Wander circle radius | 30 | `wander.ts` |
| Wander circle distance | 60 | `wander.ts` |
| Wander jitter | 0.5 | `wander.ts` |
| Boids separation radius | ~50 px | `boids.ts` |
| Threat detection: a creature is a threat if | `other.aggression > self.aggression + 0.25` AND `other.scale > self.scale - 0.2` | `avoidPredator.ts` |

---

## Creature Archetypes (full detail)

The factory picks one of four archetypes, then samples traits from
archetype-specific ranges using Gaussian distributions.

| Archetype | Speed range | Aggression | Glow | Hue range | Body plans |
|---|---|---|---|---|---|
| Predator | 150–280 | 0.6–1.0 | 0.1–0.4 | 340–20 (reds/magentas) | Triangle, Blob |
| Drifter | 30–90 | 0.0–0.2 | 0.4–0.9 | 175–240 (teals/blues) | Blob, Orb |
| Grazer | 60–140 | 0.0–0.3 | 0.2–0.6 | 70–160 (greens/cyans) | Star, Blob |
| Swarmer | 100–200 | 0.1–0.4 | 0.3–0.7 | 250–310 (purples/violets) | Orb, Triangle |

Scale is sampled from a **Gaussian distribution** (not uniform) to produce a
natural spread of creature sizes. The accent colour is a hue rotation of ±60°
from the base hue.

### Species names
Genus × Descriptor pairs drawn from:
- Genera: `Vorpex, Nycthal, Umbrix, Caelith, Pyroth, Azuron, Thalvex, Eridan, Obsidix, Marevh`
- Descriptors: `minor, magnus, obscurus, radians, profundus, tenuis, luminax, frigidus, velox, gravi`

---

## Rendering

**Layer stack (drawn in order):**
1. Background gradient + caustic shimmer (`drawBackground.ts`)
2. Glow pass on offscreen canvas (additive `globalCompositeOperation: 'lighter'`)
3. Bubble particles (behind creatures)
4. Creatures sorted back-to-front by interpolated Y
5. Food + debris particles (in front of creatures)
6. Glow offscreen composited at 75% opacity
7. Light-pulse screen flash overlay

**Glow via offscreen canvas:** Per-creature radial gradients drawn to an
`OffscreenCanvas` (or `HTMLCanvasElement` fallback when `OffscreenCanvas` is
unavailable), then composited with additive blending. This is significantly
cheaper than `ctx.shadowBlur` per creature, which forces GPU layer flushes.

**Position interpolation:** `prevPosition` is snapshotted each physics tick.
The renderer receives `alpha = accumulator / FIXED_DT ∈ [0, 1)` and lerps
between `prevPosition` and `body.position`. This eliminates visual jitter from
the fixed timestep.

**DPR scaling:** `dpr = Math.min(window.devicePixelRatio ?? 1, 2)`. Canvas
physical size is `logical × dpr`. `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` is
called at the start of each render so all drawing coordinates remain in CSS
(logical) pixels.

**Dying animation:** `dyingAlpha = dyingTimer / 1.2` drives both opacity fade
and a scale-down from 100% → 60% over the 1.2 s dying window.

---

## TankEvent

`TankEvent` is a **discriminated union** — TypeScript's `Extract<TankEvent, { type: K }>`
narrows correctly inside `EventBus.on` handlers, so no casts are required:

```ts
tank.events.on('AddFood', ({ position, count }) => { /* fully typed */ });
```

To add a new event type, append a variant to the `TankEvent` union in
`src/types/entities.ts`, add a handler in `InteractionHandlers.ts`, a queue
method in `InputSystem.ts`, and a button binding in `controls.ts`.

---

## Input Event Flow

```
User clicks button
    │
    ▼
controls.ts handler
    │  input.queueXxx(...)
    ▼
InputSystem.queue[]    (buffered — avoids RAF/DOM race)
    │
    ▼  input.flush(tank) — called at start of each fixed step
    ▼
tank.events.emit(event)
    │
    ▼
InteractionHandlers subscribers → mutate Tank state
```

Buffering prevents synchronisation hazards between the `requestAnimationFrame`
loop and the DOM event loop. Events are always processed at the start of a
deterministic fixed step.

---

## TypeScript Configuration Notes

| Setting | Value | Why |
|---|---|---|
| `moduleResolution` | `bundler` | Required for Vite + path aliases |
| `rootDir` | `.` | Must include `tests/` alongside `src/` |
| `exactOptionalPropertyTypes` | `true` | Prevents accidental `undefined` in optional fields |
| `noUncheckedIndexedAccess` | `true` | Forces guards on all array index reads |
| `@/*` alias | → `src/*` | Clean import paths, no relative `../../../` |

---

## Testing Notes

Tests run in `environment: 'node'` (Vitest). Canvas, DOM, and RAF are not
available in tests. All simulation code (`src/tank/`, `src/creatures/`,
`src/particles/`, `src/systems/Physics.ts`, `src/systems/BehaviorSystem.ts`,
`src/utils/`) is deliberately DOM-free for this reason.

`src/systems/Renderer.ts` is excluded from coverage — it is untestable in
Node due to its canvas dependency.

When adding a new module under `src/systems/`, `src/creatures/`, or
`src/utils/`, a corresponding test file in `tests/` is required (see
`agent-policy.yaml`).
