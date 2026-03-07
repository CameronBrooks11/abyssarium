import { describe, it, expect } from 'vitest';
import { seek, flee, arrive, wander } from '@/utils/steering';
import { vec2Zero, vec2Len } from '@/utils/vec2';
import type { RigidBody } from '@/types/entities';
import { createRng } from '@/utils/rng';

const makeBody = (x = 0, y = 0): RigidBody => ({
  position: { x, y },
  velocity: vec2Zero(),
  acceleration: vec2Zero(),
  angle: 0,
  angularVel: 0,
  mass: 1,
  drag: 0,
  angularDrag: 0,
});

describe('seek', () => {
  it('steers body toward target in positive x direction', () => {
    const body = makeBody(0, 0);
    const f = seek(body, { x: 100, y: 0 }, 100, 200);
    expect(f.x).toBeGreaterThan(0);
  });

  it('steers body toward target in negative y direction', () => {
    const body = makeBody(0, 100);
    const f = seek(body, { x: 0, y: 0 }, 100, 200);
    expect(f.y).toBeLessThan(0);
  });

  it('force magnitude does not exceed maxForce', () => {
    const body = makeBody(0, 0);
    const f = seek(body, { x: 1000, y: 0 }, 100, 50);
    expect(vec2Len(f)).toBeLessThanOrEqual(50 + 1e-9);
  });
});

describe('flee', () => {
  it('steers body away from threat in negative x direction', () => {
    const body = makeBody(0, 0);
    const f = flee(body, { x: 100, y: 0 }, 100, 200);
    expect(f.x).toBeLessThan(0);
  });

  it('force magnitude does not exceed maxForce', () => {
    const body = makeBody(0, 0);
    const f = flee(body, { x: 50, y: 50 }, 100, 30);
    expect(vec2Len(f)).toBeLessThanOrEqual(30 + 1e-9);
  });
});

describe('arrive', () => {
  it('returns zero force when at target', () => {
    const body = makeBody(100, 100);
    const f = arrive(body, { x: 100, y: 100 }, 100, 200, 50);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo(0);
  });

  it('steers toward target when far away', () => {
    const body = makeBody(0, 0);
    const f = arrive(body, { x: 500, y: 0 }, 100, 200, 50);
    expect(f.x).toBeGreaterThan(0);
  });

  it('force is smaller when within slowRadius', () => {
    const body = makeBody(0, 0);
    const farForce = arrive(body, { x: 500, y: 0 }, 100, 200, 50);
    const closeForce = arrive(body, { x: 30, y: 0 }, 100, 200, 50);
    expect(vec2Len(closeForce)).toBeLessThan(vec2Len(farForce));
  });

  it('force does not exceed maxForce', () => {
    const body = makeBody(0, 0);
    const f = arrive(body, { x: 1000, y: 0 }, 100, 50, 100);
    expect(vec2Len(f)).toBeLessThanOrEqual(50 + 1e-9);
  });
});

describe('wander', () => {
  it('returns a force and updated wander angle', () => {
    const body = makeBody(100, 100);
    body.velocity = { x: 1, y: 0 };
    const rng = createRng(1);
    const result = wander(body, 0, 50, 100, 0.5, rng, 200);
    expect(typeof result.force.x).toBe('number');
    expect(typeof result.nextWanderAngle).toBe('number');
  });

  it('wander angle changes each call', () => {
    const body = makeBody(100, 100);
    body.velocity = { x: 1, y: 0 };
    const rng = createRng(42);
    const r1 = wander(body, 0, 50, 100, 1.0, rng, 200);
    const r2 = wander(body, r1.nextWanderAngle, 50, 100, 1.0, rng, 200);
    expect(r1.nextWanderAngle).not.toBe(r2.nextWanderAngle);
  });

  it('force does not exceed maxForce', () => {
    const body = makeBody(100, 100);
    body.velocity = { x: 10, y: 0 };
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) {
      const r = wander(body, i * 0.1, 50, 100, 0.5, rng, 100);
      expect(vec2Len(r.force)).toBeLessThanOrEqual(100 + 1e-9);
    }
  });
});
