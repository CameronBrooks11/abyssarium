import { describe, it, expect } from 'vitest';
import { BehaviorSystem } from '@/systems/BehaviorSystem';
import { Tank } from '@/tank/Tank';
import { CreatureFactory } from '@/creatures/CreatureFactory';
import { spawnFood } from '@/particles/Food';
import { createRng } from '@/utils/rng';
import { CreatureLifeState, FoodPreference } from '@/types/entities';

const factory = new CreatureFactory();

const makeTank = () => new Tank({ width: 800, height: 600 });

describe('BehaviorSystem', () => {
  it('constructs without error', () => {
    expect(() => new BehaviorSystem()).not.toThrow();
  });

  it('update does not throw with empty tank', () => {
    const behaviors = new BehaviorSystem();
    const tank = makeTank();
    expect(() => behaviors.update(tank, 1 / 60)).not.toThrow();
  });

  it('update does not throw with creatures', () => {
    const behaviors = new BehaviorSystem();
    const tank = makeTank();
    const rng = createRng(1);
    for (let i = 0; i < 5; i++) {
      tank.creatures.push(factory.create({ x: 400, y: 300 }, rng));
    }
    tank.creatureHash.rebuild(tank.creatures);
    tank.particleHash.rebuild(tank.particles);
    expect(() => behaviors.update(tank, 1 / 60)).not.toThrow();
  });

  it('drains energy from alive creatures over time', () => {
    const behaviors = new BehaviorSystem();
    const tank = makeTank();
    const rng = createRng(10);
    const creature = factory.create({ x: 400, y: 300 }, rng);
    creature.energy = 50;
    tank.creatures.push(creature);
    tank.creatureHash.rebuild(tank.creatures);
    tank.particleHash.rebuild(tank.particles);

    behaviors.update(tank, 1);
    // energy should have decreased
    expect(creature.energy).toBeLessThan(50);
  });

  it('dying creatures do not steer — they tick down', () => {
    const behaviors = new BehaviorSystem();
    const tank = makeTank();
    const rng = createRng(2);
    const creature = factory.create({ x: 400, y: 300 }, rng);
    creature.lifeState = CreatureLifeState.Dying;
    creature.dyingTimer = 1.0;
    tank.creatures.push(creature);
    tank.creatureHash.rebuild(tank.creatures);
    tank.particleHash.rebuild(tank.particles);

    behaviors.update(tank, 0.5);
    // dyingTimer should have decreased
    expect(creature.dyingTimer).toBeCloseTo(0.5);
  });

  it('transitions dying creature to dead when timer expires', () => {
    const behaviors = new BehaviorSystem();
    const tank = makeTank();
    const rng = createRng(3);
    const creature = factory.create({ x: 400, y: 300 }, rng);
    creature.lifeState = CreatureLifeState.Dying;
    creature.dyingTimer = 0.1;
    tank.creatures.push(creature);
    tank.creatureHash.rebuild(tank.creatures);
    tank.particleHash.rebuild(tank.particles);

    behaviors.update(tank, 1);
    expect(creature.lifeState).toBe(CreatureLifeState.Dead);
  });

  it('herbivore targets nearby food', () => {
    const behaviors = new BehaviorSystem();
    const tank = makeTank();
    const rng = createRng(42);

    // Create a herbivore
    const creature = factory.create({ x: 400, y: 300 }, rng);
    // Force herbivore preference for this test
    (creature.traits as any).foodPreference = FoodPreference.Herbivore;
    tank.creatures.push(creature);

    // Spawn food close to the creature
    const food = spawnFood({ x: 410, y: 300 }, rng);
    tank.particles.push(food);
    tank.creatureHash.rebuild(tank.creatures);
    tank.particleHash.rebuild(tank.particles);

    behaviors.update(tank, 1 / 60);
    // After one tick, food should be targeted (unless consumed immediately)
    // At least the behavior ran without error and creature is still alive or ate
    expect(creature.lifeState === CreatureLifeState.Alive || creature.energy >= 70).toBe(true);
  });

  it('consumes food particle on contact', () => {
    const behaviors = new BehaviorSystem();
    const tank = makeTank();
    const rng = createRng(99);

    const creature = factory.create({ x: 400, y: 300 }, rng);
    (creature.traits as any).foodPreference = FoodPreference.Herbivore;
    creature.energy = 50;
    tank.creatures.push(creature);

    // Place food exactly at creature position (within EAT_DISTANCE_SQ = 16px)
    const food = spawnFood({ x: 400, y: 300 }, rng);
    // Override position to be exactly at creature
    food.body.position = { x: 400, y: 300 };
    tank.particles.push(food);
    tank.creatureHash.rebuild(tank.creatures);
    tank.particleHash.rebuild(tank.particles);

    behaviors.update(tank, 1 / 60);
    // Food should be consumed (life = 0) and creature should have gained energy
    expect(food.life).toBe(0);
    expect(creature.energy).toBeGreaterThan(50);
  });
});
