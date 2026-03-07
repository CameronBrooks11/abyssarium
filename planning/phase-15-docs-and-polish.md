# Phase 15 — Documentation, Tuning & Polish

## Goal

Write user-facing and developer-facing documentation, balance the simulation's
feel through tuning passes, apply visual polish to the renderer, and address
known technical debt identified throughout implementation. This phase transforms
a functional prototype into a project that is genuinely satisfying to use and
easy to maintain.

---

## Sub-tasks

1. Documentation (`docs/`)
2. Simulation tuning
3. Visual polish
4. Technical debt cleanup (flagged items from previous phases)
5. Accessibility & UX micro-improvements

---

## 1. Documentation

### `docs/concept.md`

```markdown
# Abyssarium — Concept

Abyssarium is a browser-based emergent ecosystem toy. A simulated tank of
strange organisms reacts to disturbances, hunts food, forms loose swarms, and
slowly evolves into chaos if left alone.

## The Tank

All creatures share a fluid simulation layer — a lightweight 2D velocity field
that diffuses and decays over time. Creatures push through this fluid; events
like Shake Tank and Catastrophe inject turbulence into it.

## Interact

| Button | Key | Effect |
|---|---|---|
| Add Food | `F` | Drops food at the top of the tank |
| Shake Tank | `S` | Turbulence hits everything |
| Light Pulse | `L` | Flash — some creatures hide, others glow |
| Spawn Creature | `N` | A new species enters the tank |
| Catastrophe | `C` | Random chaos event |

Click anywhere on the tank to drop food at that position.

## Observation

Watch for:
- Swarms forming around food clouds
- Predators pursuing smaller creatures
- Photophobic creatures scattering on light pulse
- Bubble storms from oxygen catastrophe
```

---

### `docs/ecosystem.md`

````markdown
# Abyssarium — Ecosystem Model

## Creatures

Every creature is procedurally generated with a random **archetype**:

| Archetype | Behaviour | Visual |
|---|---|---|
| Predator | Fast, aggressive, carnivorous | Red/magenta triangle |
| Drifter | Slow, glowing, photophobic | Blue/teal blob |
| Grazer | Curious, herbivorous, flocking | Green/cyan star |
| Swarmer | Medium speed, highly social | Purple/violet orb |

## Energy Loop

```
Creatures drain energy constantly.
Food restores energy.
Starved creatures enter the dying state and dissolve to debris.
Debris fades out as particles.
```

## Body Plans

| Plan | Appearance | Notes |
|---|---|---|
| Blob | Pulsing bezier oval | Default |
| Triangle | Pointed dart shape | Predators favour this |
| Star | Multi-armed radial | Grazers, spiney |
| Worm | Segmented chain | Sinuous, slow |
| Orb | Orbiting ball cluster | Swarmers |

## Catastrophes

Four random disasters can strike:

1. **Predator Spawn** — One or two apex predators enter from the top.
2. **Toxic Bloom** — A chemical event halves all creature energy and spawns
   strange green food.
3. **Freezing Shock** — All motion stops suddenly. Creatures recover slowly.
4. **Oxygen Storm** — A mass bubble eruption flings everyone upward.
````

---

### `README.md` (project root)

````markdown
# Abyssarium

> A chaotic procedural aquarium where strange creatures evolve, swarm, and
> react to disturbances in a simulated fluid tank.

## Demo

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Controls

Click the toolbar buttons or use keyboard shortcuts:

| Key | Action |
|-----|--------|
| `F` | Add Food |
| `S` | Shake Tank |
| `L` | Light Pulse |
| `N` | Spawn Creature |
| `C` | Catastrophe |

## Stack

- TypeScript
- Vite
- HTML Canvas 2D
- Vitest

No runtime dependencies — everything is hand-written.

## Project Structure

```
src/
  main.ts               ← Bootstrap
  tank/                 ← Tank aggregate, fluid sim, loop
  creatures/            ← Creature model, factory, behaviors
  particles/            ← Food, bubbles, debris
  systems/              ← Physics, renderer, behaviors, input
  ui/                   ← DOM controls, HUD
  utils/                ← Math, vec2, color, rng, spatial hash
  types/                ← Shared interfaces, event types
tests/                  ← Vitest unit tests
docs/                   ← Concept + ecosystem documentation
planning/               ← Phase-by-phase engineering plans
```

## Scripts

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview production build
npm run test      # Run Vitest unit tests
```
````

---

## 2. Simulation Tuning

These values were identified as needing real-world playtest tuning. They live
in named constant blocks in their respective modules for easy adjustment.

### `BehaviorSystem.ts` — Behavior Weights

```ts
const W = {
  wander:   1.0,    // baseline wander strength
  seekFood: 2.5,    // hunger multiplier makes this go up to 7.5 at max hunger
  avoid:    3.0,    // flee is stronger than seek — survival first
  boids:    1.2,    // moderate flocking
  fluid:    0.6,    // gentle current coupling
};
```

**Tuning targets:**
- Creatures should spend ≥ 50% of time wandering when not hungry
- Hungry creatures (hunger > 0.7) should visibly converge on food within 3 seconds
- Predators should catch ≥ 1 prey per 30 seconds of observation

### `Creature.ts` — Energy Economics

```ts
const basemetaRate = 1.2;  // energy/second baseline drain
// speedCost is traits.speed / 300 * 2.5
```

**Tuning targets:**
- A creature at rest should survive ~58s (70 energy ÷ 1.2/s)
- Eating 1 food particle (+18 energy) should extend life by ~15s
- A fast predator should be noticeably hungrier than a drifter

### `PhysicsSystem.ts` — Physics Config

```ts
const defaultPhysicsConfig = (): PhysicsConfig => ({
  gravity:       40,
  globalDrag:    0.02,
  buoyancy:      38,    // net downward = 2 px/s² — very slight sinking
  boundaryForce: 800,
  bounds: { width: 800, height: 600 },
});
```

**Tuning targets:**
- Creatures should drift visibly but not constantly sink to the floor
- Boundary repulsion should feel like glass walls, not teleportation
- After `ShakeTank`, the tank should settle within ~4 seconds

---

## 3. Visual Polish

### 3a. Canvas DPI Scaling

Add `devicePixelRatio` support for sharp rendering on retina displays:

```ts
// In Renderer constructor and resize:
const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
canvas.width  = width  * dpr;
canvas.height = height * dpr;
ctx.scale(dpr, dpr);
```

### 3b. Creature Death Animation

The dying state has `dyingTimer` but the renderer needs to use it.
In `drawCreature.ts`, the `globalAlpha` parameter already encodes this.
Enhance with a scale-down effect:

```ts
// In drawCreature, when dyingAlpha < 1:
const deathScale = 0.6 + dyingAlpha * 0.4;
ctx.scale(deathScale, deathScale);
```

### 3c. Food Particle Glow

Wrap hot food particles in a tiny radial glow (offscreen glow layer
inclusion) — creatures actively targeting food should illuminate it.
Add a `glow` kind flag to particles returned by `spawnFood` when
`life > 15s` to make fresh drops shimmer.

### 3d. Bioluminescence Trail

For highly glowing creatures (`glowIntensity > 0.6`), draw a faint
position-stamped trail of 3 fading circles at `prevPosition` to give
a motion blur effect.

```ts
// In drawCreature, before main body draw:
if (creature.glowIntensity > 0.6) {
  const trailAlpha = creature.glowIntensity * 0.15;
  ctx.beginPath();
  ctx.arc(0, 0, creature.radius * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${base.h},${base.s}%,${base.l}%,${trailAlpha})`;
  ctx.fill();
}
```

### 3e. Fluid Visualisation (debug/optional)

Add an optional fluid velocity field overlay toggled by pressing `V`:

```ts
// Toggle: tank.showFluid = !tank.showFluid
// In drawBackground or a separate overlay pass:
if (tank.showFluid) {
  for each fluid cell:
    draw tiny arrow in cell centre using velocity magnitude
}
```

---

## 4. Technical Debt Cleanup

Items flagged `// Phase 15 clean-up` during implementation:

| Item | File | Resolution |
|---|---|---|
| Predator spawn trait override via `as any` | `InteractionHandlers.ts` | Add `overrides?: Partial<CreatureTraits>` to `CreatureFactory.create()` |
| `feed(-30)` toxic drain pattern | `InteractionHandlers.ts` | Add `Creature.drain(amount: number)` method |
| `Particle.color` mutable cast for toxic food | `InteractionHandlers.ts` | Add optional `colorOverride` param to spawn functions |
| `(creature.traits as any).aggression` | `InteractionHandlers.ts` | See overrides param above |
| `OffscreenCanvas` fallback for Safari < 16.4 | `Renderer.ts` | Feature-detect; fall back to hidden `<canvas>` element |

---

## 5. UX Micro-improvements

- **Button press feedback** — add a CSS `active` class that briefly scales the
  button down on click (CSS only, no JS):

```css
#toolbar button:active {
  transform: scale(0.94);
  background: rgba(0,100,200,0.8);
}
```

- **Creature tooltip on hover** — track mouse position, query nearest creature,
  show species name + stats in a small floating div. Cancel with mouseleave.

- **Catastrophe naming** — flash the catastrophe kind name in the HUD for 2
  seconds after it triggers (e.g., `"⚡ Freezing Shock"`).

---

## Acceptance Criteria

- [ ] `docs/concept.md` and `docs/ecosystem.md` exist and are accurate
- [ ] `README.md` has correct install, run, and script instructions
- [ ] Canvas is sharp on 2× DPI displays after DPI scaling patch
- [ ] Dying creatures visually scale down during the 1.2s dissolve
- [ ] All `// Phase 15 clean-up` items are resolved
- [ ] Button hover/active CSS states are visible
- [ ] `npm run test` still passes after all changes
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **Tuning constants as named blocks** — every magic number in the simulation
  should have a named constant with a comment describing units. If it doesn't,
  it gets a name in this phase.
- **DPR capped at 2** — rendering at 3× on a modern phone screen is unnecessary
  and kills performance. Cap at 2.
- **Creature tooltip is held off** — tooltip requires DOM overlay, mouse tracking,
  and nearest-creature query. It is coded in this phase but gated behind
  `'tooltip' in window.location.search` for easy toggle.
