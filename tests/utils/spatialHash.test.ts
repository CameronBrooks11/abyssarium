import { describe, it, expect } from 'vitest';
import { SpatialHash } from '@/utils/spatialHash';

const makeItem = (x: number, y: number) => ({ position: { x, y }, id: `${x}:${y}` });

describe('SpatialHash', () => {
  it('queryRadius finds items within range', () => {
    const hash = new SpatialHash<ReturnType<typeof makeItem>>(50);
    const close = makeItem(10, 10);
    const far = makeItem(200, 200);
    hash.rebuild([close, far]);
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(10, 10, 60, out);
    expect(out).toContain(close);
    expect(out).not.toContain(far);
  });

  it('rebuild replaces all previous entries', () => {
    const hash = new SpatialHash<ReturnType<typeof makeItem>>(50);
    const a = makeItem(10, 10);
    const b = makeItem(20, 20);
    hash.rebuild([a]);
    hash.rebuild([b]);
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(10, 10, 20, out);
    expect(out).not.toContain(a);
  });

  it('returns empty when nothing inserted', () => {
    const hash = new SpatialHash<ReturnType<typeof makeItem>>(50);
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(0, 0, 100, out);
    expect(out).toHaveLength(0);
  });

  it('clear removes all items', () => {
    const hash = new SpatialHash<ReturnType<typeof makeItem>>(50);
    hash.rebuild([makeItem(10, 10), makeItem(20, 20)]);
    hash.clear();
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(10, 10, 100, out);
    expect(out).toHaveLength(0);
  });

  it('insert adds individual items', () => {
    const hash = new SpatialHash<ReturnType<typeof makeItem>>(50);
    const item = makeItem(25, 25);
    hash.insert(item);
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(25, 25, 10, out);
    expect(out).toContain(item);
  });

  it('handles multiple items in same cell', () => {
    const hash = new SpatialHash<ReturnType<typeof makeItem>>(100);
    const a = makeItem(10, 10);
    const b = makeItem(20, 20);
    hash.rebuild([a, b]);
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(15, 15, 50, out);
    expect(out).toContain(a);
    expect(out).toContain(b);
  });

  it('handles negative coordinates', () => {
    const hash = new SpatialHash<ReturnType<typeof makeItem>>(50);
    const item = makeItem(-40, -40);
    hash.rebuild([item]);
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(-40, -40, 30, out);
    expect(out).toContain(item);
  });

  it('large radius query finds all items', () => {
    const hash = new SpatialHash<ReturnType<typeof makeItem>>(50);
    const items = [makeItem(0, 0), makeItem(100, 100), makeItem(200, 200)];
    hash.rebuild(items);
    const out: ReturnType<typeof makeItem>[] = [];
    hash.queryRadius(100, 100, 300, out);
    for (const item of items) {
      expect(out).toContain(item);
    }
  });
});
