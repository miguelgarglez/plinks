/** Map a client X through the visible rail to 0..1 across the whole melody. */
export function melodyProgress(clientX: number, railLeft: number, railWidth: number): number {
  if (railWidth <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - railLeft) / railWidth));
}

/** Scroll offset that places `progress` under the finger on an overflowing tape. */
export function scrollForProgress(progress: number, scrollWidth: number, clientWidth: number): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  return Math.min(1, Math.max(0, progress)) * max;
}

export interface RailBox {
  left: number;
  width: number;
  scrollWidth: number;
  clientWidth: number;
}

export type ScrubHit = 'tape' | 'dot' | 'replay';

export type Gesture =
  | { kind: 'idle' }
  | { kind: 'dot'; pointerId: number; x: number; y: number }
  | { kind: 'replay'; pointerId: number; x: number; y: number }
  | { kind: 'scrub'; pointerId: number; progress: number; scrollLeft: number };

const SLOP_PX = 8;

function passedSlop(x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy >= SLOP_PX * SLOP_PX;
}

function place(clientX: number, rail: RailBox): { progress: number; scrollLeft: number } {
  const progress = melodyProgress(clientX, rail.left, rail.width);
  return { progress, scrollLeft: scrollForProgress(progress, rail.scrollWidth, rail.clientWidth) };
}

export function gestureDown(pointerId: number, x: number, y: number, hit: ScrubHit, rail: RailBox): Gesture {
  if (hit === 'replay') return { kind: 'replay', pointerId, x, y };
  if (hit === 'dot') return { kind: 'dot', pointerId, x, y };
  return { kind: 'scrub', pointerId, ...place(x, rail) };
}

export function gestureMove(g: Gesture, x: number, y: number, rail: RailBox): Gesture {
  if (g.kind === 'idle') return g;
  if (g.kind === 'dot' || g.kind === 'replay') {
    if (!passedSlop(g.x, g.y, x, y)) return g;
  }
  return { kind: 'scrub', pointerId: g.pointerId, ...place(x, rail) };
}

export function gestureFinish(g: Gesture, reason: 'up' | 'cancel'): { gesture: Gesture; replay: boolean } {
  return { gesture: { kind: 'idle' }, replay: reason === 'up' && g.kind === 'replay' };
}

export function gestureLost(g: Gesture, pointerId: number, stillHeld: boolean): Gesture {
  if (g.kind === 'idle' || g.pointerId !== pointerId || stillHeld) return g;
  return { kind: 'idle' };
}
