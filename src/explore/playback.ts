import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { Song } from '../lib/song';
import { simulate, type DropResult } from '../lib/physics';
import { AudioEngine } from '../lib/audio';

export type Phase = 'idle' | 'dropping' | 'settled';

export interface Glyph { x: number; y: number; midi: number; t0: number; }
export interface TrailPt { x: number; y: number; t: number; }

export interface Playback {
  phase: Phase;
  drop: DropResult;
  marble: { x: number; y: number; vx: number; vy: number } | null;
  flashes: Map<number, number>; // pegId -> visual time of flash
  glyphs: Glyph[];
  trail: TrailPt[];
  hits: Set<number>;           // pegs struck so far
  basinFlash: number | null;
  played: number;              // events whose t <= now
  start: () => void;
  engine: AudioEngine;
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
    hits: new Set<number>(),
    basinFlash: null as number | null,
    played: 0,
    raf: 0,
  });

  const start = useCallback(() => {
    audioEngine.unlock();
    audioEngine.setKit(song.kit);
    const s = st.current;
    s.t0 = performance.now() / 1000;
    s.marble = null;
    s.flashes.clear();
    s.glyphs = [];
    s.trail = [];
    s.hits.clear();
    s.played = 0;
    s.basinFlash = null;
    audioEngine.playEvents(drop.events, audioEngine.now() + 0.08);
    setPhase('dropping');
  }, [drop, song.kit]);

  useEffect(() => {
    if (phase !== 'dropping') return;
    const s = st.current;
    const samples = drop.samples;
    let si = 0;
    const tick = () => {
      const t = performance.now() / 1000 - s.t0;
      while (si < samples.length - 2 && samples[si + 1].t <= t) si++;
      const a = samples[si], b = samples[Math.min(si + 1, samples.length - 1)];
      const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
      s.marble = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, vx: a.vx, vy: a.vy };
      s.trail.push({ x: s.marble.x, y: s.marble.y, t });
      if (s.trail.length > 40) s.trail.shift();

      for (const e of drop.events) {
        if (e.t <= t && e.pegId >= 0 && !s.flashes.has(e.pegId)) {
          s.flashes.set(e.pegId, t);
          s.glyphs.push({ x: e.x, y: e.y, midi: e.midi, t0: t });
          s.hits.add(e.pegId);
          s.played++;
          if (navigator.vibrate) navigator.vibrate(4);
        }
      }
      const land = drop.events[drop.events.length - 1];
      if (land && land.t <= t && s.basinFlash === null) {
        s.basinFlash = t;
        audioEngine.knock(0, 160, 0.5);
        if (navigator.vibrate) navigator.vibrate(10);
      }
      force(v => v + 1);
      if (t < drop.duration + 0.4) {
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
    played: st.current.played,
    start,
    engine: audioEngine,
  };
}
