import { describe, it, expect } from 'vitest';
import { hsla, hslaToString, hslaLerp, hslaWithAlpha, hslaWithLightness } from '@/utils/color';

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

describe('hslaLerp', () => {
  it('at t=0 returns first color', () => {
    const a = hsla(0, 100, 50);
    const b = hsla(180, 50, 80);
    const r = hslaLerp(a, b, 0);
    expect(r.h).toBeCloseTo(a.h);
    expect(r.s).toBeCloseTo(a.s);
    expect(r.l).toBeCloseTo(a.l);
  });

  it('at t=1 returns second color', () => {
    const a = hsla(0, 100, 50);
    const b = hsla(180, 50, 80);
    const r = hslaLerp(a, b, 1);
    expect(r.h).toBeCloseTo(b.h);
    expect(r.s).toBeCloseTo(b.s);
    expect(r.l).toBeCloseTo(b.l);
  });

  it('at t=0.5 interpolates midpoint', () => {
    const a = hsla(0, 0, 0);
    const b = hsla(0, 100, 100);
    const r = hslaLerp(a, b, 0.5);
    expect(r.s).toBeCloseTo(50);
    expect(r.l).toBeCloseTo(50);
  });

  it('takes short path around hue circle', () => {
    // from 350° to 10° — short path crosses 0 (delta = 20°)
    const a = hsla(350, 100, 50);
    const b = hsla(10, 100, 50);
    const r = hslaLerp(a, b, 0.5);
    // midpoint hue should be near 0° (or 360°), not near 180°
    const hueDist = Math.abs(r.h) % 360;
    expect(hueDist).toBeLessThan(20);
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

describe('hslaWithLightness', () => {
  it('changes only lightness', () => {
    const c = hsla(100, 50, 60, 0.8);
    const r = hslaWithLightness(c, 90);
    expect(r.l).toBe(90);
    expect(r.h).toBe(c.h);
    expect(r.s).toBe(c.s);
    expect(r.a).toBe(c.a);
  });
});
