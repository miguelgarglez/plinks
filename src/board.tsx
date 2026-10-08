import { useEffect, useRef } from 'react';
import type { Song } from './lib/song';
import type { Playback } from './playback';
import { midiName } from './lib/music';
import { rng } from './lib/hash';

const P = {
  wood: '#33261B',
  woodDeep: '#241a11',
  woodLine: 'rgba(255,214,150,0.05)',
  brass: '#C19A4A',
  brassDark: '#7a5c22',
  peg: '#a3814f',
  pegDark: '#5f4a2b',
  bone: '#EFE7DA',
  marbleA: '#2f2418',
  marbleB: '#f4ead6',
  ember: '#E4573C',
};

export function ramp(u: number, a = '#4FB0A5', b = '#E8B84B'): string {
  const hx = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const pa = hx(a), pb = hx(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.min(1, Math.max(0, u))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function marbleBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
  g.addColorStop(0, P.marbleB);
  g.addColorStop(0.55, '#8a6f4d');
  g.addColorStop(1, P.marbleA);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,250,235,0.9)';
  ctx.beginPath();
  ctx.arc(x - r * 0.34, y - r * 0.42, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

export function Board({ song, pb, onDrop }: { song: Song; pb: Playback; onDrop: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ pb, song });
  st.current = { pb, song };
  const grain = useRef<number[]>([]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    // seeded wood grain lines (vertical streaks)
    const gr = rng(song.seed ^ 0x9e37);
    grain.current = Array.from({ length: 26 }, () => gr());
    let raf = 0;
    const loop = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth;
      if (w > 0 && cv.width !== w * dpr) { cv.width = w * dpr; cv.height = w * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, w, st.current.song, st.current.pb, grain.current, performance.now() / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [song]);

  return (
    <canvas
      ref={ref}
      className="board-canvas"
      onClick={onDrop}
      role="button"
      tabIndex={0}
      aria-label={`Pegboard instrument. Activate to drop the marble and play the song of ${song.word}.`}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onDrop(); } }}
    />
  );
}

function draw(ctx: CanvasRenderingContext2D, W: number, song: Song, pb: Playback, grain: number[], now: number) {
  const { board } = song;
  ctx.clearRect(0, 0, W, W);
  const S = W;

  // walnut panel
  const pr = 0.028 * S;
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#3b2c1e');
  g.addColorStop(0.5, P.wood);
  g.addColorStop(1, P.woodDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, S, S, pr);
  ctx.fill();

  // wood grain
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, S, S, pr);
  ctx.clip();
  ctx.strokeStyle = P.woodLine;
  ctx.lineWidth = 1;
  for (let i = 0; i < grain.length; i++) {
    const gx = grain[i] * S;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.bezierCurveTo(gx + 8 * (grain[(i * 7) % grain.length] - 0.5), S * 0.33, gx - 8 * (grain[(i * 13) % grain.length] - 0.5), S * 0.66, gx + 4 * (grain[(i * 3) % grain.length] - 0.5), S);
    ctx.stroke();
  }
  ctx.restore();

  // inner edge shadow
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, S, S, pr);
  ctx.clip();
  const edge = ctx.createRadialGradient(S / 2, S * 0.45, S * 0.25, S / 2, S * 0.5, S * 0.75);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();

  const midis = board.pegs.map(p => p.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);

  // hopper mouth where the marble enters
  const hx = board.entryX * S;
  const hy = 0.045 * S;
  ctx.fillStyle = P.brassDark;
  ctx.beginPath();
  ctx.moveTo(hx - 0.045 * S, 0);
  ctx.lineTo(hx - 0.022 * S, hy + 0.012 * S);
  ctx.lineTo(hx + 0.022 * S, hy + 0.012 * S);
  ctx.lineTo(hx + 0.045 * S, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.brass;
  ctx.fillRect(hx - 0.045 * S, 0, 0.09 * S, 0.008 * S);

  // basin pockets: brass dividers + arcs
  const bw = 1 / board.basinCount;
  const floorY = 0.97 * S;
  ctx.strokeStyle = 'rgba(193,154,74,0.75)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i <= board.basinCount; i++) {
    const dx = i * bw * S;
    ctx.beginPath();
    ctx.moveTo(dx, floorY);
    ctx.lineTo(dx, floorY - 0.045 * S);
    ctx.stroke();
    ctx.fillStyle = P.brass;
    ctx.beginPath();
    ctx.arc(dx, floorY - 0.045 * S, 0.004 * S, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = P.brass;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(S, floorY);
  ctx.stroke();

  // landing flash on the floor
  if (pb.basinFlash !== null) {
    const age = now - pb.basinFlash;
    if (age < 0.9) {
      const bx = (pb.drop.basin + 0.5) * bw * S;
      ctx.fillStyle = P.ember;
      ctx.globalAlpha = (1 - age / 0.9) * 0.35;
      ctx.beginPath();
      ctx.arc(bx, floorY, bw * S * 0.45, Math.PI, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // pegs — brass pins; struck pegs keep a pitch-colored ember
  for (const p of board.pegs) {
    const px = p.x * S, py = p.y * S;
    const ft = pb.flashes.get(p.id);
    const age = ft === undefined ? Infinity : now - ft;
    const glow = ft === undefined ? 0 : Math.max(0, 1 - age * 2.4);
    const col = ramp((p.midi - lo) / Math.max(1, hi - lo));

    if (glow > 0) {
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 20 * glow + 8;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, p.r * S * (1 + glow * 0.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const ring = Math.min(1, age * 3.2);
      ctx.strokeStyle = col;
      ctx.globalAlpha = (1 - ring) * 0.55;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, py, (p.r + ring * 0.045) * S, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // pin: dark base + brass cap + tiny highlight
      ctx.fillStyle = P.pegDark;
      ctx.beginPath();
      ctx.arc(px, py + 0.002 * S, p.r * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.peg;
      ctx.beginPath();
      ctx.arc(px, py, p.r * S * 0.82, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,235,190,0.5)';
      ctx.beginPath();
      ctx.arc(px - p.r * S * 0.28, py - p.r * S * 0.3, p.r * S * 0.26, 0, Math.PI * 2);
      ctx.fill();
      // residue ember on struck pegs
      const hit = pb.hits.get(p.id);
      if (hit !== undefined && ft === undefined) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(px, py, p.r * S * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // note glyphs float up from strikes
  ctx.font = `600 ${Math.max(9, 0.015 * S)}px "Space Mono", monospace`;
  ctx.textAlign = 'center';
  for (const gl of pb.glyphs) {
    const age = now - gl.t0;
    if (age > 1.3) continue;
    ctx.fillStyle = ramp((gl.midi - lo) / Math.max(1, hi - lo));
    ctx.globalAlpha = Math.max(0, 1 - age / 1.3);
    ctx.fillText(midiName(gl.midi), gl.x * S, (gl.y - 0.022 - age * 0.028) * S);
  }
  ctx.globalAlpha = 1;

  // trail
  for (let i = 1; i < pb.trail.length; i++) {
    const a = (i / pb.trail.length) * 0.2;
    ctx.strokeStyle = P.bone;
    ctx.globalAlpha = a;
    ctx.lineWidth = board.marbleR * S * (i / pb.trail.length);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pb.trail[i - 1].x * S, pb.trail[i - 1].y * S);
    ctx.lineTo(pb.trail[i].x * S, pb.trail[i].y * S);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // marble: parked in the hopper while idle, then live
  if (pb.marble) {
    marbleBall(ctx, pb.marble.x * S, pb.marble.y * S, board.marbleR * S);
  } else if (pb.phase === 'idle') {
    const bob = Math.sin(now * 1.8) * 0.0015;
    marbleBall(ctx, hx, (hy + 0.02 + bob) * S, board.marbleR * S);
  }
}
