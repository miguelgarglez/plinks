import type { Board, Peg } from './song';

// Live garnish physics — the little letter-beads that rain while you type and
// the strum sparkles. Unlike lib/physics.ts this is NOT deterministic: it
// decorates the board in real time and never touches the song contract.

export interface LiveBead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;      // tumble rotation, radians
  letter: string;
  settled: boolean;
  age: number;
  lastHit: Float64Array; // per-peg cooldown, same trick as the main sim
}

const GRAV = 3.0;
const REST = 0.55;
const WALL_REST = 0.45;
export const BEAD_R = 0.016;

export function bead(board: Board, letter: string, seed: number): LiveBead {
  // cheap per-bead jitter from the seed, keeps it engine-determinism-free
  const j = (n: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return ((seed >>> 8) / 16777216 - 0.5) * n;
  };
  return {
    x: Math.min(0.92, Math.max(0.08, board.entryX + j(0.3))),
    y: -0.02,
    vx: j(0.14),
    vy: 0.9 + j(0.2),
    rot: j(2),
    letter,
    settled: false,
    age: 0,
    lastHit: new Float64Array(board.pegs.length).fill(-1),
  };
}

// One fixed step of a live bead. onHit fires (peg, impactSpeed) once per peg
// per 120ms so a resting bead does not machine-gun notes.
export function stepBead(b: LiveBead, board: Board, dt: number, onHit?: (p: Peg, vn: number) => void) {
  if (b.settled) return;
  b.vy += GRAV * dt;
  b.vx *= 1 - 0.015 * dt;
  b.vy *= 1 - 0.02 * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.rot += b.vx * 90 * dt;
  b.age += dt;

  if (b.x < BEAD_R) { b.x = BEAD_R; b.vx = -b.vx * WALL_REST; }
  else if (b.x > 1 - BEAD_R) { b.x = 1 - BEAD_R; b.vx = -b.vx * WALL_REST; }

  for (let i = 0; i < board.pegs.length; i++) {
    const p = board.pegs[i];
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const rr = BEAD_R + p.r;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 1e-12) {
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      b.x = p.x + nx * rr;
      b.y = p.y + ny * rr;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + REST) * vn * nx;
        b.vy -= (1 + REST) * vn * ny;
        if (b.age - b.lastHit[i] > 0.12 && -vn > 0.12) {
          b.lastHit[i] = b.age;
          onHit?.(p, -vn);
        }
      }
    }
  }

  if (b.y > 0.97) {
    b.y = 0.97;
    b.vy = -b.vy * 0.25;
    b.vx *= 0.72;
    if (Math.abs(b.vy) < 0.08 && Math.abs(b.vx) < 0.09) {
      b.vy = 0;
      b.settled = true;
    }
  }
}
