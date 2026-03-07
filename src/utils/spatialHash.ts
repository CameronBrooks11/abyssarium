/** Generic spatial hash grid for O(1) amortised radius queries.
 *
 *  The grid is rebuilt every frame (clear + re-insert all entries), which is
 *  faster than incremental update for ≤ 200 fast-moving entities due to cache
 *  locality.
 *
 *  Items must expose a `position: Vec2` property via the HasPosition interface. */

import type { Vec2 } from '@/utils/vec2';

export interface HasPosition {
  readonly position: Vec2;
}

export class SpatialHash<T extends HasPosition> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  // ── Mutation ───────────────────────────────────────────────────────────────

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const key = this.keyFor(item.position.x, item.position.y);
    let list = this.cells.get(key);
    if (list === undefined) {
      list = [];
      this.cells.set(key, list);
    }
    list.push(item);
  }

  /** Clear then re-insert every item from the provided array. */
  rebuild(items: readonly T[]): void {
    this.clear();
    for (const item of items) this.insert(item);
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  /**
   * Append to `out` all items in cells that overlap a square centred on
   * (x, y) with half-extent `radius`.  Results may include items slightly
   * outside the circle; callers should do a distance check if precision
   * matters.
   */
  queryRadius(x: number, y: number, radius: number, out: T[]): void {
    const cs = this.cellSize;
    const minCx = Math.floor((x - radius) / cs);
    const maxCx = Math.floor((x + radius) / cs);
    const minCy = Math.floor((y - radius) / cs);
    const maxCy = Math.floor((y + radius) / cs);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const list = this.cells.get(this.hash(cx, cy));
        if (list !== undefined) {
          for (const item of list) out.push(item);
        }
      }
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private keyFor(x: number, y: number): number {
    return this.hash(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
  }

  /**
   * Cantor-like pairing that handles negative cell coordinates.
   * Maps (cx, cy) → a unique non-negative integer.
   */
  private hash(cx: number, cy: number): number {
    const px = cx < 0 ? -2 * cx - 1 : 2 * cx;
    const py = cy < 0 ? -2 * cy - 1 : 2 * cy;
    return ((px + py) * (px + py + 1)) / 2 + py;
  }
}
