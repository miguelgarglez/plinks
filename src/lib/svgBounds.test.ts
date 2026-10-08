import { describe, expect, it } from 'vitest';

/** Rough path bounds for the share LINK chain, used to guard viewBox padding. */
function pathRoughBounds(d: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const nums = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  const strokePad = 0.8; // half of strokeWidth 1.6
  return {
    minX: Math.min(...xs) - strokePad,
    maxX: Math.max(...xs) + strokePad,
    minY: Math.min(...ys) - strokePad,
    maxY: Math.max(...ys) + strokePad,
  };
}

describe('share LINK icon viewBox', () => {
  const d =
    'M6.5 9.5l3-3M5 11.5l-1.8 1.8a2.3 2.3 0 1 1-3.2-3.2L3.5 6.5a2.3 2.3 0 0 1 3.2 0M11 4.5l1.8-1.8a2.3 2.3 0 1 1 3.2 3.2L12.5 9.5a2.3 2.3 0 0 1-3.2 0';
  // padded viewBox used in sharecard.tsx
  const vb = { x: -2, y: -2, w: 20, h: 20 };

  it('keeps the chain stroke inside the padded viewBox', () => {
    const b = pathRoughBounds(d);
    expect(b.minX).toBeGreaterThanOrEqual(vb.x);
    expect(b.minY).toBeGreaterThanOrEqual(vb.y);
    expect(b.maxX).toBeLessThanOrEqual(vb.x + vb.w);
    expect(b.maxY).toBeLessThanOrEqual(vb.y + vb.h);
  });
});
