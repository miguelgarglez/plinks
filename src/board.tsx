import { useEffect, useRef, type RefObject } from 'react';
import type { Song } from './lib/song';
import type { Playback } from './playback';
import { audioEngine } from './playback';
import { midiName } from './lib/music';
import { rng } from './lib/hash';
import { bead, stepBead, BEAD_R, type LiveBead } from './lib/live';

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

function marbleBall(ctx: CanvasRenderingContext2D, r: number, spin: number) {
  const g = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.08, 0, 0, r);
  g.addColorStop(0, P.marbleB);
  g.addColorStop(0.55, '#8a6f4d');
  g.addColorStop(1, P.marbleA);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // swirl band that makes spin legible
  ctx.strokeStyle = 'rgba(40,28,14,0.5)';
  ctx.lineWidth = r * 0.22;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, spin, spin + Math.PI * 0.9);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,250,235,0.9)';
  ctx.beginPath();
  ctx.arc(-r * 0.34, -r * 0.42, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

interface Spark { x: number; y: number; vx: number; vy: number; t0: number; col: string; }
interface Dust { x: number; y: number; vx: number; vy: number; t0: number; r: number; }

export function Board({ song, pb, onDrop, beadQueue }: {
  song: Song;
  pb: Playback;
  onDrop: () => void;
  beadQueue: RefObject<{ q: string[] }>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ pb, song });
  st.current = { pb, song };
  const grain = useRef<number[]>([]);
  const fx = useRef({
    beads: [] as LiveBead[],
    sparks: [] as Spark[],
    dust: [] as Dust[],
    pointer: { x: -1, y: -1, inside: false },
    strummed: new Map<number, number>(),
    seenWob: new Map<number, number>(),
    seenBasin: 0,
    beadAcc: 0,
    lastT: 0,
    spawnCool: 0,
    downAt: { x: 0, y: 0, moved: 0 },
    spin: 0,
    tilt: { x: 0, y: 0, push: 1 },
  });

  useEffect(() => {
    fx.current.beads = [];
    fx.current.sparks = [];
    fx.current.dust = [];
    fx.current.strummed.clear();
    fx.current.seenWob.clear();
    fx.current.seenBasin = 0;
  }, [song]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const wrap = cv.parentElement!;
    // seeded wood grain lines (vertical streaks)
    const gr = rng(song.seed ^ 0x9e37);
    grain.current = Array.from({ length: 26 }, () => gr());
    let raf = 0;

    const toBoard = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };

    const onMove = (e: PointerEvent) => {
      const p = toBoard(e);
      const f = fx.current;
      f.pointer.x = p.x;
      f.pointer.y = p.y;
      f.pointer.inside = true;
      f.downAt.moved = Math.max(f.downAt.moved, Math.hypot(p.x - f.downAt.x, p.y - f.downAt.y));
      // strum: dragging or hovering across a peg rings it softly
      const s = st.current;
      if (s.pb.phase === 'dropping' || s.pb.phase === 'replaying') return;
      const now = performance.now() / 1000;
      for (const peg of s.song.board.pegs) {
        const d = Math.hypot(peg.x - p.x, peg.y - p.y);
        if (d < 0.03 && (f.strummed.get(peg.id) ?? -9) < now - 0.45) {
          f.strummed.set(peg.id, now);
          s.pb.ping(peg.id, peg.midi, e.pointerType === 'mouse' ? 0.12 : 0.18);
        }
      }
    };
    const onDown = (e: PointerEvent) => {
      audioEngine.unlock(); // a press on the instrument is a gesture — wake audio
      const p = toBoard(e);
      fx.current.downAt = { x: p.x, y: p.y, moved: 0 };
      fx.current.pointer.x = p.x;
      fx.current.pointer.y = p.y;
      fx.current.pointer.inside = true;
    };
    const onLeave = () => { fx.current.pointer.inside = false; };
    const onClick = (e: MouseEvent) => {
      if (fx.current.downAt.moved * cv.clientWidth > 10) return; // a drag strums, it does not drop
      e.preventDefault();
      onDrop();
    };

    // tilt the playfield toward the pointer — the canvas moves inside its
    // walnut bezel so the rail, score and deck seams never shear
    const tiltRaf = { v: 0 };
    const applyTilt = () => {
      tiltRaf.v = 0;
      const f = fx.current;
      const s = st.current;
      if (s.pb.reduced || s.pb.phase === 'dropping') {
        const push = s.pb.phase === 'dropping' && !s.pb.reduced ? 1.014 : 1;
        cv.style.transform = `perspective(950px) rotateX(0deg) rotateY(0deg) scale(${push})`;
        return;
      }
      const rx = -f.tilt.y * 1.6;
      const ry = f.tilt.x * 2.0;
      cv.style.transform = `perspective(950px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1)`;
    };
    const scheduleTilt = () => { if (!tiltRaf.v) tiltRaf.v = requestAnimationFrame(applyTilt); };
    const onWrapMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      fx.current.tilt.x = Math.min(1, Math.max(-1, ((e.clientX - r.left) / r.width) * 2 - 1));
      fx.current.tilt.y = Math.min(1, Math.max(-1, ((e.clientY - r.top) / r.height) * 2 - 1));
      scheduleTilt();
    };
    const onWrapLeave = () => {
      fx.current.tilt.x = 0;
      fx.current.tilt.y = 0;
      scheduleTilt();
    };

    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('click', onClick);
    wrap.addEventListener('pointermove', onWrapMove);
    wrap.addEventListener('pointerleave', onWrapLeave);

    const loop = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth;
      if (w > 0 && cv.width !== w * dpr) { cv.width = w * dpr; cv.height = w * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, w, st.current.song, st.current.pb, grain.current, fx.current, beadQueue.current?.q ?? [], performance.now() / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (tiltRaf.v) cancelAnimationFrame(tiltRaf.v);
      cv.style.transform = '';
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('click', onClick);
      wrap.removeEventListener('pointermove', onWrapMove);
      wrap.removeEventListener('pointerleave', onWrapLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song]);

  return (
    <canvas
      ref={ref}
      className="board-canvas"
      role="button"
      tabIndex={0}
      aria-label={`Pegboard instrument. Activate to drop the marble and play the song of ${song.word}.`}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onDrop(); } }}
    />
  );
}

function draw(ctx: CanvasRenderingContext2D, W: number, song: Song, pb: Playback, grain: number[], fx: {
  beads: LiveBead[]; sparks: Spark[]; dust: Dust[];
  pointer: { x: number; y: number; inside: boolean };
  strummed: Map<number, number>; seenWob: Map<number, number>; seenBasin: number;
  beadAcc: number; lastT: number; spawnCool: number; spin: number;
}, beadQ: string[], now: number) {
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

  // ── live state step ──
  const dt = fx.lastT ? Math.min(0.05, now - fx.lastT) : 1 / 60;
  fx.lastT = now;

  // spawn queued letter-beads, staggered so a pasted word rains, not clumps
  fx.spawnCool -= dt;
  if (beadQ.length && fx.beads.length < 8 && fx.spawnCool <= 0) {
    fx.beads.push(bead(board, beadQ.shift()!, Math.floor(now * 1000) ^ song.seed));
    fx.spawnCool = 0.09;
  }

  // step beads at fixed substeps
  fx.beadAcc += dt;
  const SUB = 1 / 240;
  while (fx.beadAcc >= SUB) {
    fx.beadAcc -= SUB;
    for (const b of fx.beads) {
      stepBead(b, board, SUB, (peg, vn) => {
        pb.flashes.set(peg.id, now);
        pb.wobs.set(peg.id, { t0: now, nx: 0, ny: -1, amp: Math.min(0.6, vn * 0.3) });
        if (!pb.reduced && pb.glyphs.length < 24) {
          pb.glyphs.push({ x: peg.x, y: peg.y, midi: peg.midi, t0: now });
        }
        if (audioEngine.ready && !audioEngine.muted) audioEngine.strike(peg.midi, Math.min(0.3, vn * 0.22));
      });
    }
  }
  // retire beads that settled a while ago or lived too long
  fx.beads = fx.beads.filter(b => !(b.settled && b.age > 2.6) && b.age < 9);

  // watch the wobble map: a fresh strike sheds sparks
  pb.wobs.forEach((wob, id) => {
    if ((fx.seenWob.get(id) ?? 0) >= wob.t0) return;
    fx.seenWob.set(id, wob.t0);
    if (wob.amp < 0.55 || pb.reduced) return;
    const peg = board.pegs[id];
    if (!peg) return;
    const midis = board.pegs.map(p => p.midi);
    const col = ramp((peg.midi - Math.min(...midis)) / Math.max(1, Math.max(...midis) - Math.min(...midis)));
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.25 + Math.random() * 0.5 * wob.amp;
      fx.sparks.push({ x: peg.x, y: peg.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.2, t0: now, col });
    }
  });
  fx.sparks = fx.sparks.filter(sp => now - sp.t0 < 0.45);

  // watch the basin: landing kicks up dust
  if (pb.basinFlash !== null && fx.seenBasin !== pb.basinFlash) {
    fx.seenBasin = pb.basinFlash;
    if (!pb.reduced) {
      const bx = (pb.drop.basin + 0.5) * (1 / board.basinCount);
      for (let i = 0; i < 9; i++) {
        fx.dust.push({
          x: bx + (Math.random() - 0.5) * 0.04,
          y: 0.965,
          vx: (Math.random() - 0.5) * 0.10,
          vy: -(0.03 + Math.random() * 0.07),
          t0: now,
          r: 0.006 + Math.random() * 0.009,
        });
      }
    }
  }
  fx.dust = fx.dust.filter(d => now - d.t0 < 1.1);

  // camera kick decays; marble spin integrates
  pb.shake.v *= Math.pow(0.02, dt); // ~halves every 4 frames
  if (pb.shake.v < 0.0002) pb.shake.v = 0;
  if (pb.marble) fx.spin += pb.marble.vx * 55 * dt;

  // ── scene under the camera kick ──
  ctx.save();
  if (pb.shake.v > 0) {
    ctx.translate(
      Math.sin(now * 173) * pb.shake.v * S,
      Math.cos(now * 149) * pb.shake.v * S * 0.8,
    );
  }

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

  // cursor presence: pegs near the pointer lean toward it and warm up
  const hover = fx.pointer.inside && !pb.reduced ? fx.pointer : null;

  // pegs — brass pins; struck pegs keep a pitch-colored ember, hits wobble
  for (const p of board.pegs) {
    let px = p.x * S, py = p.y * S;
    const ft = pb.flashes.get(p.id);
    const age = ft === undefined ? Infinity : now - ft;
    const glow = ft === undefined ? 0 : Math.max(0, 1 - age * 2.4);
    const col = ramp((p.midi - lo) / Math.max(1, hi - lo));

    // ring wobble: the pin rocks along the strike normal for a beat
    const wob = pb.wobs.get(p.id);
    if (wob && now - wob.t0 < 0.38 && !pb.reduced) {
      const wa = now - wob.t0;
      const k = Math.sin(wa * 52) * wob.amp * Math.exp(-wa * 11) * 0.006 * S;
      px += wob.nx * k;
      py += wob.ny * k;
    }

    // proximity lean + warmth
    let warm = 0;
    if (hover) {
      const hd = Math.hypot(p.x - hover.x, p.y - hover.y);
      if (hd < 0.06) {
        warm = (1 - hd / 0.06);
        px += ((hover.x - p.x) / Math.max(0.01, hd)) * warm * 0.0022 * S;
        py += ((hover.y - p.y) / Math.max(0.01, hd)) * warm * 0.0022 * S;
      }
    }

    if (glow > 0) {
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 20 * glow + 8;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, p.r * S * (pb.reduced ? 1.15 : 1 + glow * 0.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (!pb.reduced) {
        const ring = Math.min(1, age * 3.2);
        ctx.strokeStyle = col;
        ctx.globalAlpha = (1 - ring) * 0.55;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(px, py, (p.r + ring * 0.045) * S, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      // pin: dark base + brass cap + tiny highlight
      if (warm > 0.04) {
        ctx.fillStyle = col;
        ctx.globalAlpha = warm * 0.28;
        ctx.beginPath();
        ctx.arc(px, py, p.r * S * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = P.pegDark;
      ctx.beginPath();
      ctx.arc(px, py + 0.002 * S, p.r * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = warm > 0.04 ? ramp((p.midi - lo) / Math.max(1, hi - lo)) : P.peg;
      ctx.globalAlpha = warm > 0.04 ? 0.4 + warm * 0.6 : 1;
      ctx.beginPath();
      ctx.arc(px, py, p.r * S * 0.82, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,235,190,0.5)';
      ctx.beginPath();
      ctx.arc(px - p.r * S * 0.28, py - p.r * S * 0.3, p.r * S * 0.26, 0, Math.PI * 2);
      ctx.fill();
      // residue ember on struck pegs (shows whenever the flash has faded)
      const hit = pb.hits.get(p.id);
      if (hit !== undefined && glow <= 0.01) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.32;
        ctx.beginPath();
        ctx.arc(px, py, p.r * S * 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(px, py, p.r * S * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // sparks — pitch-colored flecks off hard strikes
  for (const sp of fx.sparks) {
    const age = now - sp.t0;
    const k = age / 0.45;
    sp.vy += 1.6 * dt;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    ctx.fillStyle = sp.col;
    ctx.globalAlpha = (1 - k) * 0.85;
    ctx.beginPath();
    ctx.arc(sp.x * S, sp.y * S, (1 - k * 0.6) * 0.0035 * S, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // note glyphs float up from strikes; drain them once spent so strikes stay loud
  for (let i = pb.glyphs.length - 1; i >= 0; i--) {
    if (now - pb.glyphs[i].t0 > 1.4) pb.glyphs.splice(i, 1);
  }
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

  // letter-beads: ivory pellets with the typed character engraved
  for (const b of fx.beads) {
    const r = BEAD_R * S;
    const fade = b.settled ? Math.max(0, 1 - (b.age - 1.4) / 1.2) : Math.min(1, b.age * 8);
    ctx.save();
    ctx.translate(b.x * S, b.y * S);
    ctx.rotate(b.rot * 0.15);
    ctx.globalAlpha = fade;
    const bg = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r);
    bg.addColorStop(0, '#fdf6e8');
    bg.addColorStop(0.7, '#d9cbb2');
    bg.addColorStop(1, '#a89a80');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3b28';
    ctx.font = `700 ${r * 1.15}px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.letter.toUpperCase(), 0, r * 0.06);
    ctx.restore();
  }

  // dust puff at the basin
  for (const d of fx.dust) {
    const age = now - d.t0;
    const k = age / 1.1;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 0.12 * dt;
    ctx.fillStyle = 'rgba(230,220,200,1)';
    ctx.globalAlpha = (1 - k) * 0.4;
    ctx.beginPath();
    ctx.arc(d.x * S, d.y * S, d.r * S * (1 + k * 1.6), 0, Math.PI * 2);
    ctx.fill();
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

  // marble: parked in the hopper while idle, then live — squash along travel
  if (pb.marble) {
    const m = pb.marble;
    const r = board.marbleR * S;
    const speed = Math.hypot(m.vx, m.vy);
    const stretch = pb.reduced ? 0 : Math.min(0.2, speed * 0.045);
    const squashing = !pb.reduced && pb.squashAt !== null && now - pb.squashAt < 0.09;
    ctx.save();
    ctx.translate(m.x * S, m.y * S);
    ctx.rotate(Math.atan2(m.vy, m.vx));
    if (squashing) {
      const q = 1 - (now - pb.squashAt!) / 0.09;
      ctx.scale(1 - q * 0.28, 1 + q * 0.34); // flatten against the peg
    } else {
      ctx.scale(1 + stretch, 1 - stretch * 0.6); // velocity stretch
    }
    ctx.rotate(-Math.atan2(m.vy, m.vx)); // ball shading stays lit from above
    marbleBall(ctx, r, fx.spin);
    ctx.restore();
  } else if (pb.phase === 'idle') {
    const bob = pb.reduced ? 0 : Math.sin(now * 1.8) * 0.0015;
    ctx.save();
    ctx.translate(hx, (hy + 0.02 + bob) * S);
    marbleBall(ctx, board.marbleR * S, fx.spin * 0.2);
    ctx.restore();
  }

  ctx.restore(); // camera kick
}
