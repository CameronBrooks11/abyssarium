/** CreatureFactory — procedurally generates Creature instances from a seeded RNG.
 *
 *  Every creature is first assigned one of four archetypes (predator, drifter,
 *  grazer, swarmer) which drives trait ranges, palette, and body plan selection.
 *  Gaussian scale distribution ensures most creatures are medium-sized with big
 *  and tiny outliers. */

import { Creature } from '@/creatures/Creature';
import type { CreatureSpec } from '@/creatures/Creature';
import { BodyPlan, FoodPreference, nextId } from '@/types/entities';
import type { CreatureTraits } from '@/types/entities';
import type { Rng } from '@/utils/rng';
import { rngFloat, rngInt, rngPick, rngChance, rngGaussian } from '@/utils/rng';
import { hsla } from '@/utils/color';
import { clamp } from '@/utils/math';
import type { Vec2 } from '@/utils/vec2';

// ── Archetypes ────────────────────────────────────────────────────────────────

const ARCHETYPES = ['predator', 'drifter', 'grazer', 'swarmer'] as const;
type Archetype = (typeof ARCHETYPES)[number];

// ── Species name tables ───────────────────────────────────────────────────────

const GENERA = [
  'Vorpex',
  'Nycthal',
  'Umbrix',
  'Caelith',
  'Pyroth',
  'Azuron',
  'Thalvex',
  'Eridan',
  'Obsidix',
  'Marevh',
];

const DESCRIPTORS = [
  'minor',
  'magnus',
  'obscurus',
  'radians',
  'profundus',
  'tenuis',
  'luminax',
  'frigidus',
  'velox',
  'gravi',
];

// ── Archetype → body plan mapping ─────────────────────────────────────────────

const ARCHETYPE_BODY_PLANS: Record<Archetype, readonly BodyPlan[]> = {
  predator: [BodyPlan.Triangle, BodyPlan.Blob],
  drifter: [BodyPlan.Blob, BodyPlan.Orb],
  grazer: [BodyPlan.Star, BodyPlan.Blob],
  swarmer: [BodyPlan.Orb, BodyPlan.Triangle],
};

// ── Archetype → hue range mapping ─────────────────────────────────────────────

const ARCHETYPE_HUE: Record<Archetype, [number, number]> = {
  predator: [340, 20], // reds / magentas (wraps around 0°)
  drifter: [175, 240], // teals / blues
  grazer: [70, 160], // greens / cyans
  swarmer: [250, 310], // purples / violets
};

// ── Archetype → food preference mapping ──────────────────────────────────────

const ARCHETYPE_FOOD: Record<Archetype, FoodPreference> = {
  predator: FoodPreference.Carnivore,
  drifter: FoodPreference.Omnivore,
  grazer: FoodPreference.Herbivore,
  swarmer: FoodPreference.Omnivore,
};

// ─────────────────────────────────────────────────────────────────────────────

export class CreatureFactory {
  /**
   * Create a fully randomised Creature at the given position.
   * Optional `overrides` are shallow-merged into generated traits after generation,
   * allowing callers (e.g. catastrophe handlers) to force specific values without
   * resorting to `as any` casts on readonly trait properties.
   */
  create(position: Vec2, rng: Rng, overrides?: Partial<CreatureTraits>): Creature {
    const archetype = rngPick(rng, ARCHETYPES);
    const traits = this.generateTraits(archetype, rng);
    const species = `${rngPick(rng, GENERA)} ${rngPick(rng, DESCRIPTORS)}`;

    const mergedTraits: CreatureTraits = overrides ? { ...traits, ...overrides } : traits;

    const spec: CreatureSpec = {
      id: nextId('cr'),
      species,
      position: { ...position },
      traits: mergedTraits,
    };

    return new Creature(spec);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private generateTraits(archetype: Archetype, rng: Rng): CreatureTraits {
    const bodyPlan = rngPick(rng, ARCHETYPE_BODY_PLANS[archetype]);
    const hueRange = ARCHETYPE_HUE[archetype];
    const baseHue = this.hueInRange(hueRange, rng);
    const accentHue = (baseHue + rngFloat(rng, 30, 90)) % 360;

    const palette = [
      hsla(baseHue, rngFloat(rng, 55, 85), rngFloat(rng, 45, 65)),
      hsla(accentHue, rngFloat(rng, 60, 90), rngFloat(rng, 55, 75)),
    ] as const;

    return {
      speed: this.traitForArchetype(archetype, rng, {
        predator: [160, 280],
        drifter: [30, 90],
        grazer: [60, 140],
        swarmer: [100, 200],
      }),
      aggression: this.traitForArchetype(archetype, rng, {
        predator: [0.6, 1.0],
        drifter: [0.0, 0.2],
        grazer: [0.0, 0.3],
        swarmer: [0.1, 0.4],
      }),
      curiosity: this.traitForArchetype(archetype, rng, {
        predator: [0.3, 0.7],
        drifter: [0.1, 0.4],
        grazer: [0.5, 0.9],
        swarmer: [0.6, 1.0],
      }),
      glow: this.traitForArchetype(archetype, rng, {
        predator: [0.1, 0.4],
        drifter: [0.4, 0.9],
        grazer: [0.2, 0.6],
        swarmer: [0.3, 0.7],
      }),
      photophobic: rngChance(rng, archetype === 'drifter' ? 0.5 : 0.25),
      foodPreference: ARCHETYPE_FOOD[archetype],
      bodyPlan,
      palette,
      scale: clamp(rngGaussian(rng, 1.0, 0.35), 0.4, 2.5),
      segmentCount: bodyPlan === BodyPlan.Worm ? rngInt(rng, 4, 12) : rngInt(rng, 1, 3),
      spineCount: bodyPlan === BodyPlan.Star ? rngInt(rng, 4, 8) : 0,
    };
  }

  /** Sample a trait value uniformly from the archetype's [min, max] range. */
  private traitForArchetype(
    archetype: Archetype,
    rng: Rng,
    ranges: Record<Archetype, [number, number]>,
  ): number {
    const [min, max] = ranges[archetype];
    return rngFloat(rng, min, max);
  }

  /** Sample a hue within a potentially wrap-around range (e.g. 340–20 deg). */
  private hueInRange([lo, hi]: [number, number], rng: Rng): number {
    if (hi >= lo) return rngFloat(rng, lo, hi);
    const span = 360 - lo + hi;
    return (lo + rngFloat(rng, 0, span)) % 360;
  }
}
