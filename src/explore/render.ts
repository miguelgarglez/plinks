import type { Song } from '../lib/song';
import type { Playback } from './playback';
import { midiName } from '../lib/music';

export interface Skin {
  bg: string;
  panel: string | null;         // board panel fill, null = none
  panelEdge: string;
  peg: string;                  // resting peg color
  pegRing: string;
  marble: string;
  marbleGlint: string;
  flashColors: (midi: number, lo: number, hi: number) => string;
  text: string;
  dim: string;
  glyphNotes: boolean;
  constellation: boolean;
  tines: boolean;               // draw peg stems (music-box comb)
  vignette: boolean;
}

export function pitchColor01(midi: number, lo: number, hi: number): number {
  return hi > lo ? Math.min(1, Math.max(0, (midi - lo) / (hi - lo))) : 0.5;
}

// teal→gold ramp shared by skins
export function ramp(u: number, a = '#4FB0A5', b = '#E0A83E'): string {
  const hx = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const pa = hx(a), pb = hx(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  song: Song, pb: Playback, skin: Skin, now: number,
) {
  const { board } = song;
  ctx.clearRect(0, 0, W, H);
  const S = W; // unit scale: board is 1 wide
  const yoff = 0; // board occupies full canvas height; canvas aspect = H/W

  // panel
  if (skin.panel) {
    ctx.fillStyle = skin.panel;
    ctx.beginPath();
    ctx.roundRect(0.02 * S, 0.02 * S, 0.96 * S, 0.96 * S, 18);
    ctx.fill();
    ctx.strokeStyle = skin.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const midis = board.pegs.map(p => p.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);

  // constellation: lines between consecutive strikes (skin B)
  if (skin.constellation && pb.hits.size > 1) {
    const struck = pb.drop.events.filter(e => e.pegId >= 0 && pb.hits.has(e.pegId));
    ctx.lineWidth = 1.2;
    for (let i = 1; i < struck.length; i++) {
      const a = struck[i - 1], b = struck[i];
      const age = now - (pb.flashes.get(b.pegId) ?? now);
      const alpha = Math.max(0, 0.5 - age * 0.06);
      ctx.strokeStyle = `rgba(224,168,62,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(a.x * S, a.y * S + yoff);
      ctx.lineTo(b.x * S, b.y * S + yoff);
      ctx.stroke();
      // midpoints twinkle
    }
  }

  // pegs
  for (const p of board.pegs) {
    const px = p.x * S, py = p.y * S + yoff;
    const ft = pb.flashes.get(p.id);
    const age = ft === undefined ? Infinity : now - ft;
    const glow = ft === undefined ? 0 : Math.max(0, 1 - age * 2.2);
    if (skin.tines) {
      // brass stem descending to the tip
      ctx.strokeStyle = skin.peg;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py - 0.028 * S);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    if (glow > 0) {
      const col = skin.flashColors(p.midi, lo, hi);
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 22 * glow + 6;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, (p.r + glow * 0.012) * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // shockwave ring
      const ring = Math.min(1, age * 3);
      ctx.strokeStyle = col;
      ctx.globalAlpha = (1 - ring) * 0.5;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py, (p.r + ring * 0.05) * S, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = skin.peg;
      ctx.beginPath();
      ctx.arc(px, py, p.r * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = skin.pegRing;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // note glyphs float up (skin B)
  if (skin.glyphNotes) {
    ctx.font = `${0.014 * S}px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    for (const g of pb.glyphs) {
      const age = now - g.t0;
      if (age > 1.4) continue;
      const a = Math.max(0, 1 - age / 1.4);
      ctx.fillStyle = skin.flashColors(g.midi, lo, hi);
      ctx.globalAlpha = a;
      ctx.fillText(midiName(g.midi), g.x * S, (g.y - 0.02 - age * 0.03) * S + yoff);
    }
    ctx.globalAlpha = 1;
  }

  // trail
  if (pb.trail.length > 1) {
    for (let i = 1; i < pb.trail.length; i++) {
      const a = (i / pb.trail.length) * 0.25;
      ctx.strokeStyle = skin.marble;
      ctx.globalAlpha = a;
      ctx.lineWidth = board.marbleR * S * (i / pb.trail.length);
      ctx.beginPath();
      ctx.moveTo(pb.trail[i - 1].x * S, pb.trail[i - 1].y * S + yoff);
      ctx.lineTo(pb.trail[i].x * S, pb.trail[i].y * S + yoff);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // marble
  if (pb.marble) {
    const mx = pb.marble.x * S, my = pb.marble.y * S + yoff;
    const mr = board.marbleR * S;
    const grd = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.4, mr * 0.1, mx, my, mr);
    grd.addColorStop(0, skin.marbleGlint);
    grd.addColorStop(1, skin.marble);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    // specular dot
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(mx - mr * 0.35, my - mr * 0.42, mr * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // basin pockets along floor
  const bw = 1 / board.basinCount;
  for (let i = 0; i < board.basinCount; i++) {
    const cx = (i + 0.5) * bw * S;
    const fy = 0.965 * S + yoff;
    ctx.strokeStyle = skin.pegRing;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, fy, bw * S * 0.42, Math.PI, 0);
    ctx.stroke();
  }
  // floor flash on landing
  if (pb.basinFlash !== null) {
    const age = now - pb.basinFlash;
    if (age < 0.8) {
      ctx.fillStyle = skin.flashColors(song.rootMidi - 12, lo, hi);
      ctx.globalAlpha = (1 - age / 0.8) * 0.25;
      ctx.fillRect(0, H * 0.93, W, H * 0.07);
      ctx.globalAlpha = 1;
    }
  }

  if (skin.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}
