import { rng, between } from './hash';
import type { Song } from './song';
import { dropSeedFor } from './song';

export interface NoteEvent {
  pegId: number;
  t: number;      // impact time, seconds
  tGrid: number;  // quantized to 16th grid, seconds
  midi: number;
  vel: number;    // 0..1 impact strength
  x: number;
  y: number;
}

export interface Sample {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface DropResult {
  events: NoteEvent[];
  samples: Sample[];
  duration: number;
  basin: number; // which pocket it landed in
}

const DT = 1 / 240;
const GRAVITY = 3.0;
const REST = 0.6;      // peg restitution
const WALL_REST = 0.5;
const MAX_T = 4.2;

// Fixed-timestep marble sim. Only + - * / and sqrt in the loop: IEEE-exact ops,
// so the same seed produces the same song on the same engine.
export function simulate(song: Song, take: number): DropResult {
  const { board } = song;
  const r = rng(dropSeedFor(song.seed, take));

  const pegs = board.pegs;
  const mr = board.marbleR;
  let x = board.entryX + between(r, -0.01, 0.01);
  let y = 0.03;
  let vx = between(r, -0.03, 0.03);
  let vy = 0.12;

  // per-peg tangential personality: seeded kick so pegs feel different
  const kick = new Float64Array(pegs.length);
  for (const p of pegs) kick[p.id] = between(r, -0.09, 0.09);

  const events: NoteEvent[] = [];
  const samples: Sample[] = [];
  const lastHit = new Float64Array(pegs.length).fill(-1);

  const step = 60 / song.bpm / 4; // 16th grid
  let t = 0;
  let settled = false;
  let gridCursor = -1;
  let stillFor = 0;

  while (t < MAX_T && !settled) {
    vy += GRAVITY * DT;
    // mild air drag keeps energy bounded
    vx *= 1 - 0.012 * DT;
    vy *= 1 - 0.02 * DT;
    x += vx * DT;
    y += vy * DT;

    // stuck failsafe: if the marble is barely moving for a stretch,
    // give it a deterministic nudge toward the nearest gap
    if (vx * vx + vy * vy < 0.0006) {
      stillFor += DT;
      if (stillFor > 0.3) {
        vx += (kick[Math.floor((x * pegs.length)) % pegs.length] >= 0 ? 1 : -1) * 0.35;
        vy += 0.1;
        stillFor = 0;
      }
    } else {
      stillFor = 0;
    }

    // walls
    if (x < mr) { x = mr; vx = -vx * WALL_REST; }
    else if (x > 1 - mr) { x = 1 - mr; vx = -vx * WALL_REST; }

    // pegs
    for (let i = 0; i < pegs.length; i++) {
      const p = pegs[i];
      const dx = x - p.x;
      const dy = y - p.y;
      const rr = mr + p.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 1e-12) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        // push out along normal
        x = p.x + nx * rr;
        y = p.y + ny * rr;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          vx -= (1 + REST) * vn * nx;
          vy -= (1 + REST) * vn * ny;
          // tangential personality kick
          const k = kick[i] * Math.min(1, -vn * 2.4);
          vx += -ny * k;
          vy += nx * k;
          if (t - lastHit[i] > 0.11 && -vn > 0.1) {
            lastHit[i] = t;
            const gi = Math.max(gridCursor, Math.round(t / step));
            gridCursor = gi;
            events.push({
              pegId: p.id, t, tGrid: gi * step,
              midi: p.midi, vel: Math.min(1, -vn / 1.8),
              x: p.x, y: p.y,
            });
          }
        }
      }
    }

    // floor: basin pockets slow it
    if (y > 0.97) {
      y = 0.97;
      vy = -vy * 0.22;
      vx *= 0.75;
      if (Math.abs(vy) < 0.06 && Math.abs(vx) < 0.07) {
        vy = 0;
        settled = true;
      }
    }

    if (Math.round(t / DT) % 4 === 0) samples.push({ t, x, y, vx, vy });
    t += DT;
  }
  samples.push({ t, x, y, vx, vy });

  const basinW = 1 / board.basinCount;
  const basin = Math.min(board.basinCount - 1, Math.floor(x / basinW));

  // The landing is the last note: a deep tonic resolves the melody.
  const landGrid = Math.max(gridCursor + 1, Math.round(t / step));
  events.push({
    pegId: -1, t, tGrid: landGrid * step,
    midi: song.rootMidi - 12, vel: 0.9,
    x, y: 0.97,
  });

  return { events, samples, duration: t, basin };
}
