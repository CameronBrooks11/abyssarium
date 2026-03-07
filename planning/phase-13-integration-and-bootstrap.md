# Phase 13 — Integration & Bootstrap

## Goal

Wire every system and module together into a running application. This phase
produces the final `src/main.ts` that constructs all objects, registers all
event handlers, starts the simulation loop, and handles window resize. At the
end of this phase, the application is fully functional.

---

## Design Principles

1. **Explicit construction order** — dependencies are built bottom-up and passed
   in via constructor. No global singletons. No module-level `let` mutable state
   outside of `main.ts`.
2. **`main.ts` is thin** — it bootstraps and delegates. All non-trivial logic
   lives in systems.
3. **Initial population before loop start** — spawn the first 12 creatures
   before `loop.start()` so the tank is never empty on first render.
4. **Resize handled cleanly** — debounced `resize` event updates canvas
   dimensions, tank dimensions, physics config, renderer, and fluid grid.

---

## Files Modified

| File | Change |
|---|---|
| `src/main.ts` | Replace stub with full bootstrap |

---

## Step-by-Step Execution

### Final `src/main.ts`

```ts
import { Tank }                       from '@/tank/Tank';
import { SimulationLoop }             from '@/tank/SimulationLoop';
import { PhysicsSystem }              from '@/systems/Physics';
import { BehaviorSystem }             from '@/systems/BehaviorSystem';
import { ParticleSystem }             from '@/systems/ParticleSystem';
import { Renderer }                   from '@/systems/Renderer';
import { InputSystem }                from '@/systems/InputSystem';
import { registerInteractionHandlers } from '@/systems/InteractionHandlers';
import { bindControls }               from '@/ui/controls';
import { HUD }                        from '@/ui/HUD';
import { CreatureFactory }            from '@/creatures/CreatureFactory';
import { spawnFood }                  from '@/particles/Food';
import { createRng }                  from '@/utils/rng';

// ── DOM elements ──────────────────────────────────────────────────────────────

const canvas    = document.getElementById('tank-canvas')    as HTMLCanvasElement;
const container = document.getElementById('tank-container') as HTMLDivElement;

if (!canvas || !container) {
  throw new Error('[Abyssarium] Required DOM elements not found');
}

// ── Sizing helper ─────────────────────────────────────────────────────────────

const getContainerSize = (): { width: number; height: number } => ({
  width:  container.clientWidth  || window.innerWidth,
  height: container.clientHeight || window.innerHeight - 48,
});

const applySize = (width: number, height: number): void => {
  canvas.width  = width;
  canvas.height = height;
};

const { width: initW, height: initH } = getContainerSize();
applySize(initW, initH);

// ── Construct systems ─────────────────────────────────────────────────────────

const tank     = new Tank({ width: initW, height: initH });
const physics  = new PhysicsSystem({ bounds: { width: initW, height: initH } });
const behaviors = new BehaviorSystem();
const particles = new ParticleSystem();
const renderer  = new Renderer(canvas);
const input     = new InputSystem();
const hud       = new HUD();
const factory   = new CreatureFactory();
const rng       = createRng(Date.now() & 0xffffffff);

// ── Register interaction handlers ─────────────────────────────────────────────

registerInteractionHandlers(tank);

// ── Bind UI controls ──────────────────────────────────────────────────────────
// bindControls(input, tank, rng) — tank for width/height in food drop position,
// rng for random catastrophe kind selection, canvas obtained internally via getElementById.

bindControls(input, tank, rng);

// ── Construct simulation loop ─────────────────────────────────────────────────

const loop = new SimulationLoop(tank, physics, behaviors, particles, renderer, input);

loop.onStats(hud.createStatsListener());

// ── Seed initial population ───────────────────────────────────────────────────

const INITIAL_POPULATION = 12;

for (let i = 0; i < INITIAL_POPULATION; i++) {
  tank.creatures.push(factory.create({
    x: 0.05 * initW + rng() * 0.9 * initW,
    y: 0.05 * initH + rng() * 0.9 * initH,
  }, rng));
}

// ── Spawn initial food cloud ──────────────────────────────────────────────────
// Give creatures something to eat immediately so the opening is lively.

for (let i = 0; i < 30; i++) {
  tank.particles.push(spawnFood({
    x: rng() * initW,
    y: rng() * initH * 0.6,
  }, rng));
}

// ── Window resize ─────────────────────────────────────────────────────────────

let resizeTimer: ReturnType<typeof setTimeout> | null = null;

window.addEventListener('resize', () => {
  if (resizeTimer !== null) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const { width, height } = getContainerSize();
    applySize(width, height);
    tank.resize(width, height);
    physics.resize(width, height);
    renderer.resize(width, height);
  }, 120); // 120ms debounce
});

// ── Start ─────────────────────────────────────────────────────────────────────

loop.start();

console.log(
  `[Abyssarium] Running — ${initW}×${initH} — ${INITIAL_POPULATION} creatures`,
);
```

---

## Construction & Dependency Graph

```
                      ┌─────────────┐
                      │   main.ts   │
                      └──────┬──────┘
             ┌───────────────┼────────────────────┐
             ▼               ▼                    ▼
           Tank          PhysicsSystem         Renderer
          /    \              │                    │
        Fluid  EventBus       │                  canvas
         │                   │                    │
    SpatialHash ×2            │             OffscreenCanvas
                              │
             ┌────────────────┼────────────────────┐
             ▼                ▼                    ▼
       BehaviorSystem  ParticleSystem          InputSystem
           │                 │                    │
    behavior fns       spawn fns              EventQueue
           │                 │
      CreatureTraits    Particle types
           │
    steering helpers
           │
      PhysicsSystem (applyForce)

SimulationLoop
  owns all of the above as constructor args
  calls: flush → rebuild → fluid.update → behaviors.update
         → physics.integrate → particles.update
         → tank.tickFields → tank.prune → render
```

---

## Import Alias Cheat Sheet

All cross-module imports use the `@/` alias set in `vite.config.ts` / `tsconfig.json`:

| Import path | Physical location |
|---|---|
| `@/tank/Tank` | `src/tank/Tank.ts` |
| `@/utils/vec2` | `src/utils/vec2.ts` |
| `@/types/entities` | `src/types/entities.ts` |
| `@/creatures/Creature` | `src/creatures/Creature.ts` |
| `@/systems/Physics` | `src/systems/Physics.ts` |

---

## Startup Sequence

```
1. DOM ready (module script)
2. Canvas created, sized to container
3. Tank constructed (fluid grid, event bus, spatial hashes)
4. All systems constructed (physics, behaviors, particles, renderer, input)
5. InteractionHandlers registered on tank.events
6. UI controls bound (buttons, canvas click, keyboard)
7. SimulationLoop wired to all systems
8. HUD stats listener registered
9. Initial 12 creatures spawned
10. Initial 30 food particles placed
11. loop.start() → RAF begins
```

---

## Acceptance Criteria

- [ ] Application starts without errors in browser console
- [ ] 12 creatures are visible immediately on page load
- [ ] All 5 toolbar buttons produce visible effects
- [ ] Canvas click drops food at the correct position
- [ ] Window resize re-fits the canvas and simulation continues without reset
- [ ] HUD shows non-zero creature and particle counts after first frame
- [ ] `npm run build` exits with code 0
- [ ] `tsc --noEmit` passes on full project

---

## Notes & Decisions

- **All imports at file top** — ES module imports are hoisted and must be
  at the top of the file. The `spawnFood` import is declared with all other
  imports in the bootstrap, not inline near its usage.
- **120ms resize debounce** — prevents thrashing the fluid grid on continuous
  resize drags. Canvas resize is visible as a single snap after the user stops.
- **No global `Tank` singleton** — all systems receive `tank` as an argument.
  This makes testing (Phase 14) straightforward: construct a fresh `Tank` per
  test, no cleanup needed.
