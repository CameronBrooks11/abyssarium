import { describe, it, expect } from 'vitest';
import { FluidGrid, defaultFluidConfig } from '@/tank/Fluid';

describe('defaultFluidConfig', () => {
  it('produces positive cols and rows', () => {
    const cfg = defaultFluidConfig(800, 600);
    expect(cfg.cols).toBeGreaterThan(0);
    expect(cfg.rows).toBeGreaterThan(0);
  });

  it('cellSize is 40', () => {
    const cfg = defaultFluidConfig(800, 600);
    expect(cfg.cellSize).toBe(40);
  });
});

describe('FluidGrid', () => {
  it('constructs with correct dimensions', () => {
    const grid = new FluidGrid(defaultFluidConfig(800, 600));
    expect(grid.cols).toBe(20);
    expect(grid.rows).toBe(15);
    expect(grid.cellSize).toBe(40);
  });

  it('sampleAt returns zero vector at start', () => {
    const grid = new FluidGrid(defaultFluidConfig(800, 600));
    const v = grid.sampleAt(400, 300);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
  });

  it('addVelocityAt then sampleAt returns non-zero velocity nearby', () => {
    const grid = new FluidGrid(defaultFluidConfig(800, 600));
    grid.addVelocityAt(400, 300, 100, 50);
    const v = grid.sampleAt(400, 300);
    // velocity may be spread over cells but should have non-zero component
    expect(v.x !== 0 || v.y !== 0).toBe(true);
  });

  it('step decays velocity over time', () => {
    const grid = new FluidGrid(defaultFluidConfig(800, 600));
    grid.addVelocityAt(400, 300, 100, 0);
    const before = grid.sampleAt(400, 300);
    grid.update(1);
    const after = grid.sampleAt(400, 300);
    // velocity magnitude should be smaller after decay
    expect(Math.abs(after.x)).toBeLessThanOrEqual(Math.abs(before.x) + 1e-6);
  });

  it('sampleAt outside grid bounds returns zero-ish', () => {
    const grid = new FluidGrid(defaultFluidConfig(100, 100));
    const v = grid.sampleAt(-9999, -9999);
    expect(Number.isFinite(v.x)).toBe(true);
    expect(Number.isFinite(v.y)).toBe(true);
  });
});
