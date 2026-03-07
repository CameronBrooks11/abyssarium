import { describe, it, expect } from 'vitest';
import { lerp, clamp, remap, wrapAngle, angleDiff, smoothStep, smootherStep } from '@/utils/math';

describe('scalar math helpers', () => {
  describe('lerp', () => {
    it('lerp at t=0 returns a', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    it('lerp at t=1 returns b', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it('lerp at t=0.5 returns midpoint', () => {
      expect(lerp(0, 100, 0.5)).toBeCloseTo(50);
    });
  });

  describe('clamp', () => {
    it('clamp within range is unchanged', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamp below min returns min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamp above max returns max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('clamp at boundary values', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('remap', () => {
    it('remap maps value from one range to another', () => {
      expect(remap(5, 0, 10, 0, 100)).toBeCloseTo(50);
    });

    it('remap maps boundary values correctly', () => {
      expect(remap(0, 0, 10, 0, 100)).toBeCloseTo(0);
      expect(remap(10, 0, 10, 0, 100)).toBeCloseTo(100);
    });
  });

  describe('wrapAngle', () => {
    it('wrapAngle keeps values in [0, 2π)', () => {
      expect(wrapAngle(0)).toBeCloseTo(0);
      expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI);
      expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    });

    it('wrapAngle handles negative angles', () => {
      const w = wrapAngle(-Math.PI / 2);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(Math.PI * 2);
    });
  });

  describe('angleDiff', () => {
    it('angleDiff returns 0 for same angle', () => {
      expect(angleDiff(1, 1)).toBeCloseTo(0);
    });

    it('angleDiff returns positive for counterclockwise', () => {
      expect(angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    });

    it('angleDiff returns negative for clockwise', () => {
      expect(angleDiff(Math.PI / 2, 0)).toBeCloseTo(-Math.PI / 2);
    });

    it('angleDiff takes shortest path across 0/2π boundary', () => {
      const d = angleDiff(Math.PI * 1.9, 0.1);
      expect(Math.abs(d)).toBeLessThanOrEqual(Math.PI);
    });
  });

  describe('smoothStep', () => {
    it('smoothStep(0) = 0', () => {
      expect(smoothStep(0)).toBeCloseTo(0);
    });

    it('smoothStep(1) = 1', () => {
      expect(smoothStep(1)).toBeCloseTo(1);
    });

    it('smoothStep(0.5) = 0.5', () => {
      expect(smoothStep(0.5)).toBeCloseTo(0.5);
    });

    it('smoothStep is monotonically increasing', () => {
      expect(smoothStep(0.3)).toBeLessThan(smoothStep(0.7));
    });
  });

  describe('smootherStep', () => {
    it('smootherStep(0) = 0', () => {
      expect(smootherStep(0)).toBeCloseTo(0);
    });

    it('smootherStep(1) = 1', () => {
      expect(smootherStep(1)).toBeCloseTo(1);
    });
  });
});
