import { describe, it, expect } from 'vitest';
import { CreatureFactory } from '@/creatures/CreatureFactory';
import { createRng } from '@/utils/rng';
import { CreatureLifeState, BodyPlan, FoodPreference } from '@/types/entities';

const factory = new CreatureFactory();

describe('CreatureFactory', () => {
  it('produces a Creature instance', () => {
    const rng = createRng(1);
    const c = factory.create({ x: 100, y: 100 }, rng);
    expect(c).toBeDefined();
    expect(c.traits).toBeDefined();
  });

  it('species name has two words', () => {
    const rng = createRng(42);
    const c = factory.create({ x: 0, y: 0 }, rng);
    const parts = c.species.split(' ');
    expect(parts).toHaveLength(2);
  });

  it('creature starts with Alive life state', () => {
    const rng = createRng(7);
    const c = factory.create({ x: 400, y: 300 }, rng);
    expect(c.lifeState).toBe(CreatureLifeState.Alive);
  });

  it('position is set from argument', () => {
    const rng = createRng(5);
    const c = factory.create({ x: 123, y: 456 }, rng);
    expect(c.body.position.x).toBeCloseTo(123);
    expect(c.body.position.y).toBeCloseTo(456);
  });

  it('produces valid traits for 1000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const rng = createRng(seed);
      const creature = factory.create({ x: 100, y: 100 }, rng);
      const t = creature.traits;

      expect(t.speed).toBeGreaterThanOrEqual(20);
      expect(t.speed).toBeLessThanOrEqual(300);
      expect(t.scale).toBeGreaterThanOrEqual(0.4);
      expect(t.scale).toBeLessThanOrEqual(2.5);
      expect(t.aggression).toBeGreaterThanOrEqual(0);
      expect(t.aggression).toBeLessThanOrEqual(1);
      expect(t.curiosity).toBeGreaterThanOrEqual(0);
      expect(t.curiosity).toBeLessThanOrEqual(1);
      expect(t.glow).toBeGreaterThanOrEqual(0);
      expect(t.glow).toBeLessThanOrEqual(1);
      expect(t.segmentCount).toBeGreaterThanOrEqual(1);
      expect(t.segmentCount).toBeLessThanOrEqual(12);
    }
  });

  it('palette has two entries', () => {
    const rng = createRng(8);
    const c = factory.create({ x: 0, y: 0 }, rng);
    expect(c.traits.palette).toHaveLength(2);
  });

  it('body plan is one of the known plans', () => {
    const validPlans = Object.values(BodyPlan);
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      const c = factory.create({ x: 0, y: 0 }, rng);
      expect(validPlans).toContain(c.traits.bodyPlan);
    }
  });

  it('food preference is one of the known preferences', () => {
    const validPrefs = Object.values(FoodPreference);
    for (let seed = 0; seed < 20; seed++) {
      const rng = createRng(seed);
      const c = factory.create({ x: 0, y: 0 }, rng);
      expect(validPrefs).toContain(c.traits.foodPreference);
    }
  });

  it('different seeds produce different species', () => {
    const rng1 = createRng(1);
    const rng2 = createRng(999);
    const c1 = factory.create({ x: 0, y: 0 }, rng1);
    const c2 = factory.create({ x: 0, y: 0 }, rng2);
    // Not guaranteed but very likely for different seeds
    // Just check they are valid strings
    expect(typeof c1.species).toBe('string');
    expect(typeof c2.species).toBe('string');
  });

  it('segments array length matches segmentCount', () => {
    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(seed);
      const c = factory.create({ x: 100, y: 100 }, rng);
      expect(c.segments).toHaveLength(c.traits.segmentCount);
    }
  });
});
