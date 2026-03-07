# Phase 04 — Fluid Simulation & Tank Container

## Goal

Implement the `Tank` container and the `Fluid` velocity field that underlies
all movement aesthetics. The fluid layer gives creatures a medium to push
against — it is not a Navier-Stokes solver; it is a lightweight grid-based
velocity field that diffuses, decays, and interacts with events. Above it, the
tank holds water-like visual properties (caustics, depth tint) rendered cheaply
with canvas gradients.

---

## Design Principles

1. **Grid resolution independence** — the fluid grid is decoupled from canvas
   pixels. Default: one cell per 40px. Biological-scale variation, not CFD.
2. **Jos Stam-lite** — diffusion + advection + decay only. No pressure solve.
   Fast enough for 30×20 cells at 60fps.
3. **Tank as the root aggregate** — `Tank` owns the fluid, the spatial hash,
   the creature list, and the particle list. It is the single source of truth
   passed to systems.
4. **Immutable config at construction** —  tank width/height change only on
   window resize, propagated via `Tank.resize()`.

---

## Files Produced

| File | Exports |
|---|---|
| `src/tank/Tank.ts` | `Tank` class — aggregate root |
| `src/tank/Fluid.ts` | `FluidGrid` class |
| `src/tank/SimulationLoop.ts` | *(stub only here; wired in Phase 05)* |

---

## Step-by-Step Execution

### 1. Fluid Grid (`src/tank/Fluid.ts`)

The fluid is a staggered MAC grid (simplified). We store a single 2D array of
velocity vectors, diffuse them, advect them, and let them decay.

```ts
import { vec2, vec2Add, vec2Scale, vec2Zero } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import { lerp, clamp } from '@/utils/math';

export interface FluidConfig {
  /** Number of horizontal cells. */
  cols:         number;
  /** Number of vertical cells. */
  rows:         number;
  /** Physical size of each cell in pixels. */
  cellSize:     number;
  /** How quickly velocity diffuses to neighbours [0,1] per second. */
  diffusion:    number;
  /** How quickly velocity decays to zero [0,1] per second. */
  decay:        number;
}

export const defaultFluidConfig = (width: number, height: number): FluidConfig => {
  const cellSize = 40;
  return {
    cols:      Math.ceil(width  / cellSize),
    rows:      Math.ceil(height / cellSize),
    cellSize,
    diffusion: 0.12,
    decay:     0.55,
  };
};

export class FluidGrid {
  readonly cols:     number;
  readonly rows:     number;
  readonly cellSize: number;

  private vel:      Float32Array; // interleaved [vx0, vy0, vx1, vy1, ...]
  private velPrev:  Float32Array;
  private readonly diffusion: number;
  private readonly decay:     number;

  constructor(config: FluidConfig) {
    this.cols     = config.cols;
    this.rows     = config.rows;
    this.cellSize = config.cellSize;
    this.diffusion = config.diffusion;
    this.decay    = config.decay;
    const n = config.cols * config.rows * 2;
    this.vel     = new Float32Array(n);
    this.velPrev = new Float32Array(n);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Bilinearly-interpolated fluid velocity at pixel position (px, py). */
  sampleAt(px: number, py: number): Vec2 {
    const fx = (px / this.cellSize) - 0.5;
    const fy = (py / this.cellSize) - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;

    const v00 = this.getCell(x0,     y0);
    const v10 = this.getCell(x0 + 1, y0);
    const v01 = this.getCell(x0,     y0 + 1);
    const v11 = this.getCell(x0 + 1, y0 + 1);

    return {
      x: lerp(lerp(v00.x, v10.x, tx), lerp(v01.x, v11.x, tx), ty),
      y: lerp(lerp(v00.y, v10.y, tx), lerp(v01.y, v11.y, tx), ty),
    };
  }

  // ── Mutation ──────────────────────────────────────────────────────────────

  /** Add a velocity impulse at pixel position (px, py) to a 3×3 neighbourhood. */
  addVelocityAt(px: number, py: number, vx: number, vy: number, radius = 1): void {
    const cx = Math.floor(px / this.cellSize);
    const cy = Math.floor(py / this.cellSize);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.addCell(cx + dx, cy + dy, vx, vy);
      }
    }
  }

  // ── Simulation step ───────────────────────────────────────────────────────

  update(dt: number): void {
    this.diffuse(dt);
    this.advect(dt);
    this.decay_(dt);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private idx(x: number, y: number): number {
    return (y * this.cols + x) * 2;
  }

  private getCell(x: number, y: number): Vec2 {
    x = clamp(x, 0, this.cols - 1);
    y = clamp(y, 0, this.rows - 1);
    const i = this.idx(x, y);
    return { x: this.vel[i]!, y: this.vel[i + 1]! };
  }

  private addCell(x: number, y: number, vx: number, vy: number): void {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    const i = this.idx(x, y);
    this.vel[i]!     += vx;
    this.vel[i + 1]! += vy;
  }

  private diffuse(dt: number): void {
    const k   = this.diffusion * dt;
    const prev = this.vel;
    const next = this.velPrev;
    next.set(prev);

    for (let y = 1; y < this.rows - 1; y++) {
      for (let x = 1; x < this.cols - 1; x++) {
        const i  = this.idx(x, y);
        const iN = this.idx(x, y - 1);
        const iS = this.idx(x, y + 1);
        const iW = this.idx(x - 1, y);
        const iE = this.idx(x + 1, y);

        for (let c = 0; c < 2; c++) {
          const avg = (prev[iN + c]! + prev[iS + c]! + prev[iW + c]! + prev[iE + c]!) * 0.25;
          next[i + c] = lerp(prev[i + c]!, avg, k);
        }
      }
    }

    // Swap buffers
    this.vel     = next;
    this.velPrev = prev;
  }

  private advect(dt: number): void {
    const cs = this.cellSize;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = this.idx(x, y);
        const vx = this.vel[i]!;
        const vy = this.vel[i + 1]!;
        // Back-trace
        const srcX = x - (vx * dt) / cs;
        const srcY = y - (vy * dt) / cs;
        const sampled = this.sampleAtCell(srcX, srcY);
        this.velPrev[i]!     = sampled.x;
        this.velPrev[i + 1]! = sampled.y;
      }
    }
    [this.vel, this.velPrev] = [this.velPrev, this.vel];
  }

  private sampleAtCell(fx: number, fy: number): Vec2 {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const ci = (x: number, y: number): number =>
      this.idx(clamp(x, 0, this.cols - 1), clamp(y, 0, this.rows - 1));

    const lerp1D = (a: number, b: number) => lerp(a, b, tx);

    const i00 = ci(x0, y0); const i10 = ci(x0 + 1, y0);
    const i01 = ci(x0, y0 + 1); const i11 = ci(x0 + 1, y0 + 1);

    return {
      x: lerp(lerp1D(this.vel[i00]!, this.vel[i10]!), lerp1D(this.vel[i01]!, this.vel[i11]!), ty),
      y: lerp(lerp1D(this.vel[i00 + 1]!, this.vel[i10 + 1]!), lerp1D(this.vel[i01 + 1]!, this.vel[i11 + 1]!), ty),
    };
  }

  private decay_(dt: number): void {
    const factor = Math.max(0, 1 - this.decay * dt);
    for (let i = 0; i < this.vel.length; i++) {
      this.vel[i]! *= factor;
    }
  }
}
```

---

### 2. Tank Class (`src/tank/Tank.ts`)

```ts
import { FluidGrid, defaultFluidConfig } from '@/tank/Fluid';
import { SpatialHash } from '@/utils/spatialHash';
import { EventBus } from '@/types/events';
import type { TankEvent } from '@/types/entities';
import type { Creature } from '@/creatures/Creature';
import type { Particle } from '@/particles/Particle';

export interface TankDimensions {
  width:  number;
  height: number;
}

export class Tank {
  width:  number;
  height: number;

  // fluid is re-created on resize, so it is NOT readonly.
  fluid:           FluidGrid;
  readonly events: EventBus<TankEvent>;

  creatures: Creature[] = [];
  particles: Particle[] = [];

  /** Rebuilt each frame by SimulationLoop before behavior queries. */
  readonly creatureHash: SpatialHash<Creature>;
  readonly particleHash: SpatialHash<Particle>;

  /** Monotonic simulation time in seconds. */
  time = 0;

  /** Active light pulse intensity [0, 1]. Decays over time. */
  lightIntensity = 0;

  /** Active turbulence magnitude [0, 1]. Decays over time. */
  turbulence = 0;

  constructor({ width, height }: TankDimensions) {
    this.width  = width;
    this.height = height;
    this.fluid  = new FluidGrid(defaultFluidConfig(width, height));
    this.events = new EventBus<TankEvent>();
    this.creatureHash = new SpatialHash<Creature>(120);
    this.particleHash = new SpatialHash<Particle>(80);
  }

  resize(width: number, height: number): void {
    this.width  = width;
    this.height = height;
    // Note: FluidGrid is not resized (it is stateful); a new one is created.
    // This is acceptable — resize is a rare operation from window events.
    Object.assign(this, { fluid: new FluidGrid(defaultFluidConfig(width, height)) });
  }

  /** Remove dead creatures and expired particles. Called once per frame. */
  prune(): void {
    this.creatures = this.creatures.filter(c => c.lifeState !== 'dead');
    this.particles = this.particles.filter(p => p.life > 0);
  }

  /** Tick tank-level time-decaying fields. */
  tickFields(dt: number): void {
    this.time           += dt;
    this.lightIntensity  = Math.max(0, this.lightIntensity  - dt * 1.2);
    this.turbulence      = Math.max(0, this.turbulence      - dt * 0.8);
  }
}
```

---

## Tank → System Dependency Diagram

```
Tank
 ├─ FluidGrid          (no deps on creatures/particles)
 ├─ SpatialHash ×2     (generic, no entity deps)
 ├─ EventBus           (no deps)
 ├─ creatures[]        (populated by CreatureFactory, Phase 08)
 └─ particles[]        (populated by particle systems, Phase 06)
```

---

## Interaction Surface (used by downstream phases)

| Method / Property | Used by |
|---|---|
| `tank.fluid.sampleAt(x, y)` | Physics integration (Phase 03), behaviors (Phase 09) |
| `tank.fluid.addVelocityAt(...)` | Shake/Catastrophe (Phase 12) |
| `tank.creatureHash.queryRadius(...)` | Behavior system (Phase 09) |
| `tank.particleHash.queryRadius(...)` | Behavior system (Phase 09) |
| `tank.events.emit(...)` | InputSystem (Phase 11) |
| `tank.events.on(...)` | All systems subscribing to UI events |
| `tank.lightIntensity` | Renderer (Phase 10), creatures (Phase 07) |
| `tank.turbulence` | Physics (Phase 03) |

---

## Acceptance Criteria

- [ ] `FluidGrid.sampleAt` returns zero vector on zero grid
- [ ] `FluidGrid.update` reduces magnitude of an injected velocity over 60 frames
- [ ] `FluidGrid.addVelocityAt` spreads velocity to adjacent cells
- [ ] `Tank.prune` removes dead creatures and zero-life particles
- [ ] `Tank.tickFields` correctly decays `lightIntensity` and `turbulence` to zero
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **`Float32Array` for fluid** — typed arrays are ~4× faster than `number[][]`
  for tight numerical loops. The interleaved layout `[vx, vy, vx, vy]` keeps
  channel pairs adjacent in memory.
- **No pressure solve** — a full Navier-Stokes solve is unnecessary. The
  visible effect is soft currents drifting creatures, not fluid accuracy.
- **Tank does not create creatures** — creation is delegated to `CreatureFactory`
  (Phase 08) which calls `tank.creatures.push(...)`. Tank is a container only.
- **Spatial hashes resize** — since `SpatialHash.rebuild()` is called from
  scratch every frame there is no need to handle resize explicitly.
