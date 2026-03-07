/** 2-D vector type and free-function library.
 *  Vec2 is a plain object — no class, no heap allocation beyond the literal. */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

// ── Construction ──────────────────────────────────────────────────────────────

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });
export const vec2Zero = (): Vec2 => ({ x: 0, y: 0 });
export const vec2Clone = (v: Readonly<Vec2>): Vec2 => ({ x: v.x, y: v.y });

// ── Arithmetic ────────────────────────────────────────────────────────────────

export const vec2Add = (a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

export const vec2Sub = (a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});

export const vec2Scale = (v: Readonly<Vec2>, s: number): Vec2 => ({
  x: v.x * s,
  y: v.y * s,
});

// ── Measurement ─────────────────────────────────────────────────────────────

export const vec2LenSq = (v: Readonly<Vec2>): number => v.x * v.x + v.y * v.y;

export const vec2Len = (v: Readonly<Vec2>): number => Math.sqrt(vec2LenSq(v));

export const vec2Dist = (a: Readonly<Vec2>, b: Readonly<Vec2>): number => vec2Len(vec2Sub(b, a));

export const vec2DistSq = (a: Readonly<Vec2>, b: Readonly<Vec2>): number =>
  vec2LenSq(vec2Sub(b, a));

// ── Normalisation ─────────────────────────────────────────────────────────────

export const vec2Normalise = (v: Readonly<Vec2>): Vec2 => {
  const len = vec2Len(v);
  if (len < 1e-9) return vec2Zero();
  return { x: v.x / len, y: v.y / len };
};

/** Return v clamped to length maxLen (no-op if already shorter). */
export const vec2Limit = (v: Readonly<Vec2>, maxLen: number): Vec2 => {
  const lenSq = vec2LenSq(v);
  if (lenSq <= maxLen * maxLen) return vec2Clone(v);
  return vec2Scale(vec2Normalise(v), maxLen);
};
