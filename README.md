# Abyssarium

> A chaotic procedural aquarium where strange creatures evolve, swarm, and
> react to disturbances in a simulated fluid tank.

## Demo

```bash
npm install
npm run dev
```

Open <http://localhost:5173>

## Controls

Click the toolbar buttons or use keyboard shortcuts:

| Key | Action |
|-----|--------|
| `F` | Add Food |
| `S` | Shake Tank |
| `L` | Light Pulse |
| `N` | Spawn Creature |
| `C` | Catastrophe |

Click anywhere on the tank canvas to drop food at that position.

## Stack

- TypeScript 5.4 (strict mode, `exactOptionalPropertyTypes`)
- Vite 7
- HTML Canvas 2D
- Vitest 3

No runtime dependencies — physics, fluid simulation, PRNG, and spatial hashing
are all hand-written.

## Project Structure

```
src/
  main.ts               ← Bootstrap — wires all systems together
  tank/                 ← Tank aggregate root, fluid sim, fixed-step loop
  creatures/            ← Creature model, factory, behavior modules
  particles/            ← Food, bubbles, debris
  systems/              ← Physics, renderer, behavior system, input queue
  ui/                   ← DOM controls binding, HUD stats display
  utils/                ← Math, vec2, color, rng, spatial hash, steering
  types/                ← Shared interfaces, branded IDs, event types
tests/                  ← Vitest unit tests (194 tests, 14 files)
docs/                   ← Concept and ecosystem documentation
planning/               ← Phase-by-phase engineering plans
```

## Scripts

```bash
npm run dev           # Start Vite dev server
npm run build         # TypeScript check + Vite production build
npm run preview       # Preview production build
npm run test          # Run Vitest unit tests (vitest run)
npm run format        # Prettier --write
npm run format:check  # Prettier --check
```

## Documentation

- [docs/concept.md](docs/concept.md) — What Abyssarium is and how to interact
- [docs/ecosystem.md](docs/ecosystem.md) — Creature archetypes, energy loop, catastrophes
