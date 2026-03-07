/** Scalar math helpers. All pure functions — no side effects. */

/** Linear interpolation between a and b by t ∈ [0, 1]. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Clamp n to [min, max]. */
export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));
