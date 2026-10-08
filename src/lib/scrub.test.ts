import { describe, expect, it } from 'vitest';
import {
  gestureDown,
  gestureFinish,
  gestureLost,
  gestureMove,
  melodyProgress,
  scrollForProgress,
} from './scrub';

const rail = { left: 0, width: 200, scrollWidth: 350, clientWidth: 200 };

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

describe('scrub gesture', () => {
  it('keeps a diagonal drag in scrub and reaches the end of a 175% tape', () => {
    let g = gestureDown(1, 0, 20, 'tape', rail);
    g = gestureMove(g, 40, 55, rail);
    expect(g.kind).toBe('scrub');
    g = gestureMove(g, 200, 90, rail);
    expect(g).toMatchObject({ kind: 'scrub', progress: 1, scrollLeft: 150 });
  });

  it('plays replay on a short press and scrubs once the finger leaves the key', () => {
    let tap = gestureDown(1, 10, 10, 'replay', rail);
    tap = gestureMove(tap, 16, 12, rail);
    const tapped = gestureFinish(tap, 'up');
    expect(tapped.replay).toBe(true);
    expect(tapped.gesture.kind).toBe('idle');

    let drag = gestureDown(1, 10, 10, 'replay', rail);
    drag = gestureMove(drag, 18, 10, rail);
    expect(drag).toMatchObject({ kind: 'scrub', progress: 18 / 200 });
    expect(gestureFinish(drag, 'up').replay).toBe(false);
  });

  it('ends on cancel, and on a lost capture only when this element no longer holds the pointer', () => {
    let g = gestureDown(1, 0, 10, 'tape', rail);
    g = gestureMove(g, 150, 40, rail);
    const cancelled = gestureFinish(g, 'cancel');
    expect(cancelled.replay).toBe(false);
    expect(cancelled.gesture.kind).toBe('idle');
    expect(gestureMove(cancelled.gesture, 200, 40, rail).kind).toBe('idle');

    const aborted = gestureFinish(gestureDown(1, 10, 10, 'replay', rail), 'cancel');
    expect(aborted.replay).toBe(false);

    let held = gestureDown(2, 0, 10, 'tape', rail);
    held = gestureLost(held, 2, true);
    expect(held.kind).toBe('scrub');
    held = gestureLost(held, 9, false);
    expect(held.kind).toBe('scrub');
    held = gestureLost(held, 2, false);
    expect(held.kind).toBe('idle');
  });

  it('rings only the pressed dot until the finger moves 8px', () => {
    let g = gestureDown(1, 40, 20, 'dot', rail);
    g = gestureMove(g, 47, 20, rail);
    expect(g.kind).toBe('dot');
    g = gestureMove(g, 48, 20, rail);
    expect(g).toMatchObject({ kind: 'scrub', progress: 48 / 200 });
  });
});
