/** Tank — the aggregate root for the entire simulation.
 *
 *  Owns the fluid grid, spatial hashes, creature list, particle list, and
 *  event bus.  Every system receives a `Tank` reference and reads/mutates
 *  state through it.  Tank itself contains no simulation logic — it is a
 *  container only.
 *
 *  The only mutation methods are:
 *   - `resize(w, h)` — recreates the fluid grid on window resize
 *   - `prune()`      — removes dead entities once per frame
 *   - `tickFields(dt)` — advances time-decaying tank-level fields */

import { FluidGrid, defaultFluidConfig } from '@/tank/Fluid';
import { SpatialHash } from '@/utils/spatialHash';
import { EventBus } from '@/types/events';
import type { TankEvent } from '@/types/entities';
import type { Creature } from '@/creatures/Creature';
import type { Particle } from '@/particles/Particle';

// ── Dimensions ────────────────────────────────────────────────────────────────

export interface TankDimensions {
  width: number;
  height: number;
}

// ── Tank ──────────────────────────────────────────────────────────────────────

export class Tank {
  width: number;
  height: number;

  // fluid is recreated on resize — intentionally NOT readonly
  fluid: FluidGrid;

  readonly events: EventBus<TankEvent>;

  creatures: Creature[] = [];
  particles: Particle[] = [];

  /**
   * Spatial hash for creature lookups — rebuilt each frame by SimulationLoop
   * before any behaviour queries run.
   * Cell size = 120 px ≈ 2× the largest creature radius.
   */
  readonly creatureHash: SpatialHash<Creature>;

  /**
   * Spatial hash for particle lookups — rebuilt each frame.
   * Cell size = 80 px for tighter food/bubble density.
   */
  readonly particleHash: SpatialHash<Particle>;

  /** Monotonic simulation time in seconds. */
  time = 0;

  /**
   * Active light-pulse intensity [0, 1].
   * Set by LightPulse events; decays at 1.2 units/s.
   */
  lightIntensity = 0;

  /**
   * Active turbulence magnitude [0, 1].
   * Set by ShakeTank / Catastrophe events; decays at 0.8 units/s.
   */
  turbulence = 0;

  constructor({ width, height }: TankDimensions) {
    this.width = width;
    this.height = height;
    this.fluid = new FluidGrid(defaultFluidConfig(width, height));
    this.events = new EventBus<TankEvent>();
    this.creatureHash = new SpatialHash<Creature>(120);
    this.particleHash = new SpatialHash<Particle>(80);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Recreate the fluid grid for the new canvas dimensions.
   * Called from the window resize handler (outside the physics hot loop).
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.fluid = new FluidGrid(defaultFluidConfig(width, height));
  }

  /**
   * Remove dead creatures and expired particles.
   * Called once per frame after the physics pass completes.
   */
  prune(): void {
    this.creatures = this.creatures.filter(c => c.lifeState !== 'dead');
    this.particles = this.particles.filter(p => p.life > 0);
  }

  /**
   * Advance time-decaying tank-level fields.
   * lightIntensity decays at 1.2 units/s; turbulence at 0.8 units/s.
   */
  tickFields(dt: number): void {
    this.time += dt;
    this.lightIntensity = Math.max(0, this.lightIntensity - dt * 1.2);
    this.turbulence = Math.max(0, this.turbulence - dt * 0.8);
  }
}
