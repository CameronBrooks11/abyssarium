import { describe, it, expect } from 'vitest';
import {
  vec2,
  vec2Add,
  vec2Sub,
  vec2Scale,
  vec2Len,
  vec2LenSq,
  vec2Normalise,
  vec2Limit,
  vec2Dot,
  vec2Reflect,
  vec2Rotate,
  vec2DistSq,
  vec2Dist,
  vec2Lerp,
  vec2Negate,
  vec2Clone,
  vec2Zero,
  vec2Angle,
  vec2FromAngle,
  vec2Clamp,
  vec2Cross,
} from '@/utils/vec2';

describe('vec2', () => {
  it('vec2 constructs a vector', () => {
    expect(vec2(3, 4)).toEqual({ x: 3, y: 4 });
  });

  it('vec2Zero returns origin', () => {
    expect(vec2Zero()).toEqual({ x: 0, y: 0 });
  });

  it('vec2Clone creates independent copy', () => {
    const v = { x: 1, y: 2 };
    const c = vec2Clone(v);
    expect(c).toEqual(v);
    expect(c).not.toBe(v);
  });

  it('vec2Add sums components', () => {
    expect(vec2Add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
  });

  it('vec2Sub subtracts components', () => {
    expect(vec2Sub({ x: 5, y: 3 }, { x: 2, y: 1 })).toEqual({ x: 3, y: 2 });
  });

  it('vec2Scale multiplies components', () => {
    expect(vec2Scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 });
  });

  it('vec2Negate negates components', () => {
    expect(vec2Negate({ x: 3, y: -2 })).toEqual({ x: -3, y: 2 });
  });

  it('vec2Lerp interpolates at t=0 returns a', () => {
    const r = vec2Lerp({ x: 0, y: 0 }, { x: 10, y: 10 }, 0);
    expect(r).toEqual({ x: 0, y: 0 });
  });

  it('vec2Lerp interpolates at t=1 returns b', () => {
    const r = vec2Lerp({ x: 0, y: 0 }, { x: 10, y: 10 }, 1);
    expect(r).toEqual({ x: 10, y: 10 });
  });

  it('vec2Lerp interpolates at t=0.5', () => {
    const r = vec2Lerp({ x: 0, y: 0 }, { x: 10, y: 10 }, 0.5);
    expect(r.x).toBeCloseTo(5);
    expect(r.y).toBeCloseTo(5);
  });

  it('vec2LenSq computes squared length', () => {
    expect(vec2LenSq({ x: 3, y: 4 })).toBe(25);
  });

  it('vec2Len of (3,4) is 5', () => {
    expect(vec2Len({ x: 3, y: 4 })).toBeCloseTo(5);
  });

  it('vec2Dist computes distance between two points', () => {
    expect(vec2Dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it('vec2DistSq computes squared distance', () => {
    expect(vec2DistSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });

  it('vec2Dot computes dot product', () => {
    expect(vec2Dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
    expect(vec2Dot({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23);
  });

  it('vec2Cross computes 2D cross product', () => {
    expect(vec2Cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(1);
  });

  it('vec2Normalise produces unit vector', () => {
    const n = vec2Normalise({ x: 10, y: 0 });
    expect(n.x).toBeCloseTo(1);
    expect(n.y).toBeCloseTo(0);
  });

  it('vec2Normalise of (3,4) produces unit vector', () => {
    const n = vec2Normalise({ x: 3, y: 4 });
    expect(vec2Len(n)).toBeCloseTo(1);
  });

  it('vec2Normalise of zero vector returns zero', () => {
    const n = vec2Normalise({ x: 0, y: 0 });
    expect(n.x).toBe(0);
    expect(n.y).toBe(0);
  });

  it('vec2Limit does not exceed maxLen', () => {
    const limited = vec2Limit({ x: 100, y: 100 }, 10);
    expect(vec2Len(limited)).toBeCloseTo(10);
  });

  it('vec2Limit keeps vectors already within limit unchanged', () => {
    const v = { x: 3, y: 4 };
    const limited = vec2Limit(v, 10);
    expect(limited.x).toBeCloseTo(3);
    expect(limited.y).toBeCloseTo(4);
  });

  it('vec2Limit with maxLen 0 returns zero vector', () => {
    const limited = vec2Limit({ x: 5, y: 5 }, 0);
    expect(vec2Len(limited)).toBeCloseTo(0);
  });

  it('vec2Reflect off normal (0,1)', () => {
    const r = vec2Reflect({ x: 1, y: -1 }, { x: 0, y: 1 });
    expect(r.x).toBeCloseTo(1);
    expect(r.y).toBeCloseTo(1);
  });

  it('vec2Rotate by π/2 rotates 90 degrees', () => {
    const r = vec2Rotate({ x: 1, y: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });

  it('vec2Rotate by π flips direction', () => {
    const r = vec2Rotate({ x: 1, y: 0 }, Math.PI);
    expect(r.x).toBeCloseTo(-1);
    expect(r.y).toBeCloseTo(0);
  });

  it('vec2Angle returns angle of vector', () => {
    expect(vec2Angle({ x: 1, y: 0 })).toBeCloseTo(0);
    expect(vec2Angle({ x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });

  it('vec2FromAngle produces vector with correct angle', () => {
    const v = vec2FromAngle(0);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });

  it('vec2Clamp clamps both axes', () => {
    const v = vec2Clamp({ x: -100, y: 200 }, 0, 50, 0, 150);
    expect(v.x).toBe(0);
    expect(v.y).toBe(150);
  });
});
