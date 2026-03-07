# Phase 11 — UI Controls & Input System

## Goal

Implement `InputSystem` and `HUD` — the two UI-facing modules that bridge user
interactions to tank events and display live simulation stats. The design keeps
all DOM manipulation isolated here so every other module remains DOM-free and
testable in Node.

---

## Design Principles

1. **Strict DOM isolation** — only `InputSystem`, `HUD`, and `src/ui/controls.ts`
   touch the DOM. Every other module works with data.
2. **Event queue buffering** — button clicks are enqueued into an array rather
   than directly mutating the tank. The simulation loop calls `input.flush(tank)`
   at the start of each fixed step to drain the queue and emit events into
   `tank.events`. This eliminates synchronisation hazards between the RAF loop
   and the DOM event loop.
3. **Typed handlers** — each button has a specific typed handler, not a generic
   string-keyed dispatcher.
4. **HUD is passive** — it reads `LoopStats` from the loop's `onStats` callback
   and writes to DOM text nodes; it never calls into the simulation.

---

## Files Produced

| File | Exports |
|---|---|
| `src/systems/InputSystem.ts` | `InputSystem` class |
| `src/ui/controls.ts` | DOM binding helpers |
| `src/ui/HUD.ts` | `HUD` class |

---

## Step-by-Step Execution

### 1. Input System (`src/systems/InputSystem.ts`)

```ts
import type { Tank } from '@/tank/Tank';
import { nextId, TankEventType } from '@/types/entities';
import type { TankEvent, TankEventPayload, CatastropheKind } from '@/types/entities';
import type { Vec2 } from '@/utils/vec2';

type PendingEvent = TankEventPayload;

export class InputSystem {
  private readonly queue: PendingEvent[] = [];

  // ── Public API (called by controls.ts button handlers) ────────────────────

  queueAddFood(position: Vec2, count = 8): void {
    this.queue.push({ type: 'AddFood', position, count });
  }

  queueShakeTank(magnitude = 180): void {
    this.queue.push({ type: 'ShakeTank', magnitude });
  }

  queueLightPulse(intensity = 1, duration = 2): void {
    this.queue.push({ type: 'LightPulse', intensity, duration });
  }

  queueSpawnCreature(position?: Vec2): void {
    this.queue.push({ type: 'SpawnCreature', position });
  }

  queueCatastrophe(kind: CatastropheKind): void {
    this.queue.push({ type: 'Catastrophe', kind });
  }

  // ── Called by SimulationLoop at start of each fixed step ─────────────────

  flush(tank: Tank): void {
    const now = tank.time;
    for (const payload of this.queue) {
      const event: TankEvent = {
        id:        nextId('ev'),
        type:      payload.type as TankEvent['type'],
        timestamp: now,
        payload,
      };
      tank.events.emit(event);
    }
    this.queue.length = 0;
  }
}
```

---

### 2. Controls Binding (`src/ui/controls.ts`)

```ts
import type { InputSystem }    from '@/systems/InputSystem';
import type { Tank }           from '@/tank/Tank';
import { CatastropheKind }     from '@/types/entities';
import type { Rng }            from '@/utils/rng';
import { rngPick }             from '@/utils/rng';

const CATASTROPHE_KINDS = Object.values(CatastropheKind) as (typeof CatastropheKind)[keyof typeof CatastropheKind][];

export const bindControls = (
  input:  InputSystem,
  tank:   Tank,
  rng:    Rng,
): void => {
  const btn = (id: string): HTMLButtonElement => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLButtonElement)) {
      throw new Error(`Button #${id} not found in DOM`);
    }
    return el;
  };

  // ── Add Food ───────────────────────────────────────────────────────────────
  // Clicking drops food at a random X, near the top of the tank.
  btn('btn-food').addEventListener('click', () => {
    const x = 80 + Math.random() * (tank.width - 160);
    const y = tank.height * 0.1;
    input.queueAddFood({ x, y }, 10);
  });

  // ── Shake Tank ────────────────────────────────────────────────────────────
  btn('btn-shake').addEventListener('click', () => {
    input.queueShakeTank(220);
  });

  // ── Light Pulse ───────────────────────────────────────────────────────────
  btn('btn-light').addEventListener('click', () => {
    input.queueLightPulse(1.0, 2.5);
  });

  // ── Spawn Creature ────────────────────────────────────────────────────────
  btn('btn-spawn').addEventListener('click', () => {
    // Spawn at random top-edge position
    const x = 80 + Math.random() * (tank.width - 160);
    input.queueSpawnCreature({ x, y: 60 });
  });

  // ── Catastrophe ───────────────────────────────────────────────────────────
  btn('btn-catastrophe').addEventListener('click', () => {
    input.queueCatastrophe(rngPick(rng, CATASTROPHE_KINDS));
  });

  // ── Click canvas to add food at cursor ───────────────────────────────────
  const canvas = document.getElementById('tank-canvas') as HTMLCanvasElement;
  canvas.addEventListener('click', (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    input.queueAddFood(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      5,
    );
  });
};
```

---

### 3. HUD (`src/ui/HUD.ts`)

```ts
import type { LoopStats } from '@/tank/SimulationLoop';

export class HUD {
  private readonly elCreatures: HTMLElement;
  private readonly elParticles: HTMLElement;
  private readonly elFps:       HTMLElement;

  constructor() {
    this.elCreatures = this.required('hud-creatures');
    this.elParticles = this.required('hud-particles');
    this.elFps       = this.required('hud-fps');
  }

  update(stats: Readonly<LoopStats>): void {
    this.elCreatures.textContent = `creatures: ${stats.creatureCount}`;
    this.elParticles.textContent = `particles: ${stats.particleCount}`;
    this.elFps.textContent       = `fps: ${stats.fps}`;
  }

  private required(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`HUD element #${id} not found`);
    return el;
  }
}
```

---

## Event Flow Diagram

```
User clicks button
      │
      ▼
controls.ts handler
      │
      ▼
InputSystem.queue.push(payload)          ← DOM thread
      │
      │   (RAF fires next frame)
      ▼
SimulationLoop.loop()
      │
      ▼
InputSystem.flush(tank)                  ← simulation thread (RAF)
      │
      ▼
tank.events.emit(TankEvent)
      │
      ▼
Subscribed handlers in each system
(AddFood handler, ShakeTank handler, etc.)
```

The queue is the **synchronisation boundary** between the user's click (which
can fire at any point in wall time) and the simulation's fixed timestep.

---

## Acceptance Criteria

- [ ] All 5 buttons trigger the correct `TankEvent` type in `tank.events`
- [ ] Clicking the canvas spawns food at cursor world position
- [ ] `InputSystem.flush` clears the queue after draining
- [ ] HUD updates every frame with correct counts
- [ ] No direct DOM manipulation in any module outside `src/ui/` and `src/systems/InputSystem.ts`
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **Food at click position** — canvas click adds food at the exact cursor
  position rather than the top of the tank. This direct feedback loop is the
  most satisfying single interaction in the demo.
- **Random catastrophe kind** — the user doesn't pick which catastrophe occurs;
  the RNG chooses. This preserves the emergent surprise quality.
- **No debounce on buttons** — the simulation naturally rate-limits effects
  (e.g., lightIntensity doesn't stack beyond 1.0; shake force is additive but
  decays fast). Debouncing would reduce interactivity.
