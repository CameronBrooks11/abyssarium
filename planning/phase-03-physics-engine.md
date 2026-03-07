# Phase 03 — Physics Engine

## Goal

Implement a lightweight, hand-written 2D physics engine sufficient for all
simulation needs: velocity integration, force accumulation, drag, boundary
collision, and spatial subdivision for efficient neighbor queries.

This engine has **no external dependencies**. It must be entirely self-contained
inside `src/systems/Physics.ts` with supporting utilities, and it must be fully
testable in isolation (no canvas, no DOM).

---

## Design Principles

1. **Semi-implicit Euler integration** — integrate velocity first, then
   position. More stable than explicit Euler for the forces used here.
2. **Force-accumulator pattern** — each body accumulates forces per frame,
   integrated once, then cleared. No direct velocity mutation from outside the
   integrator (use `applyForce` / `applyImpulse`).
3. **Spatial hashing for neighbor queries** — O(1) amortised lookup instead of
   O(n²) brute force. Cell size = 2× the largest creature radius.
4. **Soft boundary collisions** — instead of hard bouncing, a repulsion force
   pushing entities away from walls proportional to distance of penetration.
   This looks more organic.
5. **Zero garbage per frame** — pre-allocated scratch objects for integration
   to avoid GC pressure in the hot loop.

---

## Files Produced

| File | Exports |
|---|---|
| `src/systems/Physics.ts` | `PhysicsSystem` class |
| `src/utils/spatialHash.ts` | `SpatialHash<T>` generic grid |

---

## Step-by-Step Execution

### 1. Spatial Hash (`src/utils/spatialHash.ts`)

A flat hash-map from cell key → list of items. Items must carry a `Vec2`
position. The grid is rebuilt every frame (clear + re-insert all entries),
which is faster than maintaining insert/remove operations for fast-moving
entities.

```ts
import type { Vec2 } from '@/utils/vec2';

export interface HasPosition {
  readonly position: Vec2;
}

export class SpatialHash<T extends HasPosition> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  // ── Mutation ───────────────────────────────────────────────────────────────

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const key = this.keyFor(item.position.x, item.position.y);
    let list = this.cells.get(key);
    if (list === undefined) {
      list = [];
      this.cells.set(key, list);
    }
    list.push(item);
  }

  /** Rebuild from scratch with a fresh item list. */
  rebuild(items: readonly T[]): void {
    this.clear();
    for (const item of items) this.insert(item);
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  /**
   * Return all items in cells overlapping a square region centred on (x, y)
   * with half-extent radius.  May include items slightly outside the circle;
   * callers must do their own distance check if precision is needed.
   */
  queryRadius(x: number, y: number, radius: number, out: T[]): void {
    const cs  = this.cellSize;
    const minCx = Math.floor((x - radius) / cs);
    const maxCx = Math.floor((x + radius) / cs);
    const minCy = Math.floor((y - radius) / cs);
    const maxCy = Math.floor((y + radius) / cs);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const list = this.cells.get(this.hash(cx, cy));
        if (list !== undefined) {
          for (const item of list) out.push(item);
        }
      }
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private keyFor(x: number, y: number): number {
    return this.hash(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
  }

  /** Cantor pairing, handles negatives. */
  private hash(cx: number, cy: number): number {
    const px = cx < 0 ? -2 * cx - 1 : 2 * cx;
    const py = cy < 0 ? -2 * cy - 1 : 2 * cy;
    return ((px + py) * (px + py + 1)) / 2 + py;
  }
}
```

---

### 2. Physics System (`src/systems/Physics.ts`)

```ts
import { vec2Add, vec2Scale, vec2Zero, vec2LenSq } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import type { RigidBody } from '@/types/entities';

export interface PhysicsConfig {
  /** Gravitational constant — downward pull in pixels/s². Default 0 (weightless tank). */
  gravity:        number;
  /** Global linear drag multiplier. Applied as velocity *= (1 - drag * dt). */
  globalDrag:     number;
  /** Buoyancy upward force to counteract gravity aesthetically. */
  buoyancy:       number;
  /** Force magnitude of soft boundary repulsion (per pixel of penetration). */
  boundaryForce:  number;
  /** Simulation boundary (the tank walls). */
  bounds: { width: number; height: number };
}

export const defaultPhysicsConfig = (): PhysicsConfig => ({
  gravity:       40,
  globalDrag:    0.02,
  buoyancy:      38,
  boundaryForce: 800,
  bounds: { width: 800, height: 600 },
});

// ── Force accumulator ─────────────────────────────────────────────────────────

/**
 * Accumulate a force onto a body.  Forces are integrated once per tick then cleared.
 */
export const applyForce = (body: RigidBody, force: Readonly<Vec2>): void => {
  body.acceleration = vec2Add(body.acceleration, vec2Scale(force, 1 / body.mass));
};

/**
 * Apply an instantaneous velocity change (impulse = Δv, bypasses mass).
 */
export const applyImpulse = (body: RigidBody, impulse: Readonly<Vec2>): void => {
  body.velocity = vec2Add(body.velocity, impulse);
};

// ── Integration ───────────────────────────────────────────────────────────────

export class PhysicsSystem {
  private config: PhysicsConfig;

  constructor(config?: Partial<PhysicsConfig>) {
    this.config = { ...defaultPhysicsConfig(), ...config };
  }

  resize(width: number, height: number): void {
    this.config = { ...this.config, bounds: { width, height } };
  }

  getConfig(): Readonly<PhysicsConfig> {
    return this.config;
  }

  /**
   * Integrate a single rigid body for one timestep dt (seconds).
   * Semi-implicit Euler: v(t+dt) = v(t) + a·dt, then x(t+dt) = x(t) + v(t+dt)·dt
   */
  integrate(body: RigidBody, dt: number): void {
    const { gravity, globalDrag, buoyancy, boundaryForce, bounds } = this.config;

    // ── Environmental forces ────────────────────────────────────────────────
    // Net vertical = gravity down + buoyancy up → small residual downward drift
    applyForce(body, { x: 0, y: gravity - buoyancy });

    // ── Soft wall repulsion ──────────────────────────────────────────────────
    this.applyBoundaryForce(body, boundaryForce, bounds.width, bounds.height);

    // ── Velocity update (semi-implicit Euler) ────────────────────────────────
    body.velocity = vec2Add(body.velocity, vec2Scale(body.acceleration, dt));

    // ── Global drag ──────────────────────────────────────────────────────────
    const dragFactor = Math.max(0, 1 - (globalDrag + body.drag) * dt * 60);
    body.velocity = vec2Scale(body.velocity, dragFactor);

    // ── Angular integration ─────────────────────────────────────────────────
    body.angle    += body.angularVel * dt;
    body.angularVel *= Math.max(0, 1 - body.angularDrag * dt * 60);

    // ── Position update ──────────────────────────────────────────────────────
    body.position = vec2Add(body.position, vec2Scale(body.velocity, dt));

    // ── Clear accumulator ────────────────────────────────────────────────────
    body.acceleration = vec2Zero();
  }

  /**
   * Hard clamp position into bounds (safety net after soft repulsion).
   * Also kill velocity component pointing outward.
   */
  clampToBounds(body: RigidBody, margin = 0): void {
    const { width, height } = this.config.bounds;
    let { x, y } = body.position;
    let { x: vx, y: vy } = body.velocity;

    if (x < margin)           { x = margin;          if (vx < 0) vx = 0; }
    if (x > width  - margin)  { x = width  - margin; if (vx > 0) vx = 0; }
    if (y < margin)           { y = margin;           if (vy < 0) vy = 0; }
    if (y > height - margin)  { y = height - margin;  if (vy > 0) vy = 0; }

    body.position = { x, y };
    body.velocity = { x: vx, y: vy };
  }

  /**
   * Apply a radial turbulence impulse to a body from a central point.
   * Used for ShakeTank, Catastrophe, etc.
   */
  applyTurbulence(
    body: RigidBody,
    centreX: number, centreY: number,
    magnitude: number,
    rng: () => number,
  ): void {
    // Random direction with slight bias away from centre
    const dx = body.position.x - centreX;
    const dy = body.position.y - centreY;
    const angle = Math.atan2(dy, dx) + (rng() - 0.5) * Math.PI;
    applyImpulse(body, {
      x: Math.cos(angle) * magnitude,
      y: Math.sin(angle) * magnitude,
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private applyBoundaryForce(
    body: RigidBody,
    forceMag: number,
    width: number,
    height: number,
  ): void {
    const { x, y } = body.position;
    const margin = 40; // pixels from wall at which repulsion begins

    if (x < margin)          applyForce(body, { x:  forceMag * (margin - x) / margin,  y: 0 });
    if (x > width  - margin) applyForce(body, { x: -forceMag * (x - (width  - margin)) / margin, y: 0 });
    if (y < margin)          applyForce(body, { x: 0,  y:  forceMag * (margin - y) / margin });
    if (y > height - margin) applyForce(body, { x: 0,  y: -forceMag * (y - (height - margin)) / margin });
  }
}
```

---

## Steering Behaviour Helpers (`src/utils/steering.ts`)

Steering forces are used by creature behaviours. Isolated here so they can be
tested independently of any creature class.

```ts
import { vec2Sub, vec2Normalise, vec2Scale, vec2Limit, vec2Len } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import { applyForce } from '@/systems/Physics';
import type { RigidBody } from '@/types/entities';

/** Seek target: steer toward target at max speed. Returns desired force. */
export const seek = (
  body: Readonly<RigidBody>,
  target: Readonly<Vec2>,
  maxSpeed: number,
  maxForce: number,
): Vec2 => {
  const desired  = vec2Scale(vec2Normalise(vec2Sub(target, body.position)), maxSpeed);
  const steering = vec2Sub(desired, body.velocity);
  return vec2Limit(steering, maxForce);
};

/** Flee target: steer away. */
export const flee = (
  body: Readonly<RigidBody>,
  threat: Readonly<Vec2>,
  maxSpeed: number,
  maxForce: number,
): Vec2 => {
  const desired  = vec2Scale(vec2Normalise(vec2Sub(body.position, threat)), maxSpeed);
  const steering = vec2Sub(desired, body.velocity);
  return vec2Limit(steering, maxForce);
};

/** Arrive: seek with deceleration within `slowRadius`. */
export const arrive = (
  body: Readonly<RigidBody>,
  target: Readonly<Vec2>,
  maxSpeed: number,
  maxForce: number,
  slowRadius: number,
): Vec2 => {
  const toTarget = vec2Sub(target, body.position);
  const dist     = vec2Len(toTarget);
  if (dist < 0.5) return { x: 0, y: 0 };
  const speed    = dist < slowRadius ? maxSpeed * (dist / slowRadius) : maxSpeed;
  const desired  = vec2Scale(toTarget, speed / dist);
  return vec2Limit(vec2Sub(desired, body.velocity), maxForce);
};

/** Wander: random angular displacement on a projected circle. */
export const wander = (
  body: Readonly<RigidBody>,
  wanderAngle: number,       // current wander angle (mutated by caller each frame)
  wanderRadius: number,
  wanderDist: number,
  wanderJitter: number,
  rng: () => number,
  maxForce: number,
): { force: Vec2; nextWanderAngle: number } => {
  const nextAngle = wanderAngle + (rng() - 0.5) * wanderJitter;
  const circlePos = vec2Scale(vec2Normalise(body.velocity || { x: 1, y: 0 }), wanderDist);
  const displacement = {
    x: Math.cos(nextAngle) * wanderRadius,
    y: Math.sin(nextAngle) * wanderRadius,
  };
  const target = {
    x: body.position.x + circlePos.x + displacement.x,
    y: body.position.y + circlePos.y + displacement.y,
  };
  return {
    force: vec2Limit(seek(body, target, 100, maxForce), maxForce),
    nextWanderAngle: nextAngle,
  };
};
```

---

## Integration Example (pseudocode consumed in Phase 05)

```
each frame (dt):
  for each creature:
    behaviorSystem.computeForces(creature)   → pushes to body.acceleration
    physicsSystem.integrate(creature.body, dt)
    physicsSystem.clampToBounds(creature.body, creature.radius)

  for each particle:
    physicsSystem.integrate(particle.body, dt)
    physicsSystem.clampToBounds(particle.body, 0)
```

---

## Acceptance Criteria

- [ ] `PhysicsSystem.integrate` produces deterministic results for identical inputs
- [ ] Soft boundary repulsion keeps a body inside bounds within 3 frames of exit attempt
- [ ] `SpatialHash.queryRadius` returns all and only items within the cell overlap area
- [ ] `steering.seek` produces a force pointing toward target with magnitude ≤ `maxForce`
- [ ] `steering.wander` `nextWanderAngle` changes by at most `wanderJitter / 2` per frame
- [ ] No `new` allocations per frame inside the integration hot path
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **No fixed timestep** — Abyssarium targets 60fps but caps `dt` at `1/20` to
  prevent spiral-of-death on tab background throttle. The cap is applied in
  `SimulationLoop` (Phase 05).
- **Global drag is per-body** — each creature's `body.drag` is added to the
  global multiplier. Heavier, bulkier creatures have lower drag for inertia.
- **Buoyancy constant** — set to 38 vs gravity 40 gives a small downward drift
  at rest, which makes creatures actively swim upward periodically — more alive.
- **`SpatialHash` is rebuilt each frame.** For ≤ 200 entities this is faster
  than incremental update because of cache locality in the fresh allocation.
