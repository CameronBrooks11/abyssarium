# Changelog

All notable changes to Abyssarium are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.0] — 2026-03-07

Initial public release.

### Simulation core

- Fixed-timestep loop (1/60 s steps, accumulator-based) with α-interpolated
  rendering to eliminate visual jitter between physics ticks.
- 2D Jos Stam-lite velocity field — diffusion + exponential decay, bilinear
  sampling; no pressure solve.
- Semi-implicit Euler physics with per-body drag coefficients and hard-clamp
  wall-bounce boundary collisions.
- Fixed-cell spatial hash rebuilt each tick for O(1) neighbourhood queries
  (`queryRadius`, `rebuild`, `clear`).

### Creature system

- Four archetypes — Predator, Drifter, Grazer, Swarmer — each with distinct
  trait distributions for speed, aggression, glow, hue range, and body plan.
- Procedural species generation: Gaussian-distributed scale, two-hue palette,
  genus × descriptor naming from curated word lists.
- Lifecycle state machine: `Alive → Dying → Dead` with energy drain, `feed()`,
  `drain()`, and a 1.2 s dissolve timer.
- Five composable behavior modules applied per-archetype each tick:
  `wander`, `seekFood`, `avoidPredator`, `boids` (flocking), `fluidDrift`.
- Hunger priority override: `hunger > 0.85` triples food-seek weight and
  zeros wander to create urgency without a rigid FSM.
- `CreatureFactory.create()` accepts optional `overrides?: Partial<CreatureTraits>`
  to pin specific trait values without mutation.

### Particle system

- Three particle kinds: Food (settles downward, consumed on contact), Bubble
  (rises upward), Debris (spinning fragment on creature death).
- Hard cap of 600 particles; expired and dead entities pruned each tick.
- `spawnFood()` accepts an optional `colorOverride?: HSLA` for tinted variants
  (e.g. toxic food during a bloom event).

### Tank events

`TankEvent` is a discriminated union. `EventBus.on(type, handler)` narrows
the event type automatically — no casts required.

| Type | Effect |
|---|---|
| `AddFood` | Spawns N food particles at a given or random position |
| `ShakeTank` | Random impulses to all entities + fluid injection + turbulence spike |
| `LightPulse` | Boosts `lightIntensity`, spawns a bubble burst |
| `SpawnCreature` | Adds one creature at a given or random position (max 40) |
| `Catastrophe` | One of: PredatorSpawn, ToxicBloom, FreezingShock, OxygenStorm |

### Rendering

- Seven-layer Canvas 2D pipeline: background gradient (caustic shimmer) →
  glow offscreen pass (additive blending) → bubbles → Y-sorted creatures →
  food/debris → glow composite → light-pulse flash overlay.
- Five body-plan draw functions: Blob (pulsing radial gradient), Triangle
  (tail-flick dart), Star (multi-armed pulse), Worm (segmented chain),
  Orb (orbiting cluster).
- DPR-aware canvas sizing (capped at 2×) for sharp rendering on HiDPI displays.
- Per-creature position interpolation (`prevPosition` → `body.position` × α)
  eliminates fixed-timestep visual stutter.
- Dying animation: opacity fade + scale-down from 100 % → 60 % over 1.2 s.
- `OffscreenCanvas` fallback for browsers that do not support it.

### Infrastructure

- TypeScript 5.4 strict mode (`exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`). Zero runtime dependencies.
- Vite 7 dev/build, Vitest 3 unit tests (163 tests across 14 files,
  `environment: 'node'`).
- GitHub Actions CI — typecheck + tests + production build on every push and PR.
- GitHub Pages deploy workflow (`GITHUB_PAGES` env flag sets Vite `base`).
- `scripts/build.sh` — sequential typecheck → test → build for local/CI use.
