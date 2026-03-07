/** Scalar math helpers. All pure functions — no side effects. */

/** Linear interpolation between a and b by t ∈ [0, 1]. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Clamp n to [min, max]. */
export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

/** Map n from [inMin, inMax] to [outMin, outMax]. */
export const remap = (
  n: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => outMin + ((n - inMin) / (inMax - inMin)) * (outMax - outMin);

/** Reduce angle to [0, 2π). */
export const wrapAngle = (angle: number): number => {
  const TAU = Math.PI * 2;
  return ((angle % TAU) + TAU) % TAU;
};

/** Shortest angular difference from a to b, in [-π, π]. */
export const angleDiff = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Smooth-step (Hermite) interpolation — 3t² − 2t³. */
export const smoothStep = (t: number): number => t * t * (3 - 2 * t);

/** Perlin-like smooth step — 6t⁵ − 15t⁴ + 10t³. */
export const smootherStep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
