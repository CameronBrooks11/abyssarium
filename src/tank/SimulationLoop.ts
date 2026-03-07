/** SimulationLoop — the authoritative game loop driving all simulation updates.
 *
 *  Architecture: fixed timestep with remainder accumulation.
 *  - Wall-clock Δt is capped at MAX_DT to prevent spiral-of-death.
 *  - Simulation advances in FIXED_DT slices (16.67 ms / 60 Hz).
 *  - Renderer receives a fractional `alpha` for sub-frame interpolation.
 *
 *  Update order per fixed step:
 *   1. InputSystem.flush   — UI events arrive before behaviors consume them
 *   2. Spatial hash rebuild — behaviors need current positions
 *   3. FluidGrid.update    — fluid settles before forces are sampled
 *   4. BehaviorSystem.update — accumulate forces onto body.acceleration
 *   5. PhysicsSystem.integrate — consume acceleration → velocity → position
 *   6. ParticleSystem.update — lifecycle, debris, fluid coupling
 *   7. Tank.tickFields     — decay light/turbulence after they have been applied
 *   8. Tank.prune          — remove dead entities after all reads are done
 */

import type { Tank } from '@/tank/Tank';
import type { PhysicsSystem } from '@/systems/Physics';
import type { BehaviorSystem } from '@/systems/BehaviorSystem';
import type { ParticleSystem } from '@/systems/ParticleSystem';
import type { Renderer } from '@/systems/Renderer';
import type { InputSystem } from '@/systems/InputSystem';

const FIXED_DT = 1 / 60; // 16.67 ms fixed timestep
const MAX_DT = 1 / 20; // 50 ms cap — prevents spiral-of-death
const MAX_STEPS = 5; // max fixed steps per frame — simulation slows, not explodes

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface LoopStats {
  fps: number;
  frameTime: number; // ms
  physicsMs: number;
  behaviorMs: number;
  particleMs: number;
  renderMs: number;
  creatureCount: number;
  particleCount: number;
}

export type LoopStatsListener = (stats: Readonly<LoopStats>) => void;

// ── SimulationLoop ────────────────────────────────────────────────────────────

export class SimulationLoop {
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private paused = false;
  private stepOnce = false;

  /** Exponential moving average FPS — α = 0.1 for smooth HUD display. */
  private smoothFps = 60;

  private statsListeners: LoopStatsListener[] = [];

  constructor(
    private readonly tank: Tank,
    private readonly physics: PhysicsSystem,
    private readonly behaviors: BehaviorSystem,
    private readonly particles: ParticleSystem,
    private readonly renderer: Renderer,
    private readonly input: InputSystem,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Advance exactly one fixed step then pause — useful for debugging. */
  step(): void {
    this.stepOnce = true;
  }

  /**
   * Register a listener that receives perf stats once per rendered frame.
   * Returns an unsubscribe function.
   */
  onStats(listener: LoopStatsListener): () => void {
    this.statsListeners.push(listener);
    return () => {
      this.statsListeners = this.statsListeners.filter(l => l !== listener);
    };
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  private readonly loop = (timestamp: number): void => {
    this.rafId = requestAnimationFrame(this.loop);

    const wallDt = Math.min((timestamp - this.lastTime) / 1000, MAX_DT);
    this.lastTime = timestamp;

    // ── Paused: render only, no simulation ──────────────────────────────────
    if (this.paused && !this.stepOnce) {
      const t0r = performance.now();
      this.renderer.render(this.tank, 0);
      const renderMs = performance.now() - t0r;
      this.emitStats(wallDt * 1000, renderMs, 0, 0, 0);
      return;
    }

    this.stepOnce = false;
    this.accumulator += wallDt;

    let physicsMs = 0;
    let behaviorMs = 0;
    let particleMs = 0;
    let steps = 0;

    // ── Fixed update steps ─────────────────────────────────────────────────
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
      // 1 — Input
      this.input.flush(this.tank);

      // 2 — Rebuild spatial hashes (behaviors need current positions)
      this.tank.creatureHash.rebuild(this.tank.creatures);
      this.tank.particleHash.rebuild(this.tank.particles);

      // 3 — Fluid (settles before forces are sampled)
      this.tank.fluid.update(FIXED_DT);

      // 4 — Behaviors (accumulate forces)
      const t0b = performance.now();
      this.behaviors.update(this.tank, FIXED_DT);
      behaviorMs += performance.now() - t0b;

      // 5 — Physics (consume acceleration → velocity → position)
      // physics.resize() is NOT called here — only from window resize handler
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

      // 6 — Particles (lifecycle, debris emission, fluid coupling)
      const t0pa = performance.now();
      this.particles.update(this.tank, FIXED_DT);
      particleMs += performance.now() - t0pa;

      // 7 — Tank field decay
      this.tank.tickFields(FIXED_DT);

      // 8 — Prune dead entities (after all reads are done)
      this.tank.prune();

      this.accumulator -= FIXED_DT;
      steps++;
    }

    // ── Render with sub-frame interpolation ───────────────────────────────
    const alpha = this.accumulator / FIXED_DT; // [0, 1)
    const t0r = performance.now();
    this.renderer.render(this.tank, alpha);
    const renderMs = performance.now() - t0r;

    // ── Perf stats ─────────────────────────────────────────────────────────
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
      fps: Math.round(this.smoothFps),
      frameTime: frameMs,
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
