import { cyrb53, rng, pick, between, intBetween } from './hash';
import { degreeToMidi, type ScaleName, type KitName, SCALE_NAMES, KIT_NAMES } from './music';

export interface Peg {
  id: number;
  row: number;
  col: number;
  x: number;   // board units, 0..1
  y: number;   // board units, 0..1
  r: number;   // collision radius
  midi: number;
  degree: number;
}

export interface Board {
  rows: number;
  pegs: Peg[];
  marbleR: number;
  entryX: number;
  // walls at x=0,1; floor at y=1; basin pockets at floor
  basinCount: number;
}

export interface Song {
  word: string;
  seed: number;
  serial: number;
  kit: KitName;
  scale: ScaleName;
  rootMidi: number;
  bpm: number;
  board: Board;
  epithet: string;
}

export const MAX_WORD_LEN = 24;

export function normalizeWord(w: string): string {
  return w.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9\-']/g, '')
    .slice(0, MAX_WORD_LEN);
}

const EPITHET_A = ['rain on', 'morning light on', 'static over', 'dust on', 'footsteps across', 'wind through', 'sparks off', 'echoes in', 'moths around', 'dawn over', 'salt on', 'rust on'];
const EPITHET_B = ['a tin roof', 'old floorboards', 'a copper wire', 'a lighthouse stair', 'wet pavement', 'a library at closing', 'a bicycle wheel', 'porcelain', 'a cold harbour', 'pine needles', 'a bass string', 'sunday radio'];

export function songFor(raw: string): Song | null {
  const word = normalizeWord(raw);
  if (!word) return null;
  const seed = cyrb53(word);
  const r = rng(seed);

  const scale = pick(r, SCALE_NAMES);
  const kit = pick(r, KIT_NAMES);
  const bpm = intBetween(r, 96, 126);
  const rootMidi = 60 + intBetween(r, -3, 4); // C4-ish
  const serial = 1000 + Math.floor(r() * 8999);

  // Galton geometry: marble diameter is a bit smaller than the gap between
  // adjacent pegs, so it threads through the field but grazes ~1 peg per row.
  const rows = intBetween(r, 9, 11);
  const cols = intBetween(r, 9, 11); // pegs in a full row
  const pegs: Peg[] = [];
  let id = 0;
  const top = 0.15, bottom = 0.86; // peg field
  const margin = 0.055;
  const spanDeg = cols + 3 + intBetween(r, 0, 3); // scale degrees across width
  for (let row = 0; row < rows; row++) {
    const count = row % 2 ? cols - 1 : cols;
    const s = (1 - margin * 2) / (cols - 1); // spacing
    const y = top + (bottom - top) * (row / (rows - 1));
    for (let col = 0; col < count; col++) {
      const x = margin + s * col + (row % 2 ? s / 2 : 0) + between(r, -0.004, 0.004);
      const xn = Math.min(1, Math.max(0, (x - margin) / (1 - margin * 2)));
      // pitch by column: low left → high right
      const degree = Math.round(xn * spanDeg);
      pegs.push({
        id: id++, row, col,
        x, y,
        r: 0.0095,
        midi: degreeToMidi(rootMidi, scale, degree),
        degree,
      });
    }
  }

  const entryX = between(r, 0.4, 0.6);
  const basinCount = 6 + intBetween(r, 0, 2);

  return {
    word, seed, serial, kit, scale, rootMidi, bpm,
    board: { rows, pegs, marbleR: 0.021, entryX, basinCount },
    epithet: `sounds like ${pick(r, EPITHET_A)} ${pick(r, EPITHET_B)}`,
  };
}

export function dropSeedFor(seed: number, take: number): number {
  return cyrb53(`take-${take}`, seed);
}
