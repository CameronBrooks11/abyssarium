/** HSLA color type and helpers.
 *  Procedural color generation is far more ergonomic in HSL space than RGBA:
 *  hue sweeps, saturation control, and lightness variation map well to biome
 *  and creature palette logic. */

export interface HSLA {
  readonly h: number; // [0, 360)
  readonly s: number; // [0, 100]
  readonly l: number; // [0, 100]
  readonly a: number; // [0, 1]
}

export const hsla = (h: number, s: number, l: number, a = 1): HSLA => ({ h, s, l, a });

export const hslaToString = (c: Readonly<HSLA>): string =>
  `hsla(${c.h.toFixed(1)},${c.s.toFixed(1)}%,${c.l.toFixed(1)}%,${c.a.toFixed(3)})`;

/** Interpolate hue taking the short path around the circle. */
const hueDiff = (from: number, to: number): number => {
  let d = to - from;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

export const hslaLerp = (a: Readonly<HSLA>, b: Readonly<HSLA>, t: number): HSLA => ({
  h: a.h + hueDiff(a.h, b.h) * t,
  s: a.s + (b.s - a.s) * t,
  l: a.l + (b.l - a.l) * t,
  a: a.a + (b.a - a.a) * t,
});

export const hslaWithAlpha = (c: Readonly<HSLA>, a: number): HSLA => ({ ...c, a });

export const hslaWithLightness = (c: Readonly<HSLA>, l: number): HSLA => ({ ...c, l });
