import { describe, it, expect } from 'vitest';
import { registerInteractionHandlers } from '@/systems/InteractionHandlers';
import { Tank } from '@/tank/Tank';
import { CreatureFactory } from '@/creatures/CreatureFactory';
import { createRng } from '@/utils/rng';
import { CatastropheKind } from '@/types/entities';
import type { TankEvent } from '@/types/entities';

const factory = new CreatureFactory();
const rng = createRng(1);

const makeTank = () => {
  const tank = new Tank({ width: 800, height: 600 });
  registerInteractionHandlers(tank);
  return tank;
};

const emit = (tank: Tank, event: TankEvent): void => {
  tank.events.emit(event);
};

describe('registerInteractionHandlers', () => {
  it('returns an array of unsubscribe functions', () => {
    const tank = new Tank({ width: 800, height: 600 });
    const unsubs = registerInteractionHandlers(tank);
    expect(Array.isArray(unsubs)).toBe(true);
    expect(unsubs.length).toBeGreaterThan(0);
    expect(typeof unsubs[0]).toBe('function');
  });

  describe('AddFood', () => {
    it('adds food particles to the tank', () => {
      const tank = makeTank();
      const before = tank.particles.length;
      emit(tank, { type: 'AddFood', position: { x: 400, y: 200 }, count: 5 });
      expect(tank.particles.length).toBeGreaterThan(before);
    });

    it('adds up to count particles', () => {
      const tank = makeTank();
      emit(tank, { type: 'AddFood', position: { x: 400, y: 200 }, count: 5 });
      expect(tank.particles.length).toBeLessThanOrEqual(5);
    });
  });

  describe('ShakeTank', () => {
    it('sets turbulence to 1', () => {
      const tank = makeTank();
      emit(tank, { type: 'ShakeTank', magnitude: 100 });
      expect(tank.turbulence).toBeCloseTo(1.0);
    });

    it('applies impulse to creatures', () => {
      const tank = makeTank();
      const creature = factory.create({ x: 400, y: 300 }, rng);
      creature.body.velocity = { x: 0, y: 0 };
      tank.creatures.push(creature);

      emit(tank, { type: 'ShakeTank', magnitude: 200 });
      const speed = Math.sqrt(creature.body.velocity.x ** 2 + creature.body.velocity.y ** 2);
      expect(speed).toBeGreaterThan(0);
    });
  });

  describe('LightPulse', () => {
    it('increases lightIntensity', () => {
      const tank = makeTank();
      expect(tank.lightIntensity).toBe(0);
      emit(tank, { type: 'LightPulse', intensity: 0.7 });
      expect(tank.lightIntensity).toBeGreaterThan(0);
    });

    it('clamps lightIntensity at 1', () => {
      const tank = makeTank();
      tank.lightIntensity = 0.8;
      emit(tank, { type: 'LightPulse', intensity: 1.0 });
      expect(tank.lightIntensity).toBeLessThanOrEqual(1);
    });

    it('adds bubble particles', () => {
      const tank = makeTank();
      const before = tank.particles.length;
      emit(tank, { type: 'LightPulse', intensity: 0.5 });
      expect(tank.particles.length).toBeGreaterThan(before);
    });
  });

  describe('SpawnCreature', () => {
    it('adds a creature to the tank', () => {
      const tank = makeTank();
      const before = tank.creatures.length;
      emit(tank, { type: 'SpawnCreature' });
      expect(tank.creatures.length).toBeGreaterThan(before);
    });

    it('does not exceed MAX_CREATURES (40)', () => {
      const tank = makeTank();
      // Fill up close to the cap
      for (let i = 0; i < 45; i++) {
        emit(tank, { type: 'SpawnCreature' });
      }
      expect(tank.creatures.length).toBeLessThanOrEqual(40);
    });
  });

  describe('Catastrophe — OxygenStorm', () => {
    it('adds bubble particles', () => {
      const tank = makeTank();
      const before = tank.particles.length;
      emit(tank, { type: 'Catastrophe', kind: CatastropheKind.OxygenStorm });
      expect(tank.particles.length).toBeGreaterThan(before);
    });
  });

  describe('Catastrophe — FreezingShock', () => {
    it('reduces creature velocities to near zero', () => {
      const tank = makeTank();
      const creature = factory.create({ x: 400, y: 300 }, rng);
      // Use velocity (100, 0) → after ×0.05 = (5, 0), speed = 5
      creature.body.velocity = { x: 100, y: 0 };
      tank.creatures.push(creature);

      emit(tank, { type: 'Catastrophe', kind: CatastropheKind.FreezingShock });
      const speed = Math.sqrt(creature.body.velocity.x ** 2 + creature.body.velocity.y ** 2);
      // FreezingShock multiplies velocity by 0.05 → speed ≤ 5%  of original
      expect(speed).toBeLessThan(20);
    });
  });

  describe('Catastrophe — ToxicBloom', () => {
    it('halves creature energy', () => {
      const tank = makeTank();
      const creature = factory.create({ x: 400, y: 300 }, rng);
      creature.energy = 80;
      tank.creatures.push(creature);

      emit(tank, { type: 'Catastrophe', kind: CatastropheKind.ToxicBloom });
      // ToxicBloom multiplies energy by 0.45: 80 × 0.45 = 36
      expect(creature.energy).toBeCloseTo(80 * 0.45);
    });
  });

  describe('Catastrophe — PredatorSpawn', () => {
    it('adds a creature to the tank', () => {
      const tank = makeTank();
      const before = tank.creatures.length;
      emit(tank, { type: 'Catastrophe', kind: CatastropheKind.PredatorSpawn });
      expect(tank.creatures.length).toBeGreaterThan(before);
    });
  });
});
