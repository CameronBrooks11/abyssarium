import { describe, it, expect } from 'vitest';
import { createRng, rngFloat, rngInt, rngPick, rngChance, rngGaussian } from '@/utils/rng';

describe('createRng', () => {
  it('produces identical sequences for identical seeds', () => {
    const rng1 = createRng(12345);
    const rng2 = createRng(12345);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = createRng(1);
    const rng2 = createRng(2);
    const a = rng1();
    const b = rng2();
    expect(a).not.toBe(b);
  });

  it('always returns values in [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rngFloat', () => {
  it('returns values within [min, max)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i++) {
      const v = rngFloat(rng, -5, 10);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(10);
    }
  });

  it('distributes across the full range', () => {
    const rng = createRng(7);
    let hasLow = false;
    let hasHigh = false;
    for (let i = 0; i < 500; i++) {
      const v = rngFloat(rng, 0, 100);
      if (v < 20) hasLow = true;
      if (v > 80) hasHigh = true;
    }
    expect(hasLow).toBe(true);
    expect(hasHigh).toBe(true);
  });
});

describe('rngInt', () => {
  it('returns integers within [min, max] inclusive', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = rngInt(rng, 3, 8);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
    }
  });

  it('can return both min and max', () => {
    const rng = createRng(100);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      seen.add(rngInt(rng, 1, 3));
    }
    expect(seen.has(1)).toBe(true);
    expect(seen.has(3)).toBe(true);
  });
});

describe('rngPick', () => {
  it('picks items from the array', () => {
    const rng = createRng(1);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(rngPick(rng, items));
    }
  });

  it('throws on empty array', () => {
    expect(() => rngPick(createRng(1), [])).toThrow(RangeError);
  });

  it('always returns the only element for single-item array', () => {
    const rng = createRng(1);
    expect(rngPick(rng, ['x'])).toBe('x');
  });
});

describe('rngChance', () => {
  it('returns true with p=1 always', () => {
    const rng = createRng(1);
    for (let i = 0; i < 100; i++) {
      expect(rngChance(rng, 1)).toBe(true);
    }
  });

  it('returns false with p=0 always', () => {
    const rng = createRng(1);
    for (let i = 0; i < 100; i++) {
      expect(rngChance(rng, 0)).toBe(false);
    }
  });
});

describe('rngGaussian', () => {
  it('returns finite values', () => {
    const rng = createRng(123);
    for (let i = 0; i < 100; i++) {
      const v = rngGaussian(rng, 0, 1);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('mean is approximately correct over many samples', () => {
    const rng = createRng(456);
    let sum = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      sum += rngGaussian(rng, 10, 1);
    }
    expect(sum / n).toBeCloseTo(10, 0);
  });
});
