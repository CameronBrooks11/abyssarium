# Phase 14 — Testing

## Goal

Write a comprehensive test suite covering all pure logic modules. Tests run
with Vitest in a Node environment (no browser required) because every testable
unit has been designed without DOM dependencies. The test suite serves as both
regression protection and living specification.

---

## Design Principles

1. **Unit tests only — no integration/E2E in this phase** — browser-level
   testing (Playwright) is a Phase 16 CI extension if needed. The core
   simulation logic is unit-testable.
2. **No mocks for math** — `vec2`, `math`, `rng`, `color` functions are tested
   directly with concrete inputs and expected outputs.
3. **Minimal `Tank` fixture** — tests that need a tank construct one via a small
   helper `makeTank()` — no global state.
4. **Property-based style for physics** — verify invariants (`energy never exceeds
   100`, `velocity is bounded by limit`, etc.) rather than exact values for
   simulation outputs that are floating-point sensitive.
5. **Tests live in `tests/`** — mirroring the `src/` directory structure.

---

## Files Produced

| Test File | Covers |
|---|---|
| `tests/utils/vec2.test.ts` | All `vec2` functions |
| `tests/utils/math.test.ts` | All scalar math helpers |
| `tests/utils/rng.test.ts` | `createRng`, `rngFloat`, `rngInt`, `rngPick`, determinism |
| `tests/utils/color.test.ts` | `hsla`, `hslaToString`, `hslaLerp` |
| `tests/utils/spatialHash.test.ts` | Insert, query, rebuild, edge cases |
| `tests/systems/physics.test.ts` | Integration, drag, boundary repulsion, impulse |
| `tests/systems/steering.test.ts` | `seek`, `flee`, `arrive`, `wander` |
| `tests/tank/fluid.test.ts` | Velocity injection, decay, sample |
| `tests/tank/Tank.test.ts` | `prune`, `tickFields` |
| `tests/creatures/Creature.test.ts` | Energy model, lifecycle, segments |
| `tests/creatures/CreatureFactory.test.ts` | Trait ranges, fuzz seed test |
| `tests/particles/Particle.test.ts` | `spawnFood`, `spawnBubble`, `spawnDebris` |
| `tests/systems/BehaviorSystem.test.ts` | seekFood consumes particle, flee fires |
| `tests/systems/InteractionHandlers.test.ts` | Each event handler produces correct side-effects |

---

## Step-by-Step Execution

### 1. Vitest Configuration (`vitest.config.ts`)

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals:     false,
    reporters:   ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include:  ['src/**/*.ts'],
      exclude:  ['src/main.ts', 'src/ui/**', 'src/systems/drawCreature.ts',
                 'src/systems/drawParticle.ts', 'src/systems/drawBackground.ts',
                 'src/systems/Renderer.ts'],
    },
  },
});
```

Coverage excludes DOM-dependent drawing code (canvas 2D is not available in
Node). Everything else is expected to reach ≥ 85% line coverage.

---

### 2. Example: vec2 tests (`tests/utils/vec2.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import {
  vec2, vec2Add, vec2Sub, vec2Scale, vec2Len, vec2Normalise,
  vec2Limit, vec2Dot, vec2Reflect, vec2Rotate, vec2DistSq,
} from '@/utils/vec2';

describe('vec2', () => {
  it('vec2Add sums components', () => {
    expect(vec2Add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
  });

  it('vec2Scale multiplies components', () => {
    expect(vec2Scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 });
  });

  it('vec2Len of (3,4) is 5', () => {
    expect(vec2Len({ x: 3, y: 4 })).toBeCloseTo(5);
  });

  it('vec2Normalise produces unit vector', () => {
    const n = vec2Normalise({ x: 10, y: 0 });
    expect(n.x).toBeCloseTo(1);
    expect(n.y).toBeCloseTo(0);
  });

  it('vec2Normalise of zero vector returns zero', () => {
    const n = vec2Normalise({ x: 0, y: 0 });
    expect(n.x).toBe(0);
    expect(n.y).toBe(0);
  });

  it('vec2Limit does not exceed maxLen', () => {
    const limited = vec2Limit({ x: 100, y: 100 }, 10);
    expect(vec2Len(limited)).toBeCloseTo(10);
  });

  it('vec2Limit keeps vectors already within limit unchanged', () => {
    const v = { x: 3, y: 4 };
    const limited = vec2Limit(v, 10);
    expect(limited.x).toBeCloseTo(3);
    expect(limited.y).toBeCloseTo(4);
  });

  it('vec2Reflect off normal (0,1)', () => {
    const r = vec2Reflect({ x: 1, y: -1 }, { x: 0, y: 1 });
    expect(r.x).toBeCloseTo(1);
    expect(r.y).toBeCloseTo(1);
  });

  it('vec2Rotate by π/2 rotates 90 degrees', () => {
    const r = vec2Rotate({ x: 1, y: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });
});
```

---

### 3. Example: RNG determinism test (`tests/utils/rng.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { createRng, rngFloat, rngInt, rngPick } from '@/utils/rng';

describe('createRng', () => {
  it('produces identical sequences for identical seeds', () => {
    const rng1 = createRng(12345);
    const rng2 = createRng(12345);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = createRng(1);
    const rng2 = createRng(2);
    const a = rng1();
    const b = rng2();
    expect(a).not.toBe(b);
  });

  it('rngFloat returns values within [min, max)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i++) {
      const v = rngFloat(rng, -5, 10);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(10);
    }
  });

  it('rngInt returns integers within [min, max]', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = rngInt(rng, 3, 8);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
    }
  });

  it('rngPick throws on empty array', () => {
    expect(() => rngPick(createRng(1), [])).toThrow(RangeError);
  });
});
```

---

### 4. Example: SpatialHash tests (`tests/utils/spatialHash.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { SpatialHash } from '@/utils/spatialHash';

const makeItem = (x: number, y: number) => ({ position: { x, y }, id: `${x}:${y}` });

describe('SpatialHash', () => {
  it('queryRadius finds items within range', () => {
    const hash = new SpatialHash(50);
    const close = makeItem(10, 10);
    const far   = makeItem(200, 200);
    hash.rebuild([close, far]);
    const out: typeof close[] = [];
    hash.queryRadius(10, 10, 60, out);
    expect(out).toContain(close);
    expect(out).not.toContain(far);
  });

  it('rebuild replaces all previous entries', () => {
    const hash = new SpatialHash(50);
    const a    = makeItem(10, 10);
    const b    = makeItem(20, 20);
    hash.rebuild([a]);
    hash.rebuild([b]);
    const out: typeof a[] = [];
    hash.queryRadius(10, 10, 20, out);
    expect(out).not.toContain(a);
  });

  it('returns empty when nothing inserted', () => {
    const hash = new SpatialHash(50);
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(0, 0, 100, out);
    expect(out).toHaveLength(0);
  });
});
```

---

### 5. Example: Creature model tests (`tests/creatures/Creature.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { Creature } from '@/creatures/Creature';
import { CreatureLifeState, BodyPlan, FoodPreference } from '@/types/entities';
import { hsla } from '@/utils/color';

const makeSpec = () => ({
  id:       'cr_test' as any,
  species:  'Testus testus',
  position: { x: 100, y: 100 },
  traits: {
    speed: 100, curiosity: 0.5, aggression: 0.2, glow: 0.4,
    photophobic: false, foodPreference: FoodPreference.Omnivore,
    bodyPlan: BodyPlan.Blob, palette: [hsla(200, 70, 50), hsla(220, 80, 60)] as const,
    scale: 1.0, segmentCount: 3, spineCount: 0,
  },
});

describe('Creature', () => {
  it('initialises with correct segment count', () => {
    const c = new Creature(makeSpec());
    expect(c.segments).toHaveLength(3);
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

  it('feed does not exceed 100 energy', () => {
    const c = new Creature(makeSpec());
    c.energy = 95;
    c.feed(20);
    expect(c.energy).toBe(100);
  });

  it('tickDying transitions to Dead after 1.2s', () => {
    const c = new Creature(makeSpec());
    c.lifeState  = CreatureLifeState.Dying;
    c.dyingTimer = 1.2;
    c.tickDying(1.2);
    expect(c.lifeState).toBe(CreatureLifeState.Dead);
  });
});
```

---

### 6. Example: CreatureFactory fuzz test (`tests/creatures/CreatureFactory.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { CreatureFactory } from '@/creatures/CreatureFactory';
import { createRng } from '@/utils/rng';

const factory = new CreatureFactory();

describe('CreatureFactory', () => {
  it('produces valid traits for 1000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const rng      = createRng(seed);
      const creature = factory.create({ x: 100, y: 100 }, rng);
      const t        = creature.traits;

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

  it('species name has two words', () => {
    const rng    = createRng(42);
    const c      = factory.create({ x: 0, y: 0 }, rng);
    const parts  = c.species.split(' ');
    expect(parts).toHaveLength(2);
  });
});
```

---

### 7. Example: Physics integration test (`tests/systems/physics.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { PhysicsSystem, applyForce, applyImpulse } from '@/systems/Physics';
import type { RigidBody } from '@/types/entities';
import { vec2Zero } from '@/utils/vec2';

const makeBody = (): RigidBody => ({
  position: { x: 400, y: 300 },
  velocity: vec2Zero(),
  acceleration: vec2Zero(),
  angle: 0, angularVel: 0, mass: 1, drag: 0, angularDrag: 0,
});

describe('PhysicsSystem', () => {
  const physics = new PhysicsSystem({ bounds: { width: 800, height: 600 } });

  it('integrate moves body in direction of applied force', () => {
    const body = makeBody();
    applyForce(body, { x: 100, y: 0 });
    physics.integrate(body, 1 / 60);
    expect(body.position.x).toBeGreaterThan(400);
  });

  it('applyImpulse changes velocity immediately', () => {
    const body = makeBody();
    applyImpulse(body, { x: 50, y: 0 });
    expect(body.velocity.x).toBe(50);
  });

  it('drag reduces velocity over time', () => {
    const body = makeBody();
    applyImpulse(body, { x: 100, y: 0 });
    body.drag = 0.1;
    const initial = body.velocity.x;
    physics.integrate(body, 1 / 60);
    expect(body.velocity.x).toBeLessThan(initial);
  });

  it('clampToBounds keeps body inside bounds', () => {
    const body = makeBody();
    body.position = { x: -50, y: 50 };
    physics.clampToBounds(body);
    expect(body.position.x).toBeGreaterThanOrEqual(0);
  });
});
```

---

## Test Coverage Targets

| Module | Min Line Coverage |
|---|---|
| `src/utils/` | 95% |
| `src/tank/Fluid.ts` | 85% |
| `src/tank/Tank.ts` | 90% |
| `src/creatures/` | 90% |
| `src/particles/` | 85% |
| `src/systems/Physics.ts` | 90% |
| `src/systems/BehaviorSystem.ts` | 75% |
| `src/systems/InteractionHandlers.ts` | 80% |

---

## Running Tests

```bash
# Run once
npm run test

# Watch mode
npx vitest

# Coverage report
npx vitest run --coverage
```

---

## Acceptance Criteria

- [ ] `npm run test` exits 0 with all tests passing
- [ ] RNG determinism test passes for seeds 0–999
- [ ] CreatureFactory fuzz test passes for seeds 0–999
- [ ] `vec2Normalise` of zero vector returns zero (no divide-by-zero)
- [ ] `vec2Limit` never returns a vector longer than `maxLen`
- [ ] Physics integration test: body moves in direction of applied force
- [ ] Coverage report for `src/utils/` ≥ 95%

---

## Notes & Decisions

- **Vitest over Jest** — Vitest runs ESM natively without `ts-jest` transformers,
  aligns with Vite's configuration, and is faster for this project size.
- **Node environment** — all test targets are pure logic, no canvas. Setting
  `environment: 'node'` (not `jsdom`) keeps tests fast and avoids fake DOM
  setup.
- **Fuzz testing at 1000 seeds** — the factory's Gaussian scale can theoretically
  go out-of-range before clamping; the fuzz test catches any missed `clamp` calls.
