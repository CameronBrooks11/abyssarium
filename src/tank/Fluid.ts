/** Fluid velocity grid — Jos Stam-lite diffusion, advection, and decay.
 *
 *  Stores an interleaved Float32Array of [vx, vy] pairs per cell.
 *  Resolution is decoupled from pixel resolution (default: one cell per 40 px).
 *  This is not a Navier-Stokes solver — no pressure solve, no divergence
 *  correction.  The goal is soft visual currents, not fluid accuracy. */

import { lerp, clamp } from '@/utils/math';
import type { Vec2 } from '@/utils/vec2';

// ── Config ────────────────────────────────────────────────────────────────────

export interface FluidConfig {
  /** Number of horizontal cells. */
  cols: number;
  /** Number of vertical cells. */
  rows: number;
  /** Physical size of each cell in pixels. */
  cellSize: number;
  /** How quickly velocity diffuses to neighbours [0, 1] per second. */
  diffusion: number;
  /** How quickly velocity decays to zero [0, 1] per second. */
  decay: number;
}

export const defaultFluidConfig = (width: number, height: number): FluidConfig => {
  const cellSize = 40;
  return {
    cols: Math.ceil(width / cellSize),
    rows: Math.ceil(height / cellSize),
    cellSize,
    diffusion: 0.12,
    decay: 0.55,
  };
};

// ── FluidGrid ─────────────────────────────────────────────────────────────────

export class FluidGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;

  // Interleaved [vx0, vy0, vx1, vy1, ...] — typed arrays ~4× faster than number[][]
  private vel: Float32Array;
  private velPrev: Float32Array;

  private readonly diffusion: number;
  private readonly decay: number;

  constructor(config: FluidConfig) {
    this.cols = config.cols;
    this.rows = config.rows;
    this.cellSize = config.cellSize;
    this.diffusion = config.diffusion;
    this.decay = config.decay;
    const n = config.cols * config.rows * 2;
    this.vel = new Float32Array(n);
    this.velPrev = new Float32Array(n);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /**
   * Bilinearly-interpolated fluid velocity at pixel position (px, py).
   * Returns {x:0, y:0} for positions outside the grid.
   */
  sampleAt(px: number, py: number): Vec2 {
    const fx = px / this.cellSize - 0.5;
    const fy = py / this.cellSize - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;

    const v00 = this.getCell(x0, y0);
    const v10 = this.getCell(x0 + 1, y0);
    const v01 = this.getCell(x0, y0 + 1);
    const v11 = this.getCell(x0 + 1, y0 + 1);

    return {
      x: lerp(lerp(v00.x, v10.x, tx), lerp(v01.x, v11.x, tx), ty),
      y: lerp(lerp(v00.y, v10.y, tx), lerp(v01.y, v11.y, tx), ty),
    };
  }

  // ── Mutation ──────────────────────────────────────────────────────────────

  /**
   * Add a velocity impulse at pixel position (px, py).
   * Spreads to a square neighbourhood of `radius` cells around the target cell.
   */
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

  /** Advance fluid one timestep: diffuse → advect → decay. */
  update(dt: number): void {
    this.diffuse(dt);
    this.advect(dt);
    this.applyDecay(dt);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private idx(x: number, y: number): number {
    return (y * this.cols + x) * 2;
  }

  private getCell(x: number, y: number): Vec2 {
    const cx = clamp(x, 0, this.cols - 1);
    const cy = clamp(y, 0, this.rows - 1);
    const i = this.idx(cx, cy);
    return { x: this.vel[i]!, y: this.vel[i + 1]! };
  }

  private addCell(x: number, y: number, vx: number, vy: number): void {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    const i = this.idx(x, y);
    this.vel[i]! += vx;
    this.vel[i + 1]! += vy;
  }

  /** Simple 4-neighbour diffusion pass. Runs once per frame (no Gauss-Seidel iterations). */
  private diffuse(dt: number): void {
    const k = this.diffusion * dt;
    const prev = this.vel;
    const next = this.velPrev;
    next.set(prev);

    for (let y = 1; y < this.rows - 1; y++) {
      for (let x = 1; x < this.cols - 1; x++) {
        const i = this.idx(x, y);
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

    // Swap buffers (no allocation)
    this.vel = next;
    this.velPrev = prev;
  }

  /** Semi-Lagrangian back-trace advection. */
  private advect(dt: number): void {
    const cs = this.cellSize;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const i = this.idx(x, y);
        const vx = this.vel[i]!;
        const vy = this.vel[i + 1]!;
        // Back-trace one timestep along the velocity field
        const srcX = x - (vx * dt) / cs;
        const srcY = y - (vy * dt) / cs;
        const sampled = this.sampleAtCell(srcX, srcY);
        this.velPrev[i]! = sampled.x;
        this.velPrev[i + 1]! = sampled.y;
      }
    }
    // Swap (velPrev now has advected result)
    const tmp = this.vel;
    this.vel = this.velPrev;
    this.velPrev = tmp;
  }

  /** Bilinear sample using fractional cell coordinates. */
  private sampleAtCell(fx: number, fy: number): Vec2 {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;

    const ci = (x: number, y: number): number =>
      this.idx(clamp(x, 0, this.cols - 1), clamp(y, 0, this.rows - 1));

    const i00 = ci(x0, y0);
    const i10 = ci(x0 + 1, y0);
    const i01 = ci(x0, y0 + 1);
    const i11 = ci(x0 + 1, y0 + 1);

    return {
      x: lerp(
        lerp(this.vel[i00]!, this.vel[i10]!, tx),
        lerp(this.vel[i01]!, this.vel[i11]!, tx),
        ty,
      ),
      y: lerp(
        lerp(this.vel[i00 + 1]!, this.vel[i10 + 1]!, tx),
        lerp(this.vel[i01 + 1]!, this.vel[i11 + 1]!, tx),
        ty,
      ),
    };
  }

  /** Multiply all velocities by a decay factor. */
  private applyDecay(dt: number): void {
    const factor = Math.max(0, 1 - this.decay * dt);
    for (let i = 0; i < this.vel.length; i++) {
      this.vel[i]! *= factor;
    }
  }
}
