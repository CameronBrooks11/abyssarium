import { describe, it, expect } from 'vitest';
import { hsla, hslaToString, hslaWithAlpha } from '@/utils/color';

describe('hsla', () => {
  it('creates an HSLA object', () => {
    const c = hsla(200, 70, 50);
    expect(c).toEqual({ h: 200, s: 70, l: 50, a: 1 });
  });

  it('alpha defaults to 1', () => {
    expect(hsla(0, 0, 0).a).toBe(1);
  });

  it('accepts custom alpha', () => {
    expect(hsla(0, 0, 0, 0.5).a).toBe(0.5);
  });
});

describe('hslaToString', () => {
  it('produces a valid CSS hsla string', () => {
    const s = hslaToString(hsla(200, 70, 50, 1));
    expect(s).toMatch(/^hsla\(/);
    expect(s).toContain('%');
  });

  it('includes all four components', () => {
    const s = hslaToString(hsla(120, 50, 60, 0.8));
    expect(s).toContain('120.0');
    expect(s).toContain('50.0%');
    expect(s).toContain('60.0%');
    expect(s).toContain('0.800');
  });
});

describe('hslaWithAlpha', () => {
  it('changes only alpha', () => {
    const c = hsla(100, 50, 60, 1);
    const r = hslaWithAlpha(c, 0.3);
    expect(r.a).toBeCloseTo(0.3);
    expect(r.h).toBe(c.h);
    expect(r.s).toBe(c.s);
    expect(r.l).toBe(c.l);
  });
});

