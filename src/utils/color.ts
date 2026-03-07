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

export const hslaWithAlpha = (c: Readonly<HSLA>, a: number): HSLA => ({ ...c, a });
