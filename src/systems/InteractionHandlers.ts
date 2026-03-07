/** registerInteractionHandlers — subscribes one handler per TankEvent type.
 *
 *  Each handler is a pure side-effector: reads the event payload and mutates
 *  Tank state (particles, creatures, fluid fields).  No rendering, no DOM.
 *
 *  Note: TankEvent is a flat interface (not a discriminated union), so the
 *  EventBus.on handler types narrow to `never`. We bridge this with a small
 *  `sub` helper that casts to the correct event type at the registration site.
 *
 *  Returns an array of unsubscribe functions for cleanup. */

import type { Tank } from '@/tank/Tank';
import type { TankEvent } from '@/types/entities';
import { TankEventType, CatastropheKind, CreatureLifeState } from '@/types/entities';
import { spawnFood } from '@/particles/Food';
import { spawnBubble } from '@/particles/Bubble';
import { CreatureFactory } from '@/creatures/CreatureFactory';
import { hsla } from '@/utils/color';
import { applyImpulse } from '@/systems/Physics';
import { createRng, rngFloat, rngInt } from '@/utils/rng';

const rng = createRng(Date.now() & 0xffffffff);
const factory = new CreatureFactory();

/** Maximum live (non-dead) creatures allowed at once. */
const MAX_CREATURES = 40;
/** Hard particle cap — kept in sync with ParticleSystem. */
const MAX_PARTICLES = 600;

// ─────────────────────────────────────────────────────────────────────────────

export const registerInteractionHandlers = (tank: Tank): (() => void)[] => {
  // TankEvent is a flat interface, not a discriminated union, so EventBus.on's
  // Extract<TankEvent, {type:K}> resolves to `never`. Use a typed cast bridge.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = (type: TankEvent['type'], handler: (e: TankEvent) => void): (() => void) =>
    (tank.events as any).on(type, handler);

  return [
    sub('AddFood', e => handleAddFood(tank, e)),
    sub('ShakeTank', e => handleShakeTank(tank, e)),
    sub('LightPulse', e => handleLightPulse(tank, e)),
    sub('SpawnCreature', e => handleSpawnCreature(tank, e)),
    sub('Catastrophe', e => handleCatastrophe(tank, e)),
  ];
};

// ── Add Food ──────────────────────────────────────────────────────────────────

const handleAddFood = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.AddFood) return;
  const { position, count } = event.payload;
  const cap = Math.min(count, MAX_PARTICLES - tank.particles.length);
  for (let i = 0; i < cap; i++) {
    tank.particles.push(spawnFood(position, rng));
  }
};

// ── Shake Tank ────────────────────────────────────────────────────────────────

const handleShakeTank = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.ShakeTank) return;
  const { magnitude } = event.payload;

  for (const creature of tank.creatures) {
    const angle = rngFloat(rng, 0, Math.PI * 2);
    applyImpulse(creature.body, {
      x: Math.cos(angle) * magnitude,
      y: Math.sin(angle) * magnitude,
    });
  }
  for (const p of tank.particles) {
    const angle = rngFloat(rng, 0, Math.PI * 2);
    applyImpulse(p.body, {
      x: Math.cos(angle) * magnitude * 1.5,
      y: Math.sin(angle) * magnitude * 1.5,
    });
  }

  const step = 80;
  for (let x = step / 2; x < tank.width; x += step) {
    for (let y = step / 2; y < tank.height; y += step) {
      tank.fluid.addVelocityAt(
        x,
        y,
        rngFloat(rng, -magnitude * 0.8, magnitude * 0.8),
        rngFloat(rng, -magnitude * 0.8, magnitude * 0.8),
      );
    }
  }

  tank.turbulence = 1.0;
};

// ── Light Pulse ───────────────────────────────────────────────────────────────

const handleLightPulse = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.LightPulse) return;
  const { intensity } = event.payload;
  tank.lightIntensity = Math.min(1, tank.lightIntensity + intensity);

  const burstCount = 15;
  for (let i = 0; i < burstCount; i++) {
    if (tank.particles.length >= MAX_PARTICLES) break;
    tank.particles.push(
      spawnBubble(
        {
          x: rngFloat(rng, 0, tank.width),
          y: rngFloat(rng, tank.height * 0.3, tank.height),
        },
        rng,
      ),
    );
  }
};

// ── Spawn Creature ────────────────────────────────────────────────────────────

const handleSpawnCreature = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.SpawnCreature) return;
  const liveCount = tank.creatures.filter(c => c.lifeState !== CreatureLifeState.Dead).length;
  if (liveCount >= MAX_CREATURES) return;

  const position = event.payload.position ?? {
    x: rngFloat(rng, tank.width * 0.1, tank.width * 0.9),
    y: tank.height * 0.05,
  };

  tank.creatures.push(factory.create(position, rng));
};

// ── Catastrophe ───────────────────────────────────────────────────────────────

const handleCatastrophe = (tank: Tank, event: TankEvent): void => {
  if (event.payload.type !== TankEventType.Catastrophe) return;

  switch (event.payload.kind) {
    case CatastropheKind.PredatorSpawn:
      handlePredatorSpawn(tank);
      break;
    case CatastropheKind.ToxicBloom:
      handleToxicBloom(tank);
      break;
    case CatastropheKind.FreezingShock:
      handleFreezingShock(tank);
      break;
    case CatastropheKind.OxygenStorm:
      handleOxygenStorm(tank);
      break;
  }
};

// ── Catastrophe: Predator Spawn ───────────────────────────────────────────────

const handlePredatorSpawn = (tank: Tank): void => {
  const count = rngInt(rng, 1, 2);
  for (let i = 0; i < count; i++) {
    const creature = factory.create(
      {
        x: rngFloat(rng, tank.width * 0.2, tank.width * 0.8),
        y: tank.height * 0.03,
      },
      rng,
      {
        aggression: rngFloat(rng, 0.8, 1.0),
        speed: rngFloat(rng, 180, 260),
        scale: rngFloat(rng, 1.6, 2.5),
        foodPreference: 'carnivore',
      },
    );
    tank.creatures.push(creature);
  }
};

// ── Catastrophe: Toxic Bloom ──────────────────────────────────────────────────

const handleToxicBloom = (tank: Tank): void => {
  for (const c of tank.creatures) {
    if (c.lifeState === CreatureLifeState.Alive) {
      c.drain(c.energy * 0.55);
    }
  }

  for (let x = 0; x < tank.width; x += 40) {
    tank.fluid.addVelocityAt(x, tank.height * 0.8, 0, -60);
  }

  for (let i = 0; i < 25; i++) {
    if (tank.particles.length >= MAX_PARTICLES) break;
    const p = spawnFood(
      {
        x: rngFloat(rng, 0, tank.width),
        y: rngFloat(rng, tank.height * 0.2, tank.height * 0.8),
      },
      rng,
      hsla(120, 90, 45, 0.9),
    );
    tank.particles.push(p);
  }
};

// ── Catastrophe: Freezing Shock ───────────────────────────────────────────────

const handleFreezingShock = (tank: Tank): void => {
  for (const c of tank.creatures) {
    c.body.velocity = {
      x: c.body.velocity.x * 0.05,
      y: c.body.velocity.y * 0.05,
    };
  }
  for (const p of tank.particles) {
    p.body.velocity = {
      x: p.body.velocity.x * 0.08,
      y: p.body.velocity.y * 0.08,
    };
  }

  for (let x = 0; x < tank.width; x += 40) {
    for (let y = 0; y < tank.height; y += 40) {
      const v = tank.fluid.sampleAt(x, y);
      tank.fluid.addVelocityAt(x, y, -v.x * 1.8, -v.y * 1.8);
    }
  }

  tank.lightIntensity = 0.6;
};

// ── Catastrophe: Oxygen Storm ─────────────────────────────────────────────────

const handleOxygenStorm = (tank: Tank): void => {
  const burstCount = 80;
  for (let i = 0; i < burstCount; i++) {
    if (tank.particles.length >= MAX_PARTICLES) break;
    tank.particles.push(
      spawnBubble(
        {
          x: rngFloat(rng, 0, tank.width),
          y: rngFloat(rng, tank.height * 0.7, tank.height),
        },
        rng,
      ),
    );
  }

  for (let x = 0; x < tank.width; x += 20) {
    tank.fluid.addVelocityAt(x, tank.height * 0.9, rngFloat(rng, -30, 30), -200);
  }

  for (const c of tank.creatures) {
    applyImpulse(c.body, {
      x: rngFloat(rng, -40, 40),
      y: -rngFloat(rng, 80, 180),
    });
  }
};
