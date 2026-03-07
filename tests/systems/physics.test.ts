import { describe, it, expect } from 'vitest';
import { PhysicsSystem, applyForce, applyImpulse, defaultPhysicsConfig } from '@/systems/Physics';
import type { RigidBody } from '@/types/entities';
import { vec2Zero } from '@/utils/vec2';
import { vec2Len } from '@/utils/vec2';

const makeBody = (): RigidBody => ({
  position: { x: 400, y: 300 },
  velocity: vec2Zero(),
  acceleration: vec2Zero(),
  angle: 0,
  angularVel: 0,
  mass: 1,
  drag: 0,
  angularDrag: 0,
});

describe('defaultPhysicsConfig', () => {
  it('returns a fully populated config', () => {
    const cfg = defaultPhysicsConfig();
    expect(cfg.gravity).toBeGreaterThan(0);
    expect(cfg.bounds.width).toBeGreaterThan(0);
    expect(cfg.bounds.height).toBeGreaterThan(0);
  });
});

describe('applyForce', () => {
  it('accumulates force onto acceleration (F/m)', () => {
    const body = makeBody();
    applyForce(body, { x: 100, y: 0 });
    expect(body.acceleration.x).toBeCloseTo(100); // mass = 1
  });

  it('divides by mass', () => {
    const body = makeBody();
    body.mass = 2;
    applyForce(body, { x: 100, y: 0 });
    expect(body.acceleration.x).toBeCloseTo(50);
  });
});

describe('applyImpulse', () => {
  it('changes velocity immediately', () => {
    const body = makeBody();
    applyImpulse(body, { x: 50, y: 0 });
    expect(body.velocity.x).toBe(50);
  });

  it('accumulates multiple impulses', () => {
    const body = makeBody();
    applyImpulse(body, { x: 10, y: 0 });
    applyImpulse(body, { x: 20, y: 0 });
    expect(body.velocity.x).toBeCloseTo(30);
  });
});

describe('PhysicsSystem', () => {
  const physics = new PhysicsSystem({ bounds: { width: 800, height: 600 } });

  it('integrate moves body in direction of applied force', () => {
    const body = makeBody();
    applyForce(body, { x: 100, y: 0 });
    physics.integrate(body, 1 / 60);
    expect(body.position.x).toBeGreaterThan(400);
  });

  it('integrate clears acceleration after step', () => {
    const body = makeBody();
    applyForce(body, { x: 200, y: 0 });
    physics.integrate(body, 1 / 60);
    expect(body.acceleration.x).toBeCloseTo(0);
    expect(body.acceleration.y).toBeCloseTo(0);
  });

  it('drag reduces velocity over time', () => {
    const body = makeBody();
    applyImpulse(body, { x: 100, y: 0 });
    body.drag = 0.1;
    const initial = body.velocity.x;
    physics.integrate(body, 1 / 60);
    expect(body.velocity.x).toBeLessThan(initial);
  });

  it('angular velocity advances angle', () => {
    const body = makeBody();
    body.angularVel = Math.PI;
    physics.integrate(body, 1);
    expect(body.angle).toBeGreaterThan(0);
  });

  it('body moves in positive x given positive x velocity', () => {
    const body = makeBody();
    applyImpulse(body, { x: 100, y: 0 });
    const startX = body.position.x;
    physics.integrate(body, 1 / 60);
    expect(body.position.x).toBeGreaterThan(startX);
  });

  it('getConfig reflects constructor options', () => {
    const p = new PhysicsSystem({ bounds: { width: 1280, height: 720 } });
    expect(p.getConfig().bounds.width).toBe(1280);
    expect(p.getConfig().bounds.height).toBe(720);
  });

  it('resize updates bounds', () => {
    const p = new PhysicsSystem({ bounds: { width: 800, height: 600 } });
    p.resize(1920, 1080);
    expect(p.getConfig().bounds.width).toBe(1920);
    expect(p.getConfig().bounds.height).toBe(1080);
  });

  it('clampToBounds keeps body inside bounds', () => {
    const body = makeBody();
    body.position = { x: -50, y: 50 };
    physics.clampToBounds(body);
    expect(body.position.x).toBeGreaterThanOrEqual(0);
  });

  it('clampToBounds zeroes outward velocity when clamped at left wall', () => {
    const body = makeBody();
    body.position = { x: -10, y: 300 };
    body.velocity = { x: -50, y: 0 };
    physics.clampToBounds(body);
    expect(body.velocity.x).toBeGreaterThanOrEqual(0);
  });

  it('velocity magnitude does not grow unboundedly under typical forces', () => {
    const body = makeBody();
    body.drag = 0.05;
    // run 300 frames of moderate force
    for (let i = 0; i < 300; i++) {
      applyForce(body, { x: 50, y: 0 });
      physics.integrate(body, 1 / 60);
    }
    expect(vec2Len(body.velocity)).toBeLessThan(10000);
  });
});
