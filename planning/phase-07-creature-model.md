# Phase 07 — Creature Model

## Goal

Define the `Creature` class — the primary agent in the simulation. A `Creature`
holds its physics body, traits, behavioral state, energy model, and stores
enough history for smooth interpolated rendering. It does not contain any
behavior *logic* (that is in the `BehaviorSystem`, Phase 09) or rendering logic
(that is in the `Renderer`, Phase 10). It is a pure data container with a
minimal state machine for lifecycle transitions.

---

## Design Principles

1. **Separated data from behaviour** — `Creature` is a data class. Systems
   operate on it from outside. No `creature.draw()`, no `creature.think()`.
2. **Energy model gates all behaviour** — a starving creature cannot chase food
   aggressively at full speed; an energized creature can. Energy is the single
   regulatory variable.
3. **Lifecycle state machine** — `alive → dying → dead`. The `dying` state
   triggers debris emission from `ParticleSystem` and persists for one second
   so the dissolve animation can play.
4. **Segment positions for worms/chains** — creatures with `bodyPlan = 'worm'`
   maintain a `segments` array of positions for sinuous chain rendering.
5. **`prevPosition` for render interpolation** — written each physics tick so
   the renderer can lerp between fixed-step positions.

---

## Files Produced

| File | Exports |
|---|---|
| `src/creatures/Creature.ts` | `Creature` class |

---

## Step-by-Step Execution

### 1. Creature Class (`src/creatures/Creature.ts`)

```ts
import type { Vec2 }             from '@/utils/vec2';
import { vec2Zero, vec2Clone }   from '@/utils/vec2';
import type { HSLA }             from '@/utils/color';
import type {
  CreatureId,
  RigidBody,
  CreatureTraits,
  CreatureLifeState,
} from '@/types/entities';
import { CreatureLifeState as LS } from '@/types/entities';

export interface CreatureSpec {
  id:       CreatureId;
  species:  string;
  position: Vec2;
  traits:   CreatureTraits;
}

export class Creature {
  // ── Identity ───────────────────────────────────────────────────────────────
  readonly id:       CreatureId;
  readonly species:  string;

  // ── Physics ────────────────────────────────────────────────────────────────
  body: RigidBody;
  /** Position at the start of the previous fixed step — for render lerp. */
  prevPosition: Vec2;

  // ── Traits (immutable after creation) ────────────────────────────────────
  readonly traits: CreatureTraits;

  /** Effective radius in pixels derived from traits.scale. */
  get radius(): number {
    return 10 * this.traits.scale;
  }

  // ── Vital stats ───────────────────────────────────────────────────────────
  /**
   * Energy [0, 100]. Drains over time and from movement. Replenishes from food.
   * When energy < 0, creature enters dying state.
   */
  energy:  number = 70;
  hunger:  number = 0;   // [0, 1] — how urgently the creature seeks food

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  lifeState: CreatureLifeState = LS.Alive;
  /** Countdown timer for the dying state (seconds). */
  dyingTimer: number = 0;

  // ── Behavioral state ──────────────────────────────────────────────────────
  /**
   * Current steering angle for wander behaviour.
   * Mutated each frame by the wander steering function.
   */
  wanderAngle: number = 0;

  /**
   * ID of the food particle currently being pursued, or null.
   * Set by BehaviorSystem; cleared when food is consumed or out of range.
   */
  targetFoodId: string | null = null;

  /**
   * ID of the predator/threat currently being fled, or null.
   */
  threatId: string | null = null;

  /**
   * Glow intensity [0, 1]. Normally equals traits.glow, but spikes on
   * light pulse (for photophilic types) or drops (for photophobic).
   */
  glowIntensity: number;

  /**
   * Phase offset for body animation (pulsing, undulation).
   * Initialised randomly so creatures don't all pulse in sync.
   */
  animPhase: number;

  // ── Segment chain (worm/chain body plans) ────────────────────────────────
  /**
   * Positions of body segments for worm-type creatures.
   * segments[0] is the head (= body.position).
   * Length = traits.segmentCount.
   */
  segments: Vec2[];

  // ── Boids / flocking ──────────────────────────────────────────────────────
  /**
   * Rolling average of nearby same-species positions — used for cohesion.
   * Updated by BehaviorSystem.
   */
  flockCenter: Vec2 = vec2Zero();
  flockCount:  number = 0;

  constructor(spec: CreatureSpec) {
    this.id      = spec.id;
    this.species = spec.species;
    this.traits  = spec.traits;

    // Build physics body
    this.body = {
      position:     vec2Clone(spec.position),
      velocity:     vec2Zero(),
      acceleration: vec2Zero(),
      angle:        Math.random() * Math.PI * 2,
      angularVel:   0,
      mass:         0.5 + spec.traits.scale * 1.5,
      drag:         0.04 + (1 / spec.traits.speed) * 0.02,
      angularDrag:  0.4,
    };

    this.prevPosition  = vec2Clone(spec.position);
    this.glowIntensity = spec.traits.glow;
    this.animPhase     = Math.random() * Math.PI * 2;

    // Initialise segment chain
    this.segments = Array.from({ length: spec.traits.segmentCount }, () =>
      vec2Clone(spec.position),
    );
  }

  // ── Public API used by BehaviorSystem & ParticleSystem ───────────────────

  /** Called each physics tick to record position for interpolated rendering. */
  recordPrevPosition(): void {
    this.prevPosition = vec2Clone(this.body.position);
  }

  /**
   * Decrement energy by a per-frame cost and update hunger.
   * @param dt Fixed timestep seconds.
   */
  drainEnergy(dt: number): void {
    const speedCost    = (this.traits.speed / 300) * 2.5;  // faster = hungrier
    const basemetaRate = 1.2;
    this.energy -= (basemetaRate + speedCost) * dt;
    this.hunger  = Math.max(0, Math.min(1, 1 - this.energy / 60));

    if (this.energy <= 0 && this.lifeState === LS.Alive) {
      this.lifeState = LS.Dying;
      this.dyingTimer = 1.2; // seconds for dissolve animation
    }
  }

  /**
   * Feed the creature — increases energy, bounded at 100.
   */
  feed(amount: number): void {
    this.energy = Math.min(100, this.energy + amount);
  }

  /**
   * Progress the dying animation countdown. Returns true when fully dead.
   */
  tickDying(dt: number): boolean {
    if (this.lifeState !== LS.Dying) return false;
    this.dyingTimer -= dt;
    if (this.dyingTimer <= 0) {
      this.lifeState = LS.Dead;
      return true;
    }
    return false;
  }

  /**
   * Update the worm segment chain by pulling each segment toward the previous.
   * @param spacing Target spacing in pixels between segments.
   */
  updateSegments(spacing: number): void {
    if (this.segments.length <= 1) return;
    this.segments[0] = vec2Clone(this.body.position);
    for (let i = 1; i < this.segments.length; i++) {
      const prev    = this.segments[i - 1]!;
      const curr    = this.segments[i]!;
      const dx      = prev.x - curr.x;
      const dy      = prev.y - curr.y;
      const dist    = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull    = Math.max(0, dist - spacing) / dist;
      this.segments[i] = {
        x: curr.x + dx * pull * 0.6,
        y: curr.y + dy * pull * 0.6,
      };
    }
  }
}
```

---

## Creature Lifecycle State Machine

```
          spawn
            │
            ▼
         ┌──────┐
         │ Alive│◄──── feed() increases energy
         └──┬───┘
            │ energy ≤ 0
            ▼
         ┌───────┐
         │ Dying │  dyingTimer counts down (1.2s)
         └──┬────┘  ParticleSystem emits debris each frame
            │ dyingTimer ≤ 0
            ▼
         ┌──────┐
         │ Dead │  Tank.prune() removes from array
         └──────┘
```

---

## Energy Economics

| Event | Energy Change |
|---|---|
| Baseline metabolism (per second) | −1.2 |
| High-speed movement bonus drain | −0 to −2.5 / s (scales with speed trait) |
| Eating one food particle | +18 |
| Aggression attack success | +12 |
| Light pulse (photophobic) | −5 (shock) |

These values are tuning knobs. Final balancing happens in Phase 15 (polish).

---

## Segment Chain Detail

For `bodyPlan === 'worm'`:
- `segments[0]` always mirrors `body.position`
- Each subsequent segment lags behind with a pull factor of 0.6
- `spacing = 8 * traits.scale` is used as input to `updateSegments`
- This produces a natural sinuous following motion

For all other body plans:
- `segments` still has length `traits.segmentCount` but is not used by
  movement — only referenced for rendering (e.g., orb clusters).

---

## Acceptance Criteria

- [ ] `new Creature(spec)` initialises `segments` array of correct length
- [ ] `drainEnergy(dt)` transitions `lifeState` to `Dying` when energy ≤ 0
- [ ] `tickDying(1.2)` transitions `lifeState` to `Dead`
- [ ] `feed(18)` does not allow `energy > 100`
- [ ] `updateSegments` moves each segment toward the previous one
- [ ] `body.mass` scales correctly with `traits.scale`
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **No methods for AI** — `think()`, `update()`, `react()` are not on `Creature`.
  Keeping the class a pure data holder means systems can iterate over
  `Creature[]` without concern for polymorphic dispatch overhead.
- **`animPhase` randomised at construction** — ensures visual diversity
  without any frame-counting logic.
- **`glowIntensity` is mutable** — the renderer reads it; the behavior system
  and light pulse handler mutate it. It naturally decays toward `traits.glow`
  in `BehaviorSystem.update` (Phase 09).
