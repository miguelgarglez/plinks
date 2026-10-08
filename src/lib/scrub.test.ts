import { describe, expect, it } from 'vitest';
import { melodyProgress, scrollForProgress } from './scrub';

describe('scrub mapping', () => {
  it('maps the left edge of the rail to the start of the melody', () => {
    expect(melodyProgress(100, 100, 200)).toBe(0);
  });

  it('maps the right edge of the rail to the end of the melody', () => {
    expect(melodyProgress(300, 100, 200)).toBe(1);
  });

  it('clamps outside the rail', () => {
    expect(melodyProgress(0, 100, 200)).toBe(0);
    expect(melodyProgress(500, 100, 200)).toBe(1);
  });

  it('scrolls an overflowing tape under the finger', () => {
    expect(scrollForProgress(0, 350, 200)).toBe(0);
    expect(scrollForProgress(1, 350, 200)).toBe(150);
    expect(scrollForProgress(0.5, 350, 200)).toBe(75);
  });
});
