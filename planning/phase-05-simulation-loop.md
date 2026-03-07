# Phase 05 — Simulation Loop

## Goal

Implement the authoritative game loop that drives all simulation updates at a
stable, frame-rate independent pace. The loop orchestrates every other system
in the correct order each frame, measures real-time performance, and exposes
pause/resume/step controls for debugging.

---

## Design Principles

1. **Fixed timestep with remainder accumulation** — accumulate wall-clock delta
   time and consume it in fixed 16.67ms (60Hz) slices. The render step always
   draws with a fractional interpolation value `alpha` for smooth visuals.
2. **Hard dt cap at 50ms** — prevents spiral-of-death when the tab loses focus
   or the machine pauses.
3. **Single orchestrator** — `SimulationLoop` is the only place that calls
   system `update` methods. All other systems are passive and wait to be called.
4. **Performance budget tracking** — each subsystem's update time is measured
   with `performance.now()` so bottlenecks are visible in the HUD.
5. **No circular deps** — `SimulationLoop` imports from `Tank`, `PhysicsSystem`,
   `BehaviorSystem`, `ParticleSystem`, and `Renderer`. None of those import
   back into `SimulationLoop`.

---

## Files Produced

| File | Exports |
|---|---|
| `src/tank/SimulationLoop.ts` | `SimulationLoop` class |

---

## Step-by-Step Execution

### 1. Loop Architecture

```
Wall clock Δt (capped at 50ms)
    │
    ▼
accumulator += Δt
    │
    ▼
while accumulator >= FIXED_DT:
  fixed update(FIXED_DT)   ← physics, behaviors, particles
  accumulator -= FIXED_DT

    │
    ▼
alpha = accumulator / FIXED_DT   ← fraction [0,1) for interpolated render
    │
    ▼
render(alpha)
    │
    ▼
requestAnimationFrame(loop)
```

---

### 2. Implementation (`src/tank/SimulationLoop.ts`)

```ts
import type { Tank }            from '@/tank/Tank';
import type { PhysicsSystem }   from '@/systems/Physics';
import type { BehaviorSystem }  from '@/systems/BehaviorSystem';
import type { ParticleSystem }  from '@/systems/ParticleSystem';
import type { Renderer }        from '@/systems/Renderer';
import type { InputSystem }     from '@/systems/InputSystem';
import { createRng }            from '@/utils/rng';

const FIXED_DT   = 1 / 60;          // 16.67ms fixed timestep
const MAX_DT     = 1 / 20;          // 50ms cap
const MAX_STEPS  = 5;               // safety: max fixed steps per frame

export interface LoopStats {
  fps:           number;
  frameTime:     number; // ms
  physicsMs:     number;
  behaviorMs:    number;
  particleMs:    number;
  renderMs:      number;
  creatureCount: number;
  particleCount: number;
}

export type LoopStatsListener = (stats: Readonly<LoopStats>) => void;

export class SimulationLoop {
  private rafId:       number | null = null;
  private lastTime:    number        = 0;
  private accumulator: number        = 0;
  private paused:      boolean       = false;
  private stepOnce:    boolean       = false;

  // Exponential moving average for FPS
  private smoothFps  = 60;
  private statsListeners: LoopStatsListener[] = [];

  constructor(
    private readonly tank:      Tank,
    private readonly physics:   PhysicsSystem,
    private readonly behaviors: BehaviorSystem,
    private readonly particles: ParticleSystem,
    private readonly renderer:  Renderer,
    private readonly input:     InputSystem,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    this.rafId    = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  pause():  void { this.paused    = true;  }
  resume(): void { this.paused    = false; }
  step():   void { this.stepOnce  = true;  }

  onStats(listener: LoopStatsListener): () => void {
    this.statsListeners.push(listener);
    return () => {
      this.statsListeners = this.statsListeners.filter(l => l !== listener);
    };
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  private readonly loop = (timestamp: number): void => {
    this.rafId = requestAnimationFrame(this.loop);

    const wallDt   = Math.min((timestamp - this.lastTime) / 1000, MAX_DT);
    this.lastTime  = timestamp;

    if (this.paused && !this.stepOnce) {
      // Still render (so we see a frozen but drawn frame), no simulation.
      const t0r = performance.now();
      this.renderer.render(this.tank, 0);
      const renderMs = performance.now() - t0r;
      this.emitStats(0, renderMs, 0, 0, 0);
      return;
    }

    this.stepOnce  = false;
    this.accumulator += wallDt;

    let physicsMs  = 0;
    let behaviorMs = 0;
    let particleMs = 0;
    let steps      = 0;

    // ── Fixed update steps ─────────────────────────────────────────────────
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      // 1. Process input events (convert UI events → tank events)
      this.input.flush(this.tank);

      // 2. Rebuild spatial hashes
      this.tank.creatureHash.rebuild(this.tank.creatures);
      this.tank.particleHash.rebuild(this.tank.particles);

      // 3. Fluid update
      this.tank.fluid.update(FIXED_DT);

      // 4. Behavior system (computes forces, applies to body.acceleration)
      const t0b = performance.now();
      this.behaviors.update(this.tank, FIXED_DT);
      behaviorMs += performance.now() - t0b;

      // 5. Physics integration (consumes acceleration → velocity → position)
      // NOTE: physics.resize() is NOT called here — it is called only in the
      // window resize handler in main.ts. Calling it inside the hot loop every
      // fixed step is wasteful and incorrect.
      const t0p = performance.now();
      for (const creature of this.tank.creatures) {
        this.physics.integrate(creature.body, FIXED_DT);
        this.physics.clampToBounds(creature.body, creature.radius);
      }
      for (const particle of this.tank.particles) {
        this.physics.integrate(particle.body, FIXED_DT);
        this.physics.clampToBounds(particle.body, 0);
      }
      physicsMs += performance.now() - t0p;

      // 6. Particle update (lifecycle, spawning debris from dead creatures)
      const t0pa = performance.now();
      this.particles.update(this.tank, FIXED_DT);
      particleMs += performance.now() - t0pa;

      // 7. Tank field decay
      this.tank.tickFields(FIXED_DT);

      // 8. Prune dead entities
      this.tank.prune();

      this.accumulator -= FIXED_DT;
      steps++;
    }

    // ── Render (with sub-frame interpolation alpha) ────────────────────────
    const alpha  = this.accumulator / FIXED_DT;
    const t0r    = performance.now();
    this.renderer.render(this.tank, alpha);
    const renderMs = performance.now() - t0r;

    // ── Stats ──────────────────────────────────────────────────────────────
    const frameMs = wallDt * 1000;
    this.smoothFps = this.smoothFps * 0.9 + (1 / wallDt) * 0.1;
    this.emitStats(frameMs, renderMs, physicsMs, behaviorMs, particleMs);
  };

  private emitStats(
    frameMs: number,
    renderMs: number,
    physicsMs: number,
    behaviorMs: number,
    particleMs: number,
  ): void {
    if (this.statsListeners.length === 0) return;
    const stats: LoopStats = {
      fps:           Math.round(this.smoothFps),
      frameTime:     frameMs,
      physicsMs,
      behaviorMs,
      particleMs,
      renderMs,
      creatureCount: this.tank.creatures.length,
      particleCount: this.tank.particles.length,
    };
    for (const l of this.statsListeners) l(stats);
  }
}
```

---

## Update Order Summary

Every fixed timestep, systems execute in this exact order:

| Step | System | Reason |
|---|---|---|
| 1 | `InputSystem.flush` | Events must arrive before behaviors consume them |
| 2 | Spatial hash rebuild | Behaviors need current positions |
| 3 | `FluidGrid.update` | Fluid must settle before forces are sampled |
| 4 | `BehaviorSystem.update` | Accumulates forces onto `body.acceleration` |
| 5 | `PhysicsSystem.integrate` | Consumes acceleration, updates position |
| 6 | `ParticleSystem.update` | Decrement life, spawn debris, apply forces |
| 7 | `Tank.tickFields` | Decay light/turbulence after they've been applied |
| 8 | `Tank.prune` | Remove dead entities after all reads are done |

---

## Acceptance Criteria

- [ ] Loop runs at target 60fps on a mid-range laptop (measured in HUD)
- [ ] `pause()` / `resume()` / `step()` work correctly
- [ ] Spiral-of-death test: artificially slow `update` by 200ms → loop compensates by capping at `MAX_STEPS`
- [ ] `onStats` listener is called once per rendered frame
- [ ] `stop()` cancels the RAF and no further callbacks fire
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **Why fixed timestep?** Physics and behaviors with steering forces produce
  jitter and instabilities at variable dt. Fixed timestep makes the simulation
  deterministic and reproducible.
- **Why render with alpha?** Smooth fractional interpolation between physics
  frames prevents the classic stutter of fixed-step without interpolation.
  The renderer reads `position` but can blend toward `prevPosition` for smooth
  rendering — `Creature.prevPosition` is stored in Phase 07.
- **`MAX_STEPS = 5`** — limits total work per frame to ~5 × (behavior + physics)
  even if the machine falls behind. The simulation slows down rather than
  exploding.
- **Spatial hash rebuild before behaviors** — behaviors need fresh positions.
  Rebuilding before physics ensures no stale data from mid-frame mutations.
