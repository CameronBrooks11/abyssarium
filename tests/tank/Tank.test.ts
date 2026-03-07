import { describe, it, expect } from 'vitest';
import { Tank } from '@/tank/Tank';
import { Creature } from '@/creatures/Creature';
import { CreatureFactory } from '@/creatures/CreatureFactory';
import { spawnFood } from '@/particles/Food';
import { createRng } from '@/utils/rng';
import { CreatureLifeState } from '@/types/entities';

const rng = createRng(42);
const factory = new CreatureFactory();

const makeTank = () => new Tank({ width: 800, height: 600 });

describe('Tank', () => {
  it('constructs with correct dimensions', () => {
    const tank = makeTank();
    expect(tank.width).toBe(800);
    expect(tank.height).toBe(600);
  });

  it('starts with empty creatures and particles', () => {
    const tank = makeTank();
    expect(tank.creatures).toHaveLength(0);
    expect(tank.particles).toHaveLength(0);
  });

  it('starts with zero time, lightIntensity, turbulence', () => {
    const tank = makeTank();
    expect(tank.time).toBe(0);
    expect(tank.lightIntensity).toBe(0);
    expect(tank.turbulence).toBe(0);
  });

  it('resize updates dimensions and recreates fluid', () => {
    const tank = makeTank();
    const oldFluid = tank.fluid;
    tank.resize(1920, 1080);
    expect(tank.width).toBe(1920);
    expect(tank.height).toBe(1080);
    expect(tank.fluid).not.toBe(oldFluid);
  });

  describe('prune', () => {
    it('removes dead creatures', () => {
      const tank = makeTank();
      const c = factory.create({ x: 400, y: 300 }, createRng(1));
      c.lifeState = CreatureLifeState.Dead;
      tank.creatures.push(c);
      tank.prune();
      expect(tank.creatures).toHaveLength(0);
    });

    it('keeps alive and dying creatures', () => {
      const tank = makeTank();
      const alive = factory.create({ x: 100, y: 100 }, createRng(2));
      const dying = factory.create({ x: 200, y: 200 }, createRng(3));
      dying.lifeState = CreatureLifeState.Dying;
      tank.creatures.push(alive, dying);
      tank.prune();
      expect(tank.creatures).toHaveLength(2);
    });

    it('removes expired particles (life <= 0)', () => {
      const tank = makeTank();
      const p = spawnFood({ x: 100, y: 100 }, rng);
      p.life = 0;
      tank.particles.push(p);
      tank.prune();
      expect(tank.particles).toHaveLength(0);
    });

    it('keeps particles with remaining life', () => {
      const tank = makeTank();
      const p = spawnFood({ x: 100, y: 100 }, rng);
      // life > 0 from spawnFood defaults
      tank.particles.push(p);
      tank.prune();
      expect(tank.particles).toHaveLength(1);
    });
  });

  describe('tickFields', () => {
    it('advances time', () => {
      const tank = makeTank();
      tank.tickFields(0.5);
      expect(tank.time).toBeCloseTo(0.5);
    });

    it('decays lightIntensity', () => {
      const tank = makeTank();
      tank.lightIntensity = 1;
      tank.tickFields(1);
      expect(tank.lightIntensity).toBeLessThan(1);
      expect(tank.lightIntensity).toBeGreaterThanOrEqual(0);
    });

    it('decays turbulence', () => {
      const tank = makeTank();
      tank.turbulence = 1;
      tank.tickFields(1);
      expect(tank.turbulence).toBeLessThan(1);
      expect(tank.turbulence).toBeGreaterThanOrEqual(0);
    });

    it('fields do not go below zero', () => {
      const tank = makeTank();
      tank.lightIntensity = 0;
      tank.turbulence = 0;
      tank.tickFields(100);
      expect(tank.lightIntensity).toBeGreaterThanOrEqual(0);
      expect(tank.turbulence).toBeGreaterThanOrEqual(0);
    });
  });
});
