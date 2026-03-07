/** Deterministic seeded PRNG and distribution helpers.
 *
 *  Algorithm: Mulberry32 — fast, 32-bit, excellent statistical distribution.
 *  A seeded RNG is crucial for reproducible creature generation and tests. */

export type Rng = () => number;

/** Create a seeded PRNG returning values in [0, 1). */
export const createRng = (seed: number): Rng => {
  let s = seed >>> 0;
  return (): number => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform float in [min, max). */
export const rngFloat = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

/** Uniform integer in [min, max] (inclusive). */
export const rngInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

/** Pick one item from a non-empty array uniformly at random. */
export const rngPick = <T>(rng: Rng, items: readonly T[]): T => {
  if (items.length === 0) throw new RangeError('rngPick: empty array');
  return items[Math.floor(rng() * items.length)]!;
};

/** Return true with probability p ∈ [0, 1]. */
export const rngChance = (rng: Rng, p: number): boolean => rng() < p;

/** Gaussian (normal) distribution via Box-Muller transform. */
export const rngGaussian = (rng: Rng, mean = 0, stddev = 1): number => {
  const u1 = Math.max(1e-12, rng()); // guard against log(0)
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
};
