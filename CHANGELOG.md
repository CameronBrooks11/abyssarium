# Changelog

All notable changes to Abyssarium are documented here in reverse chronological
order. Each entry corresponds to a Git commit on `main`.

---

## [Phase 16] — 2026-03-07 `4d35379`

**CI/CD workflows, build script, agent-policy finalized, CI badge**

- Added `.github/workflows/ci.yml` — runs TypeScript type-check, unit tests,
  and a production Vite build on every push to `main`/`develop` and on all
  pull requests targeting `main`; uploads `dist/` and `coverage/` as artifacts.
- Added `.github/workflows/deploy.yml` — triggered only on `main` merge;
  builds with `GITHUB_PAGES=true` so Vite sets `base: '/abyssarium/'`, then
  deploys `dist/` to GitHub Pages via the official `actions/deploy-pages`
  action. Deploy job uses `concurrency: cancel-in-progress: true` to prevent
  race conditions on rapid successive merges.
- Added `scripts/build.sh` — bash convenience script that runs
  `tsc --noEmit` → `npm test` → `npm run build` in sequence with `set -euo
  pipefail`; intended for CI runners and Unix developer machines.
- Expanded `agent-policy.yaml` to its final form — added `deny_packages`
  fields for all three technology-stack exclusion rules (UI frameworks, physics
  engines, WebGL renderers), added `no-any-in-utils` / `max-creatures-cap` /
  `no-hardcoded-magic-numbers` quality rules, and added the `agent_guidelines`
  section documenting the full implementation chain expected when extending
  the simulation.
- Added CI status badge to `README.md`.

---

## [Phase 15] — 2026-03-07 `b234a2b`

**Docs, DPI scaling, death effects, drain/overrides API, colorOverride**

### Documentation
- Created `docs/concept.md` — user-facing explanation of the simulation: what
  Abyssarium is, what creatures do, what the five interaction buttons trigger,
  and what catastrophes are.
- Created `docs/ecosystem.md` — technical reference covering the four creature
  archetypes, energy loop, five body plans, four catastrophe kinds, and the key
  tuning constants.
- Rewrote `README.md` in full: project description, live-demo link, local dev
  instructions, all `npm` scripts, project directory tree, and development
  contribution notes.

### Canvas / Rendering
- `src/main.ts` — canvas is now sized at physical pixel resolution:
  `canvas.width = width * dpr; canvas.height = height * dpr` where
  `dpr = Math.min(devicePixelRatio ?? 1, 2)`, ensuring a crisp image on
  retina / HiDPI displays.
- `src/systems/Renderer.ts` — added `dpr` field; `render()` now calls
  `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` before drawing so all logical
  coordinates remain in CSS pixels; `resize()` scales the glow canvas by `dpr`;
  `renderGlowLayer()` likewise sets the transform on the offscreen context.
  Added `OffscreenCanvas` fallback: when `typeof OffscreenCanvas === 'undefined'`
  (e.g. older browsers) a regular `HTMLCanvasElement` is created instead,
  removing the hard runtime dependency on the Offscreen API.
- `src/systems/drawCreature.ts` — two new visual effects applied before the
  body-plan switch:
  - **Death scale-down**: when `globalAlpha < 1` (i.e. creature is dying), the
    context is scaled to `0.6 + globalAlpha * 0.4` so the creature shrinks as
    it fades out.
  - **Bioluminescence trail**: when `glowIntensity > 0.6` a soft filled circle
    at radius `× 1.2` is drawn behind the body using the primary palette colour
    at low opacity, creating a bloom/trail halo effect.

### API
- `src/creatures/Creature.ts` — added `drain(amount: number): void` — subtracts
  a given amount from energy (clamped at zero). Provides a named method for
  external systems to drain energy without reaching into the property directly.
- `src/creatures/CreatureFactory.ts` — `create()` now accepts an optional third
  parameter `overrides?: Partial<CreatureTraits>`. Overrides are shallow-merged
  into the procedurally generated traits after archetype randomisation, enabling
  callers to pin specific trait values (e.g. forcing `foodPreference: 'carnivore'`
  for a predator spawn) without mutating the object via `as any`.
- `src/particles/Food.ts` — `spawnFood()` accepts an optional third parameter
  `colorOverride?: HSLA`. When supplied it replaces the default randomised
  yellow-green food hue, enabling toxic food (green) or any other tinted variant.

### Interaction Handlers (clean-up)
- `src/systems/InteractionHandlers.ts`:
  - `handlePredatorSpawn` — replaced post-creation `as any` trait mutation with
    `factory.create(pos, rng, { aggression, speed, scale, foodPreference })`.
  - `handleToxicBloom` — replaced direct `c.energy = Math.max(0.1, c.energy * 0.45)`
    with `c.drain(c.energy * 0.55)` to use the new named API.
  - `handleToxicBloom` — replaced `(p as any).color = { h:120, ... }` with
    `spawnFood(pos, rng, hsla(120, 90, 45, 0.9))` using the new `colorOverride`
    parameter.

---

## [Phase 14] — 2026-03-07 `18d43e2`

**Testing — 194 tests across 14 files, Vitest config, rootDir fix**

- Added `vitest.config.ts` — `environment: 'node'`, `globals: false`, `@` alias
  pointing at `src/`, coverage excludes canvas/DOM code, verbose reporter.
- Fixed `tsconfig.json` `rootDir` from `"src"` to `"."` and added `"tests"` to
  `include` so TypeScript accepts test files under the project root.
- Removed `SLOP.md` (original mock-project spec file, superseded by planning
  docs and real implementation).
- Created 14 test files (194 tests total):
  - `tests/utils/vec2.test.ts` — 28 tests for all vector math helpers
  - `tests/utils/math.test.ts` — 21 tests covering lerp, clamp, remap,
    wrapAngle, angleDiff, smoothStep, smootherStep
  - `tests/utils/rng.test.ts` — 14 tests for Mulberry32 PRNG, rngFloat,
    rngInt, rngPick, rngChance, rngGaussian
  - `tests/utils/color.test.ts` — 11 tests for hsla, hslaToString,
    hslaLerp, hslaWithAlpha, hslaWithLightness
  - `tests/utils/spatialHash.test.ts` — 8 tests for SpatialHash insert,
    rebuild, queryRadius, clear, negative coordinates
  - `tests/tank/fluid.test.ts` — 7 tests for FluidGrid construction,
    sampleAt, addVelocityAt, step decay, out-of-bounds
  - `tests/tank/Tank.test.ts` — 12 tests for construction, resize, prune
    (creatures + particles), tickFields decay
  - `tests/particles/Particle.test.ts` — 15 tests for spawnFood, spawnBubble,
    spawnDebris factories
  - `tests/creatures/Creature.test.ts` — 19 tests for lifecycle state machine,
    energy drain/feed, drainEnergy transitions, feed cap, tickDying, segments,
    prevPosition
  - `tests/creatures/CreatureFactory.test.ts` — 10 tests for create(), species
    names, trait validity across 1 000 seeds, palette, body plan, food preference
  - `tests/systems/physics.test.ts` — 15 tests for applyForce, applyImpulse,
    PhysicsSystem integrate/drag/angular/clamp/resize
  - `tests/systems/steering.test.ts` — 12 tests for seek, flee, arrive, wander
  - `tests/systems/BehaviorSystem.test.ts` — 8 tests for energy drain, dying
    tick-down, dead transition, herbivore food-seek, food consumption
  - `tests/systems/InteractionHandlers.test.ts` — 14 tests covering all five
    handler branches (AddFood, ShakeTank, LightPulse, SpawnCreature, all four
    Catastrophe kinds)

---

## [Phase 13] — 2026-03-07 `b150447`

**Integration & bootstrap — `main.ts` wires all systems**

- Replaced the placeholder `src/main.ts` with full bootstrap code:
  - Resolves `#tank-canvas` and `#tank-container` DOM elements; throws if absent.
  - Instantiates Tank, PhysicsSystem, BehaviorSystem, ParticleSystem, Renderer,
    InputSystem, HUD, CreatureFactory with a shared Mulberry32 RNG.
  - Calls `registerInteractionHandlers(tank)` and `bindControls(input, tank, rng)`.
  - Spawns 12 initial creatures distributed across the tank, plus 30 food
    particles in the upper 60 % of the water column.
  - Hooks `loop.onStats(hud.createStatsListener())` for live FPS / creature
    count display.
  - Wires a debounced (120 ms) `window.resize` listener that updates canvas
    size, Tank bounds, PhysicsSystem bounds, and Renderer glow-canvas size in
    one atomic call.
  - Starts the fixed-timestep simulation loop.

---

## [Phase 12] — 2026-03-07 `2e289d1`

**Interaction handlers — AddFood, ShakeTank, LightPulse, SpawnCreature, Catastrophe**

- Created `src/systems/InteractionHandlers.ts`:
  - Module-level `sub` helper casts around the `EventBus.on` type narrowing
    limitation (flat `TankEvent` interface, not a discriminated union).
  - `handleAddFood` — spawns up to `count` food particles capped by
    `MAX_PARTICLES = 600`.
  - `handleShakeTank` — applies random impulses to all creatures and particles,
    injects turbulent velocity into the fluid grid at 80 px intervals, sets
    `tank.turbulence = 1.0`.
  - `handleLightPulse` — increments `tank.lightIntensity` (clamped at 1),
    spawns a burst of 15 bubble particles.
  - `handleSpawnCreature` — adds one creature at a specified or random position,
    respects `MAX_CREATURES = 40`.
  - `handleCatastrophe` — dispatches to four sub-handlers:
    - **PredatorSpawn** — spawns 1–2 high-aggression, high-speed, large-scale
      carnivore creatures at the top of the tank.
    - **ToxicBloom** — drains 55 % energy from all alive creatures, injects
      upward fluid velocity, spawns 25 green food particles.
    - **FreezingShock** — scales all creature velocities to 5 %, particle
      velocities to 8 %, injects counter-velocity into the fluid field, dims
      `lightIntensity` to 0.6.
    - **OxygenStorm** — spawns 80 bubble particles across the tank floor,
      injects strong upward fluid velocity, applies random upward impulses to
      all creatures.

---

## [Phase 11] — 2026-03-07 `cb0d6dc`

**Input system, controls binding, HUD**

- `src/systems/InputSystem.ts` — completed with a `TankEvent` queue, `push()`
  method, and `flush()` that drains the queue into the EventBus; supports
  keyboard shortcuts and programmatic event injection.
- `src/ui/controls.ts` — `bindControls(input, tank, rng)` wires the five
  toolbar buttons in `index.html` to the correct `TankEvent` payloads:
  Add Food, Shake Tank, Light Pulse, Spawn Creature, and a random-kind
  Catastrophe button.
- `src/ui/HUD.ts` — `createStatsListener()` returns a `StatsCallback`
  compatible with `SimulationLoop.onStats()`; updates the `#hud` overlay with
  FPS, creature count, and particle count each frame.

---

## [Phase 10] — 2026-03-07 `0ea459c`

**Renderer — background, creature draw, particle draw, glow offscreen**

- `src/systems/Renderer.ts` — full seven-layer render pipeline:
  background → glow (offscreen additive) → bubbles → creatures (Y-sorted,
  interpolated) → food/debris → glow composite (`lighter`, 75 % opacity) →
  light-pulse screen flash. Dying creatures rendered with `dyingAlpha` fading
  over 1.2 s.
- `src/systems/drawBackground.ts` — deep-ocean gradient with a subtle
  time-driven caustic shimmer using `Math.sin` on a grid of sample points.
- `src/systems/drawCreature.ts` — five body-plan draw functions:
  - **Blob** — radial gradient teardrop with an 8 % pulsing scale.
  - **Triangle** — filled + stroked triangle with a tail-flick animation.
  - **Star** — N-pointed star (N from `spineCount`) with a slow pulse.
  - **Worm** — world-space segment chain rendered back-to-front; undoes the
    parent transform and re-draws each segment with size and alpha tapering
    toward the tail.
  - **Orb cluster** — N satellite orbs orbiting a bright central core.
- `src/systems/drawParticle.ts` — draws food (spinning quad), bubbles
  (circle outline with inner highlight), and debris (spinning rectangle with
  alpha fade tied to remaining life).

---

## [Phase 09] — 2026-03-07 `89fda39`

**Behavior system — wander, seekFood, avoidPredator, boids, fluidDrift**

- `src/creatures/behaviors/wander.ts` — randomised angular drift using the
  creature's per-tick `wanderAngle`, returns a steering force and updated angle.
- `src/creatures/behaviors/seekFood.ts` — queries `SpatialHash` for food
  particles within `perceptionRadius`; uses `arrive()` steering with the
  nearest food as target; consumes the particle on contact and calls
  `creature.feed()`.
- `src/creatures/behaviors/avoidPredator.ts` — queries for nearby carnivore
  creatures; sums weighted `flee()` forces proportional to inverse distance.
- `src/creatures/behaviors/boids.ts` — classic Reynolds three-rule flocking
  (separation, alignment, cohesion) over nearby same-species neighbours found
  via `SpatialHash`.
- `src/creatures/behaviors/fluidDrift.ts` — samples fluid velocity at the
  creature's position and converts it to a steering force scaled by
  `fluidSensitivity`.
- `src/systems/BehaviorSystem.ts` — expanded full implementation: builds
  `SpatialHash` each tick, dispatches the appropriate behavior mix per
  creature archetype, calls `drainEnergy(dt)` on alive creatures, calls
  `tickDying(dt)` on dying ones, applies accumulated steering force through
  `applyForce()`.

---

## [Phase 08] — 2026-03-07 `bc57d1d`

**Creature factory — archetypes, palette, species names, Gaussian scale**

- Created `src/creatures/CreatureFactory.ts`:
  - Four archetypes: Herbivore, Carnivore, Omnivore, Scavenger — each with
    distinct trait weight ranges for speed, aggression, scale, perception,
    energy drain rate, and food preference.
  - Palette generation: picks a base hue from a per-archetype range with
    Gaussian jitter; chooses a complementary or analogous accent colour.
  - Species name generation: two-word combinatorial name from
    curated adjective × noun lists seeded from the RNG.
  - Scale drawn from a Gaussian distribution (`rngGaussian`) to give a natural
    spread of creature sizes rather than a flat uniform distribution.
  - Body plan, segment count, spine count, and fluid sensitivity all randomised
    within archetype-appropriate ranges.

---

## [Phase 07] — 2026-03-07 `ea466a4`

**Creature model — lifecycle, energy, segments, flocking state**

- `src/creatures/Creature.ts` fully implemented:
  - `lifeState` state machine (`Alive` → `Dying` → `Dead`).
  - `drainEnergy(dt)` — decreases energy by `energyDrainRate × dt`; transitions
    to `Dying` and starts a `dyingTimer` when energy reaches zero; updates
    `hunger` as the inverse of normalised energy.
  - `feed(amount)` — increases energy capped at 100.
  - `drain(amount)` — subtracts a fixed amount from energy clamped at zero.
  - `tickDying(dt)` — counts down `dyingTimer`; returns `true` and sets state
    to `Dead` when the timer expires.
  - `recordPrevPosition()` — snapshots `body.position` into `prevPosition` for
    render interpolation.
  - `updateSegments(spacing)` — drags each segment toward the one ahead of it
    using a spring-like follow, used by the worm body plan.
  - Derived getters: `position`, `radius` (scale × base radius), `mass`.

---

## [Phase 06] — 2026-03-07 `705a231`

**Particle system — Food, Bubble, Debris, ParticleSystem**

- `src/particles/Food.ts` — `spawnFood(position, rng, colorOverride?)` — drifts
  gently downward with slight horizontal spread; Particle kind `Food`; life
  12–20 s; accepts an optional `HSLA` color override for tinted variants.
- `src/particles/Bubble.ts` — `spawnBubble(position, rng)` — rises upward with
  gentle horizontal drift; Particle kind `Bubble`; small radius 2–5 px.
- `src/particles/Debris.ts` — `spawnDebris(position, rng)` — rectangular
  spinning fragment from creature death; Particle kind `Debris`; randomised
  spin, muted grey-brown colour.
- `src/particles/Particle.ts` — expanded from stub to full class: `kind`,
  `body` (via `makeBody`), `prevPosition`, `radius`, `life`, `maxLife`,
  `color` (HSLA), `spin`; `position` getter forwarding to `body.position`.
- `src/systems/ParticleSystem.ts` — `update(tank, dt)` integrates all particle
  bodies, bounces off walls, decays `life`, removes expired particles;
  hard cap of 600 particles.

---

## [Phase 05] — 2026-03-07 `626be42`

**Simulation loop (stub phase 5)**

- `src/tank/SimulationLoop.ts` — full fixed-timestep loop:
  - 1/60 s physics step (`DT = 1/60`); accumulator-based tick scheduling so
    rendering never runs more than one frame behind.
  - `start()` / `stop()` via `requestAnimationFrame` / `cancelAnimationFrame`.
  - `onStats(cb)` — registers a callback receiving `{ fps, creatures, particles }`
    fired once per rendered frame.
  - Calls `tank.tickFields(dt)`, `physics.update(tank, dt)`,
    `behaviors.update(tank, dt)`, `particles.update(tank, dt)`, then
    `input.flush(tank)`, then `renderer.render(tank, alpha)`.
- Stub placeholders for `BehaviorSystem`, `InputSystem`, `ParticleSystem`, and
  `Renderer` (all later replaced in Phases 09–11).

---

## [Phase 04] — 2026-03-07 `19709d6`

**Fluid and tank (commit "idk anymore")**

- `src/tank/Fluid.ts` — 2D Jos Stam-lite velocity grid:
  - `defaultFluidConfig()` — 40 px cell size, derived `cols`/`rows` from tank
    dimensions.
  - `addVelocityAt(x, y, vx, vy)` — injects velocity into the containing cell.
  - `sampleAt(x, y)` — bilinear interpolation over the four surrounding cells,
    returns zero outside bounds.
  - `step(dt)` — diffusion pass (velocity spread to neighbours) followed by
    exponential decay (`0.98^dt`).
- `src/tank/Tank.ts` — central simulation container:
  - Holds `creatures[]`, `particles[]`, `fluid`, `events` (typed EventBus),
    `time`, `lightIntensity`, `turbulence`, `width`/`height`.
  - `resize(w, h)` — updates dimensions and rebuilds `FluidGrid`.
  - `prune()` — removes `Dead` creatures and particles with `life ≤ 0`.
  - `tickFields(dt)` — advances `time`, decays `lightIntensity` and `turbulence`
    toward zero, steps the fluid grid.
- `src/creatures/Creature.ts` — initial stub with `body`, `traits`, `segments`,
  `prevPosition`, `glowIntensity`, `animPhase`, `wanderAngle`, `dyingTimer`,
  `energy`, `hunger`, `lifeState` fields established.
- `src/particles/Particle.ts` — initial stub for the particle base class.

---

## [Phase 03] — 2026-03-07 `15332b4`

**Physics engine**

- `src/systems/Physics.ts`:
  - `RigidBody` — position, velocity, acceleration, angle, angularVelocity,
    mass, drag fields; `makeBody(pos, vel, mass, drag)` factory.
  - `applyForce(body, force)` — accumulates `F/m` onto acceleration.
  - `applyImpulse(body, impulse)` — adds directly to velocity.
  - `PhysicsSystem` — `update(tank, dt)` integrates all creature and particle
    bodies: semi-implicit Euler step, drag applied as `vel × (1 − drag)^dt`,
    angular velocity advancing angle, acceleration cleared after integration,
    `clampToBounds` wall bounce.
  - `defaultPhysicsConfig()` — returns a fully typed config object.
- `src/utils/spatialHash.ts` — fixed-cell spatial hash for broad-phase
  neighbourhood queries: `insert(id, pos)`, `rebuild(items)`, `queryRadius(pos,
  r)`, `clear()`; handles negative coordinates and cross-cell radius queries.
- `src/utils/steering.ts` — autonomous steering forces:
  `seek`, `flee`, `arrive` (with slow-radius deceleration), `wander`
  (angle-jitter circle projection); all capped by `maxForce`.

---

## [Phase 02] — 2026-03-07 `3d8038b`

**Math and shared types**

- `src/types/entities.ts` — `BodyPlan`, `FoodPreference`, `CreatureLifeState`
  string-const enums; `CreatureTraits`, `FlockingState` interfaces;
  `TankEventType`, `CatastropheKind` event-type constants; `ParticleKind`
  discriminated string union; `nextId()` monotonic ID counter.
- `src/types/events.ts` — `TankEventPayload` flat interface union covering all
  five event types; typed `EventBus<T>` with `on(type, handler)` → unsubscribe
  and `emit(event)`.
- `src/types/index.ts` — re-exports all types for a single import surface.
- `src/utils/color.ts` — `HSLA` type; `hsla(h, s, l, a?)` factory (alpha
  defaults to 1); `hslaToString()` → CSS `hsla(...)` string; `hslaLerp()`
  short-path hue interpolation; `hslaWithAlpha()` / `hslaWithLightness()`
  copy-with helpers.
- `src/utils/math.ts` — `lerp`, `clamp`, `remap`, `wrapAngle`, `angleDiff`
  (shortest signed path), `smoothStep`, `smootherStep`.
- `src/utils/rng.ts` — `Rng` type alias; `createRng(seed)` returns a
  Mulberry32 generator; `rngFloat(rng, min, max)`, `rngInt(rng, min, max)`,
  `rngPick(rng, arr)`, `rngChance(rng, p)`, `rngGaussian(rng)` (Box-Muller).
- `src/utils/vec2.ts` — `Vec2` interface; full library of pure functions:
  `vec2`, `vec2Zero`, `vec2Clone`, `vec2Add`, `vec2Sub`, `vec2Scale`,
  `vec2Negate`, `vec2Lerp`, `vec2Len`, `vec2LenSq`, `vec2Dist`, `vec2DistSq`,
  `vec2Dot`, `vec2Cross`, `vec2Normalise`, `vec2Limit`, `vec2Reflect`,
  `vec2Rotate`, `vec2Angle`, `vec2FromAngle`, `vec2Clamp`.
- Updated `package.json` with `vitest` dev dependency.

---

## [Bootstrap] — 2026-03-07 `a0abf03` + `0880dea` + `e35fc4e`

**Project scaffold**

- `vite.config.ts` — Vite 5 config; `publicDir: 'public'`; `GITHUB_PAGES`
  env-flag gates `base: '/abyssarium/'` for GitHub Pages deploys vs `'/'`
  locally; `@` path alias resolving to `src/`.
- `tsconfig.json` — TypeScript 5.4 strict mode with `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `bundler` moduleResolution, `@/*` → `src/*`
  path mapping; `rootDir: "."`, includes `src` and `tests`.
- `package.json` — scripts: `dev`, `build`, `preview`, `format`, `format:check`,
  `test`; dev dependencies: `vite`, `typescript`, `vitest`, `prettier`.
- `index.html` — full single-page shell: `#tank-container` flex wrapper,
  `#tank-canvas` full-size canvas, `#toolbar` with five buttons (Add Food,
  Shake, Light Pulse, Spawn, Catastrophe), `#hud` stats overlay, CSS reset and
  deep-ocean background, button hover/active states.
- `agent-policy.yaml` — initial policy document.
- `.prettierrc` — `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`.
- `.gitignore`, `LICENSE` (MIT), placeholder `.gitkeep` files for all source
  directories.
- `package-lock.json` generated; deps upgraded to latest compatible ranges.

---

## [Planning] — 2026-03-07 `ea36715`

**16-phase project plan**

- Authored full planning documents for all 16 phases:
  Phases 01–16 covering foundation, math, physics, fluid, simulation loop,
  particles, creature model, creature factory, behaviors, renderer, UI, interactions,
  integration, testing, docs/polish, and CI/CD.
- Renamed `SLOP` → `SLOP.md` (original mock-project spec used to seed the AI
  planning session).

---

## [Initial commit] — 2026-03-07 `7565bcb`

- `.gitignore` (Node/Vite standard excludes)
- `LICENSE` (MIT, Cameron Brooks)
- `README.md` stub
