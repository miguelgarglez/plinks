import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { Song } from './lib/song';
import { simulate, type DropResult } from './lib/physics';
import { AudioEngine } from './lib/audio';

export type Phase = 'idle' | 'dropping' | 'settled';

export interface Glyph { x: number; y: number; midi: number; t0: number; }
export interface TrailPt { x: number; y: number; t: number; }

export interface Playback {
  phase: Phase;
  drop: DropResult;
  marble: { x: number; y: number; vx: number; vy: number } | null;
  flashes: Map<number, number>;
  glyphs: Glyph[];
  trail: TrailPt[];
  hits: Map<number, number>; // pegId -> struck at t (persists after settle)
  basinFlash: number | null;
  landedAt: number | null;
  progress: number;          // 0..1 playback progress for score reveal
  start: () => void;
  ping: (pegId: number, midi: number) => void;
}

export const audioEngine = new AudioEngine();

export function usePlayback(song: Song, take: number): Playback {
  const drop = useMemo(() => simulate(song, take), [song, take]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [, force] = useState(0);
  const st = useRef({
    t0: 0,
    marble: null as Playback['marble'],
    flashes: new Map<number, number>(),
    glyphs: [] as Glyph[],
    trail: [] as TrailPt[],
    hits: new Map<number, number>(),
    basinFlash: null as number | null,
    landedAt: null as number | null,
    progress: 0,
    raf: 0,
  });

  // reset visuals when the song/take changes
  useEffect(() => {
    const s = st.current;
    s.marble = null;
    s.flashes.clear();
    s.glyphs = [];
    s.trail = [];
    s.hits.clear();
    s.basinFlash = null;
    s.landedAt = null;
    s.progress = 0;
    setPhase('idle');
  }, [drop]);

  const reduced = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = mq.matches;
    const fn = (e: MediaQueryListEvent) => { reduced.current = e.matches; };
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const start = useCallback(() => {
    audioEngine.unlock();
    audioEngine.setKit(song.kit);
    const s = st.current;
    s.t0 = performance.now() / 1000;
    s.marble = null;
    s.flashes.clear();
    s.glyphs = [];
    s.trail = [];
    s.basinFlash = null;
    s.landedAt = null;
    s.progress = 0;
    audioEngine.playEvents(drop.events, audioEngine.now() + 0.12);
    setPhase('dropping');
  }, [drop, song.kit]);

  useEffect(() => {
    if (phase !== 'dropping') return;
    const s = st.current;
    const samples = drop.samples;
    const compress = reduced.current ? 0.42 : 1; // reduced motion: quicker traversal
    let si = 0;
    const tick = () => {
      const t = performance.now() / 1000 - s.t0;
      const ts = t / compress;
      while (si < samples.length - 2 && samples[si + 1].t <= ts) si++;
      const a = samples[si], b = samples[Math.min(si + 1, samples.length - 1)];
      const f = b.t > a.t ? Math.min(1, Math.max(0, (ts - a.t) / (b.t - a.t))) : 1;
      s.marble = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, vx: a.vx, vy: a.vy };
      s.trail.push({ x: s.marble.x, y: s.marble.y, t });
      if (s.trail.length > 36) s.trail.shift();

      for (const e of drop.events) {
        // flashes follow the *audible* note (grid time), so sound and light agree
        const ft = reduced.current ? e.t : e.t;
        if (ft <= ts && e.pegId >= 0 && !s.flashes.has(e.pegId)) {
          s.flashes.set(e.pegId, t);
          s.hits.set(e.pegId, t);
          s.glyphs.push({ x: e.x, y: e.y, midi: e.midi, t0: t });
          if (navigator.vibrate) navigator.vibrate(3);
        }
      }
      const lastGrid = drop.events.length ? drop.events[drop.events.length - 1].tGrid : 1;
      s.progress = Math.min(1, ts / Math.max(0.001, lastGrid));
      const land = drop.events[drop.events.length - 1];
      if (land && land.t <= ts && s.basinFlash === null) {
        s.basinFlash = t;
        s.landedAt = t;
        audioEngine.knock(0, 150, 0.5);
        if (navigator.vibrate) navigator.vibrate(12);
      }
      force(v => v + 1);
      if (t < drop.duration * compress + 0.5) {
        s.raf = requestAnimationFrame(tick);
      } else {
        setPhase('settled');
      }
    };
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [phase, drop]);

  return {
    phase, drop,
    marble: st.current.marble,
    flashes: st.current.flashes,
    glyphs: st.current.glyphs,
    trail: st.current.trail,
    hits: st.current.hits,
    basinFlash: st.current.basinFlash,
    landedAt: st.current.landedAt,
    progress: st.current.progress,
    start,
    ping: (pegId: number, midi: number) => {
      if (!audioEngine.ready || audioEngine.muted) return;
      const t = performance.now() / 1000;
      st.current.flashes.set(pegId, t);
      audioEngine.strike(midi, 0.18);
    },
  };
}
