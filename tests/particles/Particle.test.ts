import { describe, it, expect } from 'vitest';
import { spawnFood } from '@/particles/Food';
import { spawnBubble } from '@/particles/Bubble';
import { spawnDebris } from '@/particles/Debris';
import { Particle } from '@/particles/Particle';
import { ParticleKind } from '@/types/entities';
import { createRng } from '@/utils/rng';
import { hsla } from '@/utils/color';

describe('spawnFood', () => {
  it('creates a Particle instance', () => {
    const rng = createRng(1);
    const p = spawnFood({ x: 100, y: 100 }, rng);
    expect(p).toBeInstanceOf(Particle);
  });

  it('kind is Food', () => {
    const rng = createRng(1);
    const p = spawnFood({ x: 100, y: 100 }, rng);
    expect(p.kind).toBe(ParticleKind.Food);
  });

  it('has positive life and radius', () => {
    const rng = createRng(2);
    const p = spawnFood({ x: 0, y: 0 }, rng);
    expect(p.life).toBeGreaterThan(0);
    expect(p.radius).toBeGreaterThan(0);
  });

  it('position is near the given position', () => {
    const rng = createRng(3);
    const p = spawnFood({ x: 400, y: 300 }, rng);
    expect(Math.abs(p.body.position.x - 400)).toBeLessThan(20);
    expect(p.body.position.y).toBeCloseTo(300);
  });

  it('position getter matches body position', () => {
    const rng = createRng(4);
    const p = spawnFood({ x: 100, y: 100 }, rng);
    expect(p.position).toBe(p.body.position);
  });

  it('velocity is downward (positive y)', () => {
    const rng = createRng(5);
    const p = spawnFood({ x: 100, y: 100 }, rng);
    expect(p.body.velocity.y).toBeGreaterThan(0);
  });
});

describe('spawnBubble', () => {
  it('creates a Particle instance', () => {
    const rng = createRng(1);
    const p = spawnBubble({ x: 100, y: 100 }, rng);
    expect(p).toBeInstanceOf(Particle);
  });

  it('kind is Bubble', () => {
    const rng = createRng(1);
    const p = spawnBubble({ x: 100, y: 100 }, rng);
    expect(p.kind).toBe(ParticleKind.Bubble);
  });

  it('velocity is upward (negative y)', () => {
    const rng = createRng(2);
    const p = spawnBubble({ x: 200, y: 400 }, rng);
    expect(p.body.velocity.y).toBeLessThan(0);
  });

  it('has positive life and radius', () => {
    const rng = createRng(3);
    const p = spawnBubble({ x: 0, y: 0 }, rng);
    expect(p.life).toBeGreaterThan(0);
    expect(p.radius).toBeGreaterThan(0);
  });
});

describe('spawnDebris', () => {
  it('creates a Particle instance', () => {
    const rng = createRng(1);
    const p = spawnDebris({ x: 100, y: 100 }, { x: 1, y: 0 }, hsla(0, 0, 50), rng);
    expect(p).toBeInstanceOf(Particle);
  });

  it('kind is Debris', () => {
    const rng = createRng(1);
    const p = spawnDebris({ x: 100, y: 100 }, { x: 1, y: 0 }, hsla(200, 50, 60), rng);
    expect(p.kind).toBe(ParticleKind.Debris);
  });

  it('has non-zero spin', () => {
    const rng = createRng(7);
    let hasNonZeroSpin = false;
    for (let i = 0; i < 20; i++) {
      const p = spawnDebris({ x: 0, y: 0 }, { x: 1, y: 0 }, hsla(0, 0, 50), rng);
      if (Math.abs(p.spin) > 0.01) hasNonZeroSpin = true;
    }
    expect(hasNonZeroSpin).toBe(true);
  });

  it('has positive life', () => {
    const rng = createRng(2);
    const p = spawnDebris({ x: 0, y: 0 }, { x: 0, y: 1 }, hsla(100, 50, 50), rng);
    expect(p.life).toBeGreaterThan(0);
  });

  it('color alpha is 0.8', () => {
    const rng = createRng(3);
    const p = spawnDebris({ x: 0, y: 0 }, { x: 1, y: 0 }, hsla(60, 80, 70, 1), rng);
    expect(p.color.a).toBeCloseTo(0.8);
  });
});
