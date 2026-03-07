# Phase 09 — Behavior System

## Goal

Implement the `BehaviorSystem` — the system that runs each creature's behavioral
decision-making each fixed timestep. Behaviors are composited steering forces
applied to `creature.body.acceleration`. The system also handles creature–food
consumption, creature–creature aggression, photophobic/photophilic light
responses, and turbulence reactions.

---

## Design Principles

1. **Composited weighted steering** — each behavior produces a `Vec2` force.
   Forces are weighted and summed rather than switched. This produces smoother,
   more natural blending than a priority state machine.
2. **Priority override for extreme states** — if hunger > 0.85, food-seeking
   weight is multiplied by 3× and wander is suppressed. This creates urgency
   without a rigid FSM.
3. **Spatial hash for O(1) neighbour queries** — creature and particle hashes
   built in `SimulationLoop` are consumed here.
4. **Individual behavior files** — `wander.ts`, `seekFood.ts`, `avoidPredator.ts`
   each export a single pure-function behavior. They are composed in
   `BehaviorSystem.ts`. This separation makes them independently testable.
5. **No state inside behavior functions** — any state needed (like `wanderAngle`)
   lives on the `Creature` object itself.

---

## Files Produced

| File | Exports |
|---|---|
| `src/systems/BehaviorSystem.ts` | `BehaviorSystem` class |
| `src/creatures/behaviors/wander.ts` | `computeWander` |
| `src/creatures/behaviors/seekFood.ts` | `computeSeekFood` |
| `src/creatures/behaviors/avoidPredator.ts` | `computeAvoidPredator` |
| `src/creatures/behaviors/boids.ts` | `computeBoids` |
| `src/creatures/behaviors/fluidDrift.ts` | `computeFluidDrift` |

---

## Step-by-Step Execution

### 1. Wander Behavior (`src/creatures/behaviors/wander.ts`)

Delegates to the `wander` steering helper from Phase 03.

```ts
import { wander }      from '@/utils/steering';
import type { Creature } from '@/creatures/Creature';
import type { Vec2 }   from '@/utils/vec2';
import type { Rng }    from '@/utils/rng';

export const computeWander = (creature: Creature, rng: Rng): Vec2 => {
  const result = wander(
    creature.body,
    creature.wanderAngle,
    30,                          // wanderRadius
    60,                          // wanderDist
    0.5,                         // wanderJitter
    rng,
    creature.traits.speed * 0.4, // maxForce
  );
  creature.wanderAngle = result.nextWanderAngle;
  return result.force;
};
```

---

### 2. Seek Food Behavior (`src/creatures/behaviors/seekFood.ts`)

Finds the nearest food particle within perception range and steers toward it.
Consumes it on contact.

```ts
import { arrive }       from '@/utils/steering';
import { vec2DistSq }   from '@/utils/vec2';
import type { Vec2 }    from '@/utils/vec2';
import type { Creature } from '@/creatures/Creature';
import type { Tank }    from '@/tank/Tank';
import type { Particle } from '@/particles/Particle';

const PERCEPTION_RADIUS = 180;
const EAT_DISTANCE_SQ   = 16 * 16; // 16px
const FOOD_ENERGY_GAIN  = 18;

export const computeSeekFood = (creature: Creature, tank: Tank): Vec2 => {
  const nearby: Particle[] = [];
  tank.particleHash.queryRadius(
    creature.body.position.x,
    creature.body.position.y,
    PERCEPTION_RADIUS,
    nearby,
  );

  let bestDistSq = Infinity;
  let bestFood: Particle | null = null;

  for (const p of nearby) {
    if (p.kind !== 'food' || p.life <= 0) continue;
    if (creature.traits.foodPreference === 'carnivore') continue; // carnivores ignore plant food
    const dSq = vec2DistSq(creature.body.position, p.body.position);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestFood   = p;
    }
  }

  if (bestFood === null) {
    creature.targetFoodId = null;
    return { x: 0, y: 0 };
  }

  creature.targetFoodId = bestFood.id;

  // Consume on contact
  if (bestDistSq <= EAT_DISTANCE_SQ) {
    bestFood.life = 0;
    creature.feed(FOOD_ENERGY_GAIN);
    creature.targetFoodId = null;
    return { x: 0, y: 0 };
  }

  return arrive(
    creature.body,
    bestFood.body.position,
    creature.traits.speed,
    creature.traits.speed * 0.5,
    60,
  );
};
```

---

### 3. Avoid Predator Behavior (`src/creatures/behaviors/avoidPredator.ts`)

```ts
import { flee }         from '@/utils/steering';
import { vec2DistSq }   from '@/utils/vec2';
import type { Vec2 }    from '@/utils/vec2';
import type { Creature } from '@/creatures/Creature';
import type { Tank }    from '@/tank/Tank';

const THREAT_RADIUS = 200;

export const computeAvoidPredator = (creature: Creature, tank: Tank): Vec2 => {
  if (creature.traits.aggression > 0.6) return { x: 0, y: 0 }; // apex predators don't flee

  const nearby: Creature[] = [];
  tank.creatureHash.queryRadius(
    creature.body.position.x, creature.body.position.y,
    THREAT_RADIUS, nearby,
  );

  let closestThreat: Creature | null = null;
  let closestDSq = Infinity;

  for (const other of nearby) {
    if (other.id === creature.id) continue;
    // A threat is something faster, bigger, and more aggressive
    if (
      other.traits.aggression <= creature.traits.aggression + 0.25 ||
      other.traits.scale      <= creature.traits.scale      - 0.2
    ) continue;

    const dSq = vec2DistSq(creature.body.position, other.body.position);
    if (dSq < closestDSq) {
      closestDSq    = dSq;
      closestThreat = other;
    }
  }

  if (closestThreat === null) {
    creature.threatId = null;
    return { x: 0, y: 0 };
  }

  creature.threatId = closestThreat.id;
  return flee(
    creature.body,
    closestThreat.body.position,
    creature.traits.speed * 1.3,  // flee slightly faster
    creature.traits.speed * 0.7,
  );
};
```

---

### 4. Boids Behavior (`src/creatures/behaviors/boids.ts`)

Classic Reynolds boids: separation + alignment + cohesion, applied only among
same-species creatures.

```ts
import { vec2Add, vec2Sub, vec2Scale, vec2Normalise, vec2Zero, vec2Len } from '@/utils/vec2';
import type { Vec2 }    from '@/utils/vec2';
import type { Creature } from '@/creatures/Creature';
import type { Tank }    from '@/tank/Tank';

const BOID_RADIUS       = 120;
const SEPARATION_RADIUS =  35;
const MAX_BOID_FORCE    =  80;

export const computeBoids = (creature: Creature, tank: Tank): Vec2 => {
  if (creature.traits.curiosity < 0.4) return vec2Zero(); // loners ignore flocking

  const nearby: Creature[] = [];
  tank.creatureHash.queryRadius(
    creature.body.position.x, creature.body.position.y,
    BOID_RADIUS, nearby,
  );

  let sepX = 0, sepY = 0, sepCount = 0;
  let alignX = 0, alignY = 0;
  let cohX = 0, cohY = 0, cohCount = 0;

  for (const other of nearby) {
    if (other.id === creature.id)         continue;
    if (other.species !== creature.species) continue;

    const dx = creature.body.position.x - other.body.position.x;
    const dy = creature.body.position.y - other.body.position.y;
    const dSq = dx * dx + dy * dy;
    const d   = Math.sqrt(dSq);

    // Separation
    if (d < SEPARATION_RADIUS && d > 0.001) {
      sepX += dx / d; sepY += dy / d; sepCount++;
    }

    // Alignment
    alignX += other.body.velocity.x;
    alignY += other.body.velocity.y;

    // Cohesion
    cohX += other.body.position.x;
    cohY += other.body.position.y;
    cohCount++;
  }

  if (cohCount === 0) return vec2Zero();

  let force: Vec2 = vec2Zero();

  if (sepCount > 0) {
    const sf = { x: sepX / sepCount, y: sepY / sepCount };
    force = vec2Add(force, vec2Scale(vec2Normalise(sf), MAX_BOID_FORCE * 1.2));
  }

  const avgAlign = { x: alignX / cohCount, y: alignY / cohCount };
  force = vec2Add(force, vec2Scale(vec2Normalise(avgAlign), MAX_BOID_FORCE * 0.5));

  const avgCoh   = { x: cohX / cohCount - creature.body.position.x,
                     y: cohY / cohCount - creature.body.position.y };
  force = vec2Add(force, vec2Scale(vec2Normalise(avgCoh), MAX_BOID_FORCE * 0.3));

  return force;
};
```

---

### 5. Fluid Drift (`src/creatures/behaviors/fluidDrift.ts`)

Creatures are gently pushed by the ambient fluid current.

```ts
import { vec2Scale }   from '@/utils/vec2';
import type { Vec2 }   from '@/utils/vec2';
import type { Creature } from '@/creatures/Creature';
import type { Tank }   from '@/tank/Tank';

export const computeFluidDrift = (creature: Creature, tank: Tank): Vec2 => {
  const fluidVel = tank.fluid.sampleAt(
    creature.body.position.x,
    creature.body.position.y,
  );
  // Coupling strength depends on creature mass/scale — smaller = more pushed
  const coupling = 0.6 / creature.traits.scale;
  return vec2Scale(fluidVel, coupling);
};
```

---

### 6. Behavior System (`src/systems/BehaviorSystem.ts`)

```ts
import type { Tank }       from '@/tank/Tank';
import type { Creature }   from '@/creatures/Creature';
import { applyForce }      from '@/systems/Physics';
import { computeWander }   from '@/creatures/behaviors/wander';
import { computeSeekFood } from '@/creatures/behaviors/seekFood';
import { computeAvoidPredator } from '@/creatures/behaviors/avoidPredator';
import { computeBoids }    from '@/creatures/behaviors/boids';
import { computeFluidDrift } from '@/creatures/behaviors/fluidDrift';
import { vec2Add, vec2Scale } from '@/utils/vec2';
import { createRng }       from '@/utils/rng';
import { CreatureLifeState } from '@/types/entities';

/** Behavior weights. Tune during Phase 15 polish. */
const W = {
  wander:   1.0,
  seekFood: 2.5,
  avoid:    3.0,
  boids:    1.2,
  fluid:    0.6,
};

export class BehaviorSystem {
  private readonly rng = createRng(0xdeadbeef);

  update(tank: Tank, dt: number): void {
    for (const creature of tank.creatures) {
      if (creature.lifeState !== CreatureLifeState.Alive) {
        // Dying creatures don't steer but still physic-integrate
        creature.tickDying(dt);
        continue;
      }

      this.updateCreature(creature, tank, dt);
    }
  }

  private updateCreature(creature: Creature, tank: Tank, dt: number): void {
    creature.recordPrevPosition();
    creature.drainEnergy(dt);

    // ── Compute individual behavior forces ─────────────────────────────────
    const hungerScale  = 1 + creature.hunger * 2.0; // urgency multiplier
    const avoidScale   = 1 + creature.traits.aggression < 0.4 ? 1.5 : 0;

    const wanderForce  = computeWander(creature, this.rng);
    const foodForce    = computeSeekFood(creature, tank);
    const avoidForce   = computeAvoidPredator(creature, tank);
    const boidsForce   = computeBoids(creature, tank);
    const fluidForce   = computeFluidDrift(creature, tank);

    // ── Weighted composition ───────────────────────────────────────────────
    let force = { x: 0, y: 0 };
    force = vec2Add(force, vec2Scale(wanderForce,  W.wander));
    force = vec2Add(force, vec2Scale(foodForce,    W.seekFood * hungerScale));
    force = vec2Add(force, vec2Scale(avoidForce,   W.avoid    * avoidScale));
    force = vec2Add(force, vec2Scale(boidsForce,   W.boids));
    force = vec2Add(force, vec2Scale(fluidForce,   W.fluid));

    applyForce(creature.body, force);

    // ── Light pulse reaction ────────────────────────────────────────────────
    this.reactToLight(creature, tank);

    // ── Glow decay ─────────────────────────────────────────────────────────
    const targetGlow = creature.traits.glow;
    creature.glowIntensity += (targetGlow - creature.glowIntensity) * dt * 2.5;

    // ── Segment update ─────────────────────────────────────────────────────
    if (creature.traits.bodyPlan === 'worm') {
      creature.updateSegments(8 * creature.traits.scale);
    }

    // ── Animation phase ────────────────────────────────────────────────────
    creature.animPhase += dt * (2 + creature.traits.speed / 100);
  }

  private reactToLight(creature: Creature, tank: Tank): void {
    if (tank.lightIntensity < 0.05) return;
    if (creature.traits.photophobic) {
      // Scatter away from tank centre
      const cx = tank.width  / 2;
      const cy = tank.height / 2;
      const dx = creature.body.position.x - cx;
      const dy = creature.body.position.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      applyForce(creature.body, {
        x: (dx / dist) * 250 * tank.lightIntensity,
        y: (dy / dist) * 250 * tank.lightIntensity,
      });
      creature.glowIntensity = Math.max(0, creature.glowIntensity - 0.3);
    } else {
      // Photophilic — glow brightly
      creature.glowIntensity = Math.min(1, creature.glowIntensity + tank.lightIntensity * 0.8);
    }
  }
}
```

---

## Force Composition Diagram

```
wander    × 1.0 ──────────────────────────┐
seekFood  × 2.5 × hungerScale ────────────┤
avoid     × 3.0 × avoidScale  ────────────┼──► vec2 sum → applyForce → body.acceleration
boids     × 1.2 ──────────────────────────┤
fluidDrift × 0.6 ─────────────────────────┘
```

---

## Acceptance Criteria

- [ ] Creatures seek and consume food particles within `EAT_DISTANCE_SQ`
- [ ] Prey creatures flee from predator creatures that are within `THREAT_RADIUS`
- [ ] Same-species groups maintain loose cohesion over 5+ seconds
- [ ] Photophobic creatures scatter on `tank.lightIntensity > 0`
- [ ] Dying creatures do not generate steering forces
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **Weight constants `W`** are in a `const` object at module top, not hardcoded
  inline. This makes tuning in Phase 15 a one-stop edit.
- **Carnivore / herbivore** — carnivores currently ignore food altogether
  (Phase 09) and eat by aggressing against small prey (future extension in
  Phase 12 Catastrophe interactions). For now, all creatures that are not
  `carnivore` eat food particles.
- **`avoidScale`** suppresses flee for aggressive creatures. An apex predator
  with aggression 0.95 near a wall does not flee it — it hunts.
- **Separate RNG per system** — `BehaviorSystem` creates its own RNG seeded
  with a fixed constant. This gives stable wander patterns regardless of how
  many creatures are spawned from the factory.
