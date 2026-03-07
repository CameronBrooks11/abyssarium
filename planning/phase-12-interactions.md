# Phase 12 — Interaction Handlers

## Goal

Implement the concrete `TankEvent` handler logic — the code that subscribes to
`tank.events` and executes the visible, interesting effects of each user action.
This is where all five interaction types (Add Food, Shake Tank, Light Pulse,
Spawn Creature, Catastrophe) come to life as real simulation state changes.

---

## Design Principles

1. **Each interaction is a self-contained handler** — one function per event
   type, registered on the `EventBus`. Side effects are local and explicit.
2. **Handlers modify `Tank` state, not DOM** — they push particles, set field
   values, spawn creatures, apply impulses.
3. **Catastrophe is randomised but fair** — each catastrophe kind has its own
   well-defined effect that is dramatic but does not hard-reset the tank.
4. **All handlers tested independently** — by constructing a minimal `Tank` and
   emitting an event directly, without needing a running `SimulationLoop`.

---

## Files Produced

| File | Exports |
|---|---|
| `src/systems/InteractionHandlers.ts` | `registerInteractionHandlers()` |

---

## Step-by-Step Execution

### 1. Handler Registration (`src/systems/InteractionHandlers.ts`)

```ts
import type { Tank }           from '@/tank/Tank';
import type { TankEvent }      from '@/types/entities';
import { TankEventType, CatastropheKind } from '@/types/entities';
import { spawnFood }           from '@/particles/Food';
import { spawnBubble }         from '@/particles/Bubble';
import { CreatureFactory }     from '@/creatures/CreatureFactory';
import { applyImpulse, applyForce } from '@/systems/Physics';
import { createRng, rngFloat, rngInt, rngPick } from '@/utils/rng';
import { vec2 }                from '@/utils/vec2';
import { CreatureLifeState }   from '@/types/entities';

const rng     = createRng(Date.now() & 0xffffffff);
const factory = new CreatureFactory();

/** Maximum number of player-spawned creatures. */
const MAX_CREATURES = 40;

/**
 * Register all TankEvent handlers on tank.events.
 * Call this once during initialisation (Phase 13).
 * Returns an array of unsubscribe functions.
 */
export const registerInteractionHandlers = (tank: Tank): (() => void)[] => [
  tank.events.on('AddFood',       (e) => handleAddFood(tank, e)),
  tank.events.on('ShakeTank',     (e) => handleShakeTank(tank, e)),
  tank.events.on('LightPulse',    (e) => handleLightPulse(tank, e)),
  tank.events.on('SpawnCreature', (e) => handleSpawnCreature(tank, e)),
  tank.events.on('Catastrophe',   (e) => handleCatastrophe(tank, e)),
];

// ── Add Food ──────────────────────────────────────────────────────────────────

const handleAddFood = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.AddFood) return;
  const { position, count } = event.payload;
  const cap = Math.min(count, 600 - tank.particles.length);
  for (let i = 0; i < cap; i++) {
    tank.particles.push(spawnFood(position, rng));
  }
};

// ── Shake Tank ────────────────────────────────────────────────────────────────

const handleShakeTank = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.ShakeTank) return;
  const { magnitude } = event.payload;

  // Apply random impulse to every creature and particle
  for (const creature of tank.creatures) {
    const angle = rngFloat(rng, 0, Math.PI * 2);
    applyImpulse(creature.body, {
      x: Math.cos(angle) * magnitude,
      y: Math.sin(angle) * magnitude,
    });
  }
  for (const p of tank.particles) {
    const angle = rngFloat(rng, 0, Math.PI * 2);
    applyImpulse(p.body, {
      x: Math.cos(angle) * magnitude * 1.5,
      y: Math.sin(angle) * magnitude * 1.5,
    });
  }

  // Inject fluid turbulence throughout the grid
  const step = 80;
  for (let x = step / 2; x < tank.width; x += step) {
    for (let y = step / 2; y < tank.height; y += step) {
      tank.fluid.addVelocityAt(
        x, y,
        rngFloat(rng, -magnitude * 0.8, magnitude * 0.8),
        rngFloat(rng, -magnitude * 0.8, magnitude * 0.8),
      );
    }
  }

  tank.turbulence = 1.0;
};

// ── Light Pulse ───────────────────────────────────────────────────────────────

const handleLightPulse = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.LightPulse) return;
  const { intensity } = event.payload;
  tank.lightIntensity = Math.min(1, tank.lightIntensity + intensity);

  // Spawn a burst of ambient bubble particles (light disturbs water)
  const burstCount = 15;
  for (let i = 0; i < burstCount; i++) {
    if (tank.particles.length >= 600) break;
    tank.particles.push(
      spawnBubble({
        x: rngFloat(rng, 0, tank.width),
        y: rngFloat(rng, tank.height * 0.3, tank.height),
      }, rng),
    );
  }
};

// ── Spawn Creature ────────────────────────────────────────────────────────────

const handleSpawnCreature = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.SpawnCreature) return;
  if (tank.creatures.filter(c => c.lifeState !== CreatureLifeState.Dead).length >= MAX_CREATURES) return;

  const position = event.payload.position ?? {
    x: rngFloat(rng, tank.width * 0.1, tank.width * 0.9),
    y: tank.height * 0.05,
  };

  tank.creatures.push(factory.create(position, rng));
};

// ── Catastrophe ───────────────────────────────────────────────────────────────

const handleCatastrophe = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.Catastrophe) return;

  switch (event.payload.kind) {
    case CatastropheKind.PredatorSpawn:
      handlePredatorSpawn(tank);
      break;
    case CatastropheKind.ToxicBloom:
      handleToxicBloom(tank);
      break;
    case CatastropheKind.FreezingShock:
      handleFreezingShock(tank);
      break;
    case CatastropheKind.OxygenStorm:
      handleOxygenStorm(tank);
      break;
  }
};

// ── Catastrophe: Predator Spawn ───────────────────────────────────────────────

const handlePredatorSpawn = (tank: Tank): void => {
  // Spawn 1–2 large predators at the top
  const count = rngInt(rng, 1, 2);
  for (let i = 0; i < count; i++) {
    const creature = factory.create({
      x: rngFloat(rng, tank.width * 0.2, tank.width * 0.8),
      y: tank.height * 0.03,
    }, rng);
    // Force predator traits
    (creature.traits as any).aggression    = rngFloat(rng, 0.8, 1.0);
    (creature.traits as any).speed         = rngFloat(rng, 180, 260);
    (creature.traits as any).scale         = rngFloat(rng, 1.6, 2.5);
    (creature.traits as any).foodPreference = 'carnivore';
    tank.creatures.push(creature);
  }
};

// ── Catastrophe: Toxic Bloom ──────────────────────────────────────────────────

const handleToxicBloom = (tank: Tank): void => {
  // Halve energy of all alive creatures and add large fluid disturbance
  for (const c of tank.creatures) {
    if (c.lifeState === CreatureLifeState.Alive) {
      c.energy = Math.max(0.1, c.energy * 0.45);
    }
  }

  // Inject a slow upward fluid current across the whole tank (toxic gas rising)
  for (let x = 0; x < tank.width; x += 40) {
    tank.fluid.addVelocityAt(x, tank.height * 0.8, 0, -60);
  }

  // Spawn weird green food particles (toxic bait)
  for (let i = 0; i < 25; i++) {
    if (tank.particles.length >= 600) break;
    const p = spawnFood({
      x: rngFloat(rng, 0, tank.width),
      y: rngFloat(rng, tank.height * 0.2, tank.height * 0.8),
    }, rng);
    // Override color to toxic green
    (p as any).color = { h: 120, s: 90, l: 45, a: 0.9 };
    tank.particles.push(p);
  }
};

// ── Catastrophe: Freezing Shock ───────────────────────────────────────────────

const handleFreezingShock = (tank: Tank): void => {
  // Drastically slow all creature velocities
  for (const c of tank.creatures) {
    c.body.velocity = {
      x: c.body.velocity.x * 0.05,
      y: c.body.velocity.y * 0.05,
    };
  }
  // Slow all particle velocities
  for (const p of tank.particles) {
    p.body.velocity = {
      x: p.body.velocity.x * 0.08,
      y: p.body.velocity.y * 0.08,
    };
  }
  // Drain fluid
  const zeroFluid = tank.fluid;
  // (FluidGrid has no full-zero API; steer through shock decay naturally)
  // Instead, nuke the fluid by adding strong counter-velocities
  for (let x = 0; x < tank.width; x += 40) {
    for (let y = 0; y < tank.height; y += 40) {
      const v = zeroFluid.sampleAt(x, y);
      zeroFluid.addVelocityAt(x, y, -v.x * 1.8, -v.y * 1.8);
    }
  }
  tank.lightIntensity = 0.6; // flash of cold blue light
};

// ── Catastrophe: Oxygen Storm ─────────────────────────────────────────────────

const handleOxygenStorm = (tank: Tank): void => {
  // Mass bubble eruption from the bottom
  const burstCount = 80;
  for (let i = 0; i < burstCount; i++) {
    if (tank.particles.length >= 600) break;
    tank.particles.push(spawnBubble({
      x: rngFloat(rng, 0, tank.width),
      y: rngFloat(rng, tank.height * 0.7, tank.height),
    }, rng));
  }

  // Upward fluid surge
  for (let x = 0; x < tank.width; x += 20) {
    tank.fluid.addVelocityAt(x, tank.height * 0.9, rngFloat(rng, -30, 30), -200);
  }

  // Creatures accelerate upward
  for (const c of tank.creatures) {
    applyImpulse(c.body, { x: rngFloat(rng, -40, 40), y: -rngFloat(rng, 80, 180) });
  }
};
```

---

## Catastrophe Summary Table

| Kind | Primary Effect | Visual Signature |
|---|---|---|
| Predator Spawn | 1-2 giant predators enter | Fast triangular shapes at top |
| Toxic Bloom | Energy halved, slow rising current | Green food particles, upward fluid |
| Freezing Shock | Velocities near-zero, fluid killed | Blue flash, momentary stillness |
| Oxygen Storm | Mass bubbles + upward surge | Bubble eruption, creatures fly up |

---

## Acceptance Criteria

- [ ] `handleAddFood` spawns the correct `count` of food particles
- [ ] `handleShakeTank` applies non-zero impulse to all creatures
- [ ] `handleLightPulse` raises `tank.lightIntensity` to ≥ 1
- [ ] `handleSpawnCreature` respects `MAX_CREATURES` cap
- [ ] All 4 catastrophe handlers produce visually distinct, non-crashing effects
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **`(creature.traits as any)` cast in Predator Spawn** — `CreatureTraits` is
  `readonly` as intended. Predator spawn is a special forced override that
  happens at construction time conceptually, but since we go through the factory
  for the base creature, a targeted cast is used. A better pattern (factory
  `overrides` param) is a Phase 15 clean-up item.
- **`MAX_CREATURES = 40`** — keeps the simulation fast. The SLOP spec has no
  hard limit, but performance degrades noticeably with 100+ creatures running
  full behavior computation.
- **Toxic food color override** — done via `(p as any).color = ...` because
  `Particle.color` is intentionally mutable (it fades). Adding an `overrideColor`
  factory param is the Phase 15 clean version.
