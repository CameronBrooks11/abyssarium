import { describe, it, expect } from 'vitest';
import { lerp, clamp } from '@/utils/math';

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
});
