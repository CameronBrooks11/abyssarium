# Phase 06 — Particle System

## Goal

Design and implement the three particle types — `Food`, `Bubble`, and `Debris`
— plus the `ParticleSystem` service that manages their lifecycle, spawning, and
per-frame update. Particles must integrate with the physics engine, interact
with the fluid, and be passed to the renderer.

---

## Design Principles

1. **Particles are value objects** — no inheritance hierarchy. A `Particle` is
   a plain typed object; the `ParticleSystem` handles all behaviour.
2. **Object pool** — pre-allocate a fixed pool of particle slots to avoid
   per-frame heap allocation. Inactive particles have `life = 0`.
3. **Finite lifetime** — every particle has a `life` counter (seconds) that
   decrements each frame. When it reaches zero the particle is pruned.
4. **Fluid coupling** — particles sample the fluid velocity field and add it to
   their own velocity, giving the impression of floating in the current.
5. **Kind-specific physics** — food drifts downward with buoyancy, bubbles rise,
   debris tumbles with angular velocity.

---

## Files Produced

| File | Exports |
|---|---|
| `src/particles/Particle.ts` | `Particle` interface + factory helpers |
| `src/particles/Food.ts` | `spawnFood` function |
| `src/particles/Bubble.ts` | `spawnBubble` function |
| `src/particles/Debris.ts` | `spawnDebris` function |
| `src/systems/ParticleSystem.ts` | `ParticleSystem` class |

---

## Step-by-Step Execution

### 1. Particle Interface (`src/particles/Particle.ts`)

```ts
import type { Vec2 } from '@/utils/vec2';
import type { HSLA } from '@/utils/color';
import type { ParticleId, ParticleKind, RigidBody } from '@/types/entities';
import { nextId, ParticleKind as PK } from '@/types/entities';
import { vec2Zero } from '@/utils/vec2';
import { hsla } from '@/utils/color';

export interface Particle {
  readonly id:   ParticleId;
  readonly kind: ParticleKind;
  body:          RigidBody;
  /** Previous position for interpolated rendering. */
  prevPosition:  Vec2;
  /** Radius in pixels. */
  radius:        number;
  /** Remaining lifetime in seconds. */
  life:          number;
  /** Maximum lifetime (for alpha fade calculation). */
  maxLife:       number;
  /** Visual color. */
  color:         HSLA;
  /** For debris: spin direction. */
  spin:          number;
}

export const makeBody = (position: Vec2, velocity: Vec2, mass: number, drag: number): RigidBody => ({
  position,
  velocity,
  acceleration: vec2Zero(),
  angle:        0,
  angularVel:   0,
  mass,
  drag,
  angularDrag:  0.3,
});
```

---

### 2. Food Particle (`src/particles/Food.ts`)

Food particles drift slowly downward and attract creatures.

```ts
import type { Vec2 } from '@/utils/vec2';
import type { Rng }  from '@/utils/rng';
import { rngFloat }  from '@/utils/rng';
import { hsla }      from '@/utils/color';
import { nextId, ParticleKind } from '@/types/entities';
import { makeBody }  from './Particle';
import type { Particle } from './Particle';

export const spawnFood = (position: Readonly<Vec2>, rng: Rng): Particle => ({
  id:           nextId('fd'),
  kind:         ParticleKind.Food,
  body:         makeBody(
    { x: position.x + rngFloat(rng, -8, 8), y: position.y },
    { x: rngFloat(rng, -15, 15), y: rngFloat(rng, 5, 25) }, // gentle downward drift
    0.3,
    0.08,
  ),
  prevPosition: { ...position },
  radius:       rngFloat(rng, 2.5, 5),
  life:         rngFloat(rng, 12, 20),
  maxLife:      18,
  color:        hsla(rngFloat(rng, 45, 65), 80, 72),
  spin:         0,
});
```

---

### 3. Bubble Particle (`src/particles/Bubble.ts`)

Bubbles float upward and pop at the surface.

```ts
import type { Vec2 } from '@/utils/vec2';
import type { Rng }  from '@/utils/rng';
import { rngFloat }  from '@/utils/rng';
import { hsla }      from '@/utils/color';
import { nextId, ParticleKind } from '@/types/entities';
import { makeBody }  from './Particle';
import type { Particle } from './Particle';

export const spawnBubble = (position: Readonly<Vec2>, rng: Rng): Particle => ({
  id:           nextId('bb'),
  kind:         ParticleKind.Bubble,
  body:         makeBody(
    { x: position.x + rngFloat(rng, -20, 20), y: position.y },
    { x: rngFloat(rng, -8, 8), y: rngFloat(rng, -60, -30) }, // float up
    0.1,
    0.18,
  ),
  prevPosition: { ...position },
  radius:       rngFloat(rng, 2, 7),
  life:         rngFloat(rng, 3, 8),
  maxLife:      6,
  color:        hsla(200, 60, 80, 0.35),
  spin:         0,
});
```

---

### 4. Debris Particle (`src/particles/Debris.ts`)

Debris is emitted when creatures die — fragments that tumble and fade.

```ts
import type { Vec2 } from '@/utils/vec2';
import type { Rng }  from '@/utils/rng';
import type { HSLA } from '@/utils/color';
import { rngFloat, rngGaussian } from '@/utils/rng';
import { nextId, ParticleKind } from '@/types/entities';
import { makeBody }  from './Particle';
import type { Particle } from './Particle';
import { hslaWithAlpha } from '@/utils/color';

export const spawnDebris = (
  position: Readonly<Vec2>,
  direction: Readonly<Vec2>,
  color: HSLA,
  rng: Rng,
): Particle => {
  const speed = rngFloat(rng, 20, 90);
  const angle = Math.atan2(direction.y, direction.x) + rngGaussian(rng, 0, 0.8);
  return {
    id:           nextId('db'),
    kind:         ParticleKind.Debris,
    body:         makeBody(
      { ...position },
      { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      0.5,
      0.12,
    ),
    prevPosition: { ...position },
    radius:       rngFloat(rng, 1.5, 4),
    life:         rngFloat(rng, 2, 5),
    maxLife:      4,
    color:        hslaWithAlpha(color, 0.8),
    spin:         rngFloat(rng, -6, 6),
  };
};
```

---

### 5. Particle System (`src/systems/ParticleSystem.ts`)

```ts
import type { Tank }       from '@/tank/Tank';
import type { Particle }   from '@/particles/Particle';
import { spawnDebris }     from '@/particles/Debris';
import { spawnBubble }     from '@/particles/Bubble';
import { applyForce }      from '@/systems/Physics';
import { createRng }       from '@/utils/rng';
import { vec2Scale }       from '@/utils/vec2';
import { CreatureLifeState } from '@/types/entities';

/** Maximum number of simultaneously active particles. */
const MAX_PARTICLES = 600;

/** Ambient bubble spawn rate (per second). */
const BUBBLE_RATE = 2.5;

export class ParticleSystem {
  private readonly rng = createRng(Date.now() & 0xffffffff);
  private bubbleAccum  = 0;

  update(tank: Tank, dt: number): void {
    this.tickParticles(tank, dt);
    this.spawnDebrisFromDying(tank);
    this.spawnAmbientBubbles(tank, dt);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private tickParticles(tank: Tank, dt: number): void {
    for (const p of tank.particles) {
      // Save previous position for interpolated rendering
      p.prevPosition = { ...p.body.position };

      // Fluid coupling: sample fluid velocity and nudge particle
      const fluidVel = tank.fluid.sampleAt(p.body.position.x, p.body.position.y);
      applyForce(p.body, vec2Scale(fluidVel, 0.4));

      // Kind-specific forces
      if (p.kind === 'bubble') {
        // Extra buoyancy already encoded in initial velocity; dampen horizontal
        applyForce(p.body, { x: 0, y: -60 });
      }

      // Pop bubbles that reach the top 5% of tank
      if (p.kind === 'bubble' && p.body.position.y < tank.height * 0.05) {
        p.life = 0;
        continue;
      }

      p.body.angle   += p.spin * dt;
      p.life         -= dt;
    }
  }

  private spawnDebrisFromDying(tank: Tank): void {
    if (tank.particles.length >= MAX_PARTICLES) return;
    for (const creature of tank.creatures) {
      if (creature.lifeState !== CreatureLifeState.Dying) continue;
      const count = 4;
      for (let i = 0; i < count; i++) {
        if (tank.particles.length >= MAX_PARTICLES) break;
        tank.particles.push(
          spawnDebris(
            creature.body.position,
            creature.body.velocity,
            creature.traits.palette[0],
            this.rng,
          ),
        );
      }
    }
  }

  private spawnAmbientBubbles(tank: Tank, dt: number): void {
    if (tank.particles.length >= MAX_PARTICLES) return;
    this.bubbleAccum += BUBBLE_RATE * dt;
    while (this.bubbleAccum >= 1) {
      this.bubbleAccum--;
      const x = this.rng() * tank.width;
      const y = tank.height * (0.6 + this.rng() * 0.4);
      tank.particles.push(spawnBubble({ x, y }, this.rng));
    }
  }
}
```

---

## Lifecycle State Machine

```
spawnFood/spawnBubble/spawnDebris
        │
        ▼
   life = maxLife
        │
 ── dt subtracted each frame ──►
        │
   life === 0
        │
        ▼
   Tank.prune() removes it
```

---

## Particle–Creature Interaction

- Creatures query `tank.particleHash.queryRadius(...)` to find nearby food.
- When a creature's seek behavior leads it close enough to food (≤ `creature.radius + food.radius`):
  - food `life` is set to 0 (consumed)
  - creature `energy` increases
- This interaction logic lives in the behavior system (Phase 09), **not** here.
  `ParticleSystem` only handles spawning and lifetime; consumption is a behavior.

---

## Acceptance Criteria

- [ ] `spawnFood` produces a particle with downward initial velocity in Y
- [ ] `spawnBubble` produces a particle with upward initial velocity in Y
- [ ] `spawnDebris` randomises outgoing angle around the input direction
- [ ] `ParticleSystem.update` decrements `life` by `dt` each frame
- [ ] Bubbles popped when reaching `y < tank.height * 0.05`
- [ ] `MAX_PARTICLES` cap is never exceeded
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **Flat `Particle[]` on `Tank`** — no separate food/bubble/debris arrays.
  The `kind` discriminant is sufficient. Single array means one loop in
  rendering and one loop in physics.
- **No pooling in Phase 06** — the `MAX_PARTICLES = 600` cap keeps the array
  small enough that JavaScript's GC handles turnover without visible pauses.
  A proper pool is a Phase 15 polish optimization if profiling reveals pressure.
- **`spin` only used by debris** — other kinds have `spin = 0`. No branch needed
  in the tick — `angle += 0 * dt` is a no-op.
