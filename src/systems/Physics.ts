/** Physics system — semi-implicit Euler integration, force accumulation,
 *  soft boundary repulsion, and turbulence impulses.
 *
 *  Dependency-free: imports only from @/utils/vec2 and @/types/entities.
 *  No canvas, no DOM — fully unit-testable in Node. */

import { vec2Add, vec2Scale, vec2Zero } from '@/utils/vec2';
import type { Vec2 } from '@/utils/vec2';
import type { RigidBody } from '@/types/entities';

// ── Config ────────────────────────────────────────────────────────────────────

export interface PhysicsConfig {
  /** Downward gravitational pull in pixels/s². */
  gravity: number;
  /** Global linear drag multiplier — velocity *= (1 − drag·dt·60). */
  globalDrag: number;
  /** Upward buoyancy force counteracting gravity. Net drift = gravity − buoyancy. */
  buoyancy: number;
  /** Soft boundary repulsion magnitude per pixel of penetration. */
  boundaryForce: number;
  /** Simulation space dimensions (the tank walls). */
  bounds: { width: number; height: number };
}

export const defaultPhysicsConfig = (): PhysicsConfig => ({
  gravity: 40,
  globalDrag: 0.02,
  buoyancy: 38,
  boundaryForce: 800,
  bounds: { width: 800, height: 600 },
});

// ── Force helpers ─────────────────────────────────────────────────────────────

/**
 * Accumulate a force onto a body's acceleration (F = ma → a += F/m).
 * Integrated once per tick then cleared by `integrate`.
 */
export const applyForce = (body: RigidBody, force: Readonly<Vec2>): void => {
  body.acceleration = vec2Add(body.acceleration, vec2Scale(force, 1 / body.mass));
};

/**
 * Apply an instantaneous velocity change (impluse = Δv, bypasses mass).
 * Use for sudden jolts: shakes, explosions, collisions.
 */
export const applyImpulse = (body: RigidBody, impulse: Readonly<Vec2>): void => {
  body.velocity = vec2Add(body.velocity, impulse);
};

// ── Physics system ────────────────────────────────────────────────────────────

export class PhysicsSystem {
  private config: PhysicsConfig;

  constructor(config?: Partial<PhysicsConfig>) {
    this.config = { ...defaultPhysicsConfig(), ...config };
  }

  /** Update simulation bounds (called on canvas resize, outside the hot loop). */
  resize(width: number, height: number): void {
    this.config = { ...this.config, bounds: { width, height } };
  }

  getConfig(): Readonly<PhysicsConfig> {
    return this.config;
  }

  /**
   * Integrate a single rigid body for one timestep dt (seconds).
   *
   * Order of operations:
   *   1. Accumulate environmental forces (gravity, buoyancy, wall repulsion)
   *   2. Semi-implicit Euler velocity update:  v += a·dt
   *   3. Apply linear drag:                    v *= (1 − drag·dt·60)
   *   4. Angular integration
   *   5. Position update:                      p += v·dt
   *   6. Clear accumulator
   */
  integrate(body: RigidBody, dt: number): void {
    const { gravity, globalDrag, buoyancy, boundaryForce, bounds } = this.config;

    // 1 — Environmental forces
    applyForce(body, { x: 0, y: gravity - buoyancy });
    this.applyBoundaryForce(body, boundaryForce, bounds.width, bounds.height);

    // 2 — Velocity update (semi-implicit Euler)
    body.velocity = vec2Add(body.velocity, vec2Scale(body.acceleration, dt));

    // 3 — Linear drag
    const dragFactor = Math.max(0, 1 - (globalDrag + body.drag) * dt * 60);
    body.velocity = vec2Scale(body.velocity, dragFactor);

    // 4 — Angular integration
    body.angle += body.angularVel * dt;
    body.angularVel *= Math.max(0, 1 - body.angularDrag * dt * 60);

    // 5 — Position update
    body.position = vec2Add(body.position, vec2Scale(body.velocity, dt));

    // 6 — Clear accumulator
    body.acceleration = vec2Zero();
  }

  /**
   * Hard-clamp position into bounds after soft repulsion settles.
   * Also zeroes any outward velocity component, preventing tunnelling.
   */
  clampToBounds(body: RigidBody, margin = 0): void {
    const { width, height } = this.config.bounds;
    let x = body.position.x;
    let y = body.position.y;
    let vx = body.velocity.x;
    let vy = body.velocity.y;

    if (x < margin) {
      x = margin;
      if (vx < 0) vx = 0;
    }
    if (x > width - margin) {
      x = width - margin;
      if (vx > 0) vx = 0;
    }
    if (y < margin) {
      y = margin;
      if (vy < 0) vy = 0;
    }
    if (y > height - margin) {
      y = height - margin;
      if (vy > 0) vy = 0;
    }

    body.position = { x, y };
    body.velocity = { x: vx, y: vy };
  }

  /**
   * Apply a radial turbulence impulse to a body.
   * Direction is biased away from centre with random jitter.
   * Used for ShakeTank, Catastrophe events, etc.
   */
  applyTurbulence(
    body: RigidBody,
    centreX: number,
    centreY: number,
    magnitude: number,
    rng: () => number,
  ): void {
    const dx = body.position.x - centreX;
    const dy = body.position.y - centreY;
    const angle = Math.atan2(dy, dx) + (rng() - 0.5) * Math.PI;
    applyImpulse(body, {
      x: Math.cos(angle) * magnitude,
      y: Math.sin(angle) * magnitude,
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Push body away from walls proportionally once it enters the margin zone. */
  private applyBoundaryForce(
    body: RigidBody,
    forceMag: number,
    width: number,
    height: number,
  ): void {
    const { x, y } = body.position;
    const margin = 40; // pixel zone from each wall where repulsion acts

    if (x < margin) {
      applyForce(body, { x: (forceMag * (margin - x)) / margin, y: 0 });
    }
    if (x > width - margin) {
      applyForce(body, { x: (-forceMag * (x - (width - margin))) / margin, y: 0 });
    }
    if (y < margin) {
      applyForce(body, { x: 0, y: (forceMag * (margin - y)) / margin });
    }
    if (y > height - margin) {
      applyForce(body, { x: 0, y: (-forceMag * (y - (height - margin))) / margin });
    }
  }
}
