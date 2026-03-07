import { describe, it, expect } from 'vitest';
import { Creature } from '@/creatures/Creature';
import { CreatureLifeState, BodyPlan, FoodPreference } from '@/types/entities';
import { hsla } from '@/utils/color';
import type { CreatureSpec } from '@/creatures/Creature';

const makeSpec = (): CreatureSpec => ({
  id: 'cr_test' as any,
  species: 'Testus testus',
  position: { x: 100, y: 100 },
  traits: {
    speed: 100,
    curiosity: 0.5,
    aggression: 0.2,
    glow: 0.4,
    photophobic: false,
    foodPreference: FoodPreference.Omnivore,
    bodyPlan: BodyPlan.Blob,
    palette: [hsla(200, 70, 50), hsla(220, 80, 60)],
    scale: 1.0,
    segmentCount: 3,
    spineCount: 0,
  },
});

describe('Creature', () => {
  it('initialises with correct segment count', () => {
    const c = new Creature(makeSpec());
    expect(c.segments).toHaveLength(3);
  });

  it('initialises with Alive life state', () => {
    const c = new Creature(makeSpec());
    expect(c.lifeState).toBe(CreatureLifeState.Alive);
  });

  it('position getter mirrors body position', () => {
    const c = new Creature(makeSpec());
    expect(c.position).toBe(c.body.position);
  });

  it('radius is derived from scale', () => {
    const c = new Creature(makeSpec());
    expect(c.radius).toBeCloseTo(10 * c.traits.scale);
  });

  it('mass is derived from scale', () => {
    const spec = makeSpec();
    const c = new Creature(spec);
    expect(c.body.mass).toBeCloseTo(0.5 + spec.traits.scale * 1.5);
  });

  it('energy starts at 70', () => {
    const c = new Creature(makeSpec());
    expect(c.energy).toBe(70);
  });

  it('drainEnergy reduces energy over time', () => {
    const c = new Creature(makeSpec());
    const before = c.energy;
    c.drainEnergy(1);
    expect(c.energy).toBeLessThan(before);
  });

  it('transitions to Dying when energy reaches zero', () => {
    const c = new Creature(makeSpec());
    c.energy = 0.5;
    c.drainEnergy(1);
    expect(c.lifeState).toBe(CreatureLifeState.Dying);
  });

  it('drainEnergy sets dyingTimer when transitioning to Dying', () => {
    const c = new Creature(makeSpec());
    c.energy = 0.1;
    c.drainEnergy(1);
    expect(c.dyingTimer).toBeCloseTo(1.2);
  });

  it('drainEnergy does not re-transition if already Dying', () => {
    const c = new Creature(makeSpec());
    c.lifeState = CreatureLifeState.Dying;
    c.dyingTimer = 0.5;
    c.energy = 0;
    c.drainEnergy(1);
    expect(c.lifeState).toBe(CreatureLifeState.Dying);
    expect(c.dyingTimer).toBeCloseTo(0.5); // unchanged by drainEnergy
  });

  it('feed increases energy', () => {
    const c = new Creature(makeSpec());
    c.energy = 50;
    c.feed(20);
    expect(c.energy).toBeCloseTo(70);
  });

  it('feed does not exceed 100 energy', () => {
    const c = new Creature(makeSpec());
    c.energy = 95;
    c.feed(20);
    expect(c.energy).toBe(100);
  });

  it('tickDying returns false when not Dying', () => {
    const c = new Creature(makeSpec());
    expect(c.tickDying(1)).toBe(false);
  });

  it('tickDying transitions to Dead after timer expires', () => {
    const c = new Creature(makeSpec());
    c.lifeState = CreatureLifeState.Dying;
    c.dyingTimer = 1.2;
    c.tickDying(1.2);
    expect(c.lifeState).toBe(CreatureLifeState.Dead);
  });

  it('tickDying returns true when transitioning to Dead', () => {
    const c = new Creature(makeSpec());
    c.lifeState = CreatureLifeState.Dying;
    c.dyingTimer = 0.1;
    expect(c.tickDying(1)).toBe(true);
  });

  it('tickDying returns false while still counting down', () => {
    const c = new Creature(makeSpec());
    c.lifeState = CreatureLifeState.Dying;
    c.dyingTimer = 1.5;
    expect(c.tickDying(0.1)).toBe(false);
    expect(c.lifeState).toBe(CreatureLifeState.Dying);
  });

  it('recordPrevPosition updates prevPosition', () => {
    const c = new Creature(makeSpec());
    c.body.position = { x: 200, y: 300 };
    c.recordPrevPosition();
    expect(c.prevPosition.x).toBe(200);
    expect(c.prevPosition.y).toBe(300);
  });

  it('updateSegments pulls segments toward head', () => {
    const c = new Creature(makeSpec());
    // move head far away
    c.body.position = { x: 1000, y: 1000 };
    const oldSeg1X = c.segments[1]?.x ?? 0;
    c.updateSegments(20);
    // segments[1] should have moved toward segments[0]
    expect(c.segments[1]?.x).toBeGreaterThan(oldSeg1X);
  });

  it('hunger is updated by drainEnergy', () => {
    const c = new Creature(makeSpec());
    c.energy = 10;
    c.drainEnergy(0.016);
    expect(c.hunger).toBeGreaterThan(0);
  });
});
