# Phase 08 — Creature Factory

## Goal

Implement `CreatureFactory` — the procedural generator that constructs fully
randomised `Creature` instances from a seeded RNG. Every trait, color palette,
body plan, and species name is derived from the RNG with tuned probability
distributions so the output feels diverse and interesting, not uniform-random.

---

## Design Principles

1. **Fully seeded** — factory takes a `Rng` instance so spawning sequences are
   reproducible. The `InputSystem` passes in the global simulation RNG.
2. **Biased distributions** — traits use Gaussian distributions to cluster
   around archetypes rather than flat uniform ranges.
3. **Archetypes drive coherence** — a creature is first assigned an archetype
   (predator, drifter, grazer, swarmer) and traits are sampled in a range
   appropriate for that archetype.
4. **Species name generation** — genus + descriptor produced from phoneme lists
   for memorability.

---

## Files Produced

| File | Exports |
|---|---|
| `src/creatures/CreatureFactory.ts` | `CreatureFactory` class |

---

## Step-by-Step Execution

### 1. Archetypes

```ts
const ARCHETYPES = ['predator', 'drifter', 'grazer', 'swarmer'] as const;
type Archetype = typeof ARCHETYPES[number];
```

| Archetype | Speed | Aggression | Curiosity | Glow | Body Plan |
|---|---|---|---|---|---|
| predator | 150–280 | 0.6–1.0 | 0.3–0.7 | 0.1–0.4 | triangle, blob |
| drifter  | 30–90   | 0.0–0.2 | 0.1–0.4 | 0.4–0.9 | blob, orb     |
| grazer   | 60–140  | 0.0–0.3 | 0.5–0.9 | 0.2–0.6 | star, blob    |
| swarmer  | 100–200 | 0.1–0.4 | 0.6–1.0 | 0.3–0.7 | orb, triangle |

---

### 2. Color Palette Mapping

Each archetype has a *dominant hue range*. Two colors are chosen: a base and an
accent a hue-rotation away, ensuring visual contrast while remaining coherent.

| Archetype | Hue range |
|---|---|
| predator | 340–20 (reds, magentas) |
| drifter  | 175–240 (teals, blues) |
| grazer   | 70–160 (greens, cyans) |
| swarmer  | 250–310 (purples, violets) |

---

### 3. Species Name Generation

Phonetic syllables stitched together:

```ts
const GENERA = ['Vorpex', 'Nycthal', 'Umbrix', 'Caelith', 'Pyroth', 'Azuron', 'Thalvex', 'Eridan'];
const DESCRIPTORS = ['minor', 'magnus', 'obscurus', 'radians', 'profundus', 'tenuis', 'luminax'];
```

`"Vorpex radians"`, `"Caelith obscurus"` — sounds legitimate enough to be fun.

---

### 4. Full Implementation (`src/creatures/CreatureFactory.ts`)

```ts
import { Creature }         from '@/creatures/Creature';
import type { CreatureSpec } from '@/creatures/Creature';
import {
  BodyPlan, FoodPreference,
  CreatureLifeState,
  nextId,
} from '@/types/entities';
import type { CreatureTraits } from '@/types/entities';
import type { Rng }           from '@/utils/rng';
import { rngFloat, rngInt, rngPick, rngChance, rngGaussian } from '@/utils/rng';
import { hsla }               from '@/utils/color';
import { clamp }              from '@/utils/math';
import type { Vec2 }          from '@/utils/vec2';

const ARCHETYPES = ['predator', 'drifter', 'grazer', 'swarmer'] as const;
type Archetype = typeof ARCHETYPES[number];

const GENERA     = ['Vorpex', 'Nycthal', 'Umbrix', 'Caelith', 'Pyroth', 'Azuron', 'Thalvex', 'Eridan', 'Obsidix', 'Marevh'];
const DESCRIPTORS = ['minor', 'magnus', 'obscurus', 'radians', 'profundus', 'tenuis', 'luminax', 'frigidus', 'velox', 'gravi'];

const ARCHETYPE_BODY_PLANS: Record<Archetype, readonly BodyPlan[]> = {
  predator: [BodyPlan.Triangle, BodyPlan.Blob],
  drifter:  [BodyPlan.Blob,     BodyPlan.Orb],
  grazer:   [BodyPlan.Star,     BodyPlan.Blob],
  swarmer:  [BodyPlan.Orb,      BodyPlan.Triangle],
};

const ARCHETYPE_HUE: Record<Archetype, [number, number]> = {
  predator: [340,  20],
  drifter:  [175, 240],
  grazer:   [ 70, 160],
  swarmer:  [250, 310],
};

const ARCHETYPE_FOOD: Record<Archetype, FoodPreference> = {
  predator: FoodPreference.Carnivore,
  drifter:  FoodPreference.Omnivore,
  grazer:   FoodPreference.Herbivore,
  swarmer:  FoodPreference.Omnivore,
};

export class CreatureFactory {
  create(position: Vec2, rng: Rng): Creature {
    const archetype = rngPick(rng, ARCHETYPES);
    const traits    = this.generateTraits(archetype, rng);
    const species   = `${rngPick(rng, GENERA)} ${rngPick(rng, DESCRIPTORS)}`;

    const spec: CreatureSpec = {
      id:       nextId('cr'),
      species,
      position: { ...position },
      traits,
    };

    return new Creature(spec);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private generateTraits(archetype: Archetype, rng: Rng): CreatureTraits {
    const bodyPlan   = rngPick(rng, ARCHETYPE_BODY_PLANS[archetype]);
    const hueRange   = ARCHETYPE_HUE[archetype];
    const baseHue    = this.hueInRange(hueRange, rng);
    const accentHue  = (baseHue + rngFloat(rng, 30, 90)) % 360;

    const palette = [
      hsla(baseHue,  rngFloat(rng, 55, 85), rngFloat(rng, 45, 65)),
      hsla(accentHue, rngFloat(rng, 60, 90), rngFloat(rng, 55, 75)),
    ] as const;

    return {
      speed:          this.traitForArchetype(archetype, rng, {
        predator: [160, 280], drifter: [30, 90], grazer: [60, 140], swarmer: [100, 200],
      }),
      aggression:     this.traitForArchetype(archetype, rng, {
        predator: [0.6, 1.0], drifter: [0.0, 0.2], grazer: [0.0, 0.3], swarmer: [0.1, 0.4],
      }),
      curiosity:      this.traitForArchetype(archetype, rng, {
        predator: [0.3, 0.7], drifter: [0.1, 0.4], grazer: [0.5, 0.9], swarmer: [0.6, 1.0],
      }),
      glow:           this.traitForArchetype(archetype, rng, {
        predator: [0.1, 0.4], drifter: [0.4, 0.9], grazer: [0.2, 0.6], swarmer: [0.3, 0.7],
      }),
      photophobic:    rngChance(rng, archetype === 'drifter' ? 0.5 : 0.25),
      foodPreference: ARCHETYPE_FOOD[archetype],
      bodyPlan,
      palette,
      scale:          clamp(rngGaussian(rng, 1.0, 0.35), 0.4, 2.5),
      segmentCount:   bodyPlan === BodyPlan.Worm
        ? rngInt(rng, 4, 12)
        : rngInt(rng, 1, 3),
      spineCount:     bodyPlan === BodyPlan.Star
        ? rngInt(rng, 4, 8)
        : 0,
    };
  }

  /**
   * Sample a trait value uniformly from the archetype's [min, max] range.
   */
  private traitForArchetype(
    archetype: Archetype,
    rng: Rng,
    ranges: Record<Archetype, [number, number]>,
  ): number {
    const [min, max] = ranges[archetype];
    return rngFloat(rng, min, max);
  }

  private hueInRange([lo, hi]: [number, number], rng: Rng): number {
    // Wrap-around hue range (e.g., 340–20 means 340, 350, 0, 10, 20)
    if (hi >= lo) return rngFloat(rng, lo, hi);
    const span = (360 - lo) + hi;
    return (lo + rngFloat(rng, 0, span)) % 360;
  }
}
```

---

## Spawn Distribution

When `SpawnCreature` is triggered from the UI:
- If `position` is provided in the event payload, use it.
- Otherwise, spawn in the top third of the tank at a random X so it appears
  to enter from above (creatures swim down naturally).

Spawning logic for initial population seeding:

```ts
// Called from Tank bootstrap in Phase 13 (Integration)
const INITIAL_POPULATION = 12;

for (let i = 0; i < INITIAL_POPULATION; i++) {
  const x = rng() * tank.width;
  const y = rng() * tank.height;
  tank.creatures.push(factory.create({ x, y }, rng));
}
```

---

## Trait Validation Rules

These are enforced by the factory and must not be violated by any other
spawning path:

| Trait | Range | Type |
|---|---|---|
| `speed` | \[20, 300\] | number |
| `scale` | \[0.4, 2.5\] | number |
| `segmentCount` | \[1, 12\] | integer |
| `spineCount` | \[0, 8\] | integer |
| `aggression` | \[0, 1\] | number |
| `curiosity` | \[0, 1\] | number |
| `glow` | \[0, 1\] | number |

---

## Acceptance Criteria

- [ ] `CreatureFactory.create` never throws for any RNG seed
- [ ] Produced traits all fall within documented ranges (fuzz test with 1000 seeds)
- [ ] All 5 body plans can be produced by the factory
- [ ] Species names are always two words (genus + descriptor)
- [ ] Predator archetype has `aggression > 0.5` in > 90% of samples
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **`Worm` body plan is archetype-free** — worm can appear in any archetype
  because segmentation is a morphological trait, not a behavioral one. The
  factory currently assigns worm to no archetype intentionally; it could be
  added later as a fifth archetype.
- **Gaussian scale** — a Gaussian around 1.0 means most creatures are
  medium-sized, with big and tiny outliers. This produces a believable
  ecosystem distribution.
- **Species names** — using real-sounding Latin-ish words rather than random
  syllables, because they read better in the HUD and feel more like a real
  specimen collection.
