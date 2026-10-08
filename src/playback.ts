import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { Song } from './lib/song';
import { simulate, type DropResult } from './lib/physics';
import { AudioEngine } from './lib/audio';

export type Phase = 'idle' | 'dropping' | 'replaying' | 'settled';

export interface Glyph { x: number; y: number; midi: number; t0: number; }
export interface TrailPt { x: number; y: number; t: number; }
export interface Wob { t0: number; nx: number; ny: number; amp: number; }

const LEAD = 0.12; // audio lead-in so flashes land on the audible note

export interface Playback {
  phase: Phase;
  drop: DropResult;
  marble: { x: number; y: number; vx: number; vy: number } | null;
  flashes: Map<number, number>;   // pegId -> absolute time of last flash
  glyphs: Glyph[];
  trail: TrailPt[];
  hits: Map<number, number>;      // pegId -> absolute time struck (persists)
  wobs: Map<number, Wob>;         // pegId -> ring wobble (normal + amplitude)
  shake: { v: number };           // camera kick accumulator, decayed by the board
  squashAt: number | null;        // absolute time of last hard peg strike
  basinFlash: number | null;
  landedAt: number | null;
  progress: number;               // 0..1 playback progress for score reveal
  reduced: boolean;               // prefers-reduced-motion
  start: () => void;
  replay: () => void;             // play the composed melody again, no marble
  ping: (pegId: number, midi: number, vel?: number) => void;
}

export const audioEngine = new AudioEngine();

export function usePlayback(song: Song, take: number): Playback {
  const drop = useMemo(() => simulate(song, take), [song, take]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [run, setRun] = useState(0);
  const [, force] = useState(0);
  const st = useRef({
    t0: 0,
    mode: 'drop' as 'drop' | 'replay',
    marble: null as Playback['marble'],
    flashes: new Map<number, number>(),
    glyphs: [] as Glyph[],
    trail: [] as TrailPt[],
    hits: new Map<number, number>(),
    wobs: new Map<number, Wob>(),
    shake: { v: 0 },
    squashAt: null as number | null,
    basinFlash: null as number | null,
    landedAt: null as number | null,
    progress: 0,
    raf: 0,
  });

  // reset visuals and silence audio when the song/take changes
  useEffect(() => {
    const s = st.current;
    audioEngine.stopAll();
    s.marble = null;
    s.flashes.clear();
    s.glyphs = [];
    s.trail = [];
    s.hits.clear();
    s.wobs.clear();
    s.shake.v = 0;
    s.squashAt = null;
    s.basinFlash = null;
    s.landedAt = null;
    s.progress = 0;
    setPhase('idle');
  }, [drop]);

  useEffect(() => () => audioEngine.stopAll(), []);

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const start = useCallback(() => {
    audioEngine.unlock();
    audioEngine.setKit(song.kit);
    audioEngine.stopAll(); // a re-drop supersedes any melody still ringing
    const s = st.current;
    s.t0 = performance.now() / 1000;
    s.mode = 'drop';
    s.marble = null;
    s.flashes.clear();
    s.glyphs = [];
    s.trail = [];
    s.basinFlash = null;
    s.squashAt = null;
    s.landedAt = null;
    s.progress = 0;
    audioEngine.playEvents(drop.events, audioEngine.now() + LEAD);
    setRun(r => r + 1); // restarts the tick loop even if already dropping
    setPhase('dropping');
  }, [drop, song.kit]);

  // replay the finished melody: same flashes and playhead, no marble
  const replay = useCallback(() => {
    audioEngine.unlock();
    audioEngine.setKit(song.kit);
    audioEngine.stopAll();
    const s = st.current;
    s.t0 = performance.now() / 1000;
    s.mode = 'replay';
    s.marble = null;
    s.flashes.clear();
    s.glyphs = [];
    s.trail = [];
    s.basinFlash = null;
    s.progress = 0;
    audioEngine.playEvents(drop.events, audioEngine.now() + LEAD);
    setRun(r => r + 1);
    setPhase('replaying');
  }, [drop, song.kit]);

  useEffect(() => {
    if (phase !== 'dropping' && phase !== 'replaying') return;
    const s = st.current;
    const samples = drop.samples;
    let si = 0;
    let ei = 0; // event cursor — every strike lights its peg, repeats included
    const tick = () => {
      const now = performance.now() / 1000;
      const ts = now - s.t0 - LEAD; // marble, flash, score share the audio clock
      if (s.mode === 'drop') {
        while (si < samples.length - 2 && samples[si + 1].t <= ts) si++;
        const a = samples[si], b = samples[Math.min(si + 1, samples.length - 1)];
        const f = b.t > a.t ? Math.min(1, Math.max(0, (ts - a.t) / (b.t - a.t))) : 1;
        s.marble = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, vx: a.vx, vy: a.vy };
        if (!reduced) {
          s.trail.push({ x: s.marble.x, y: s.marble.y, t: now });
          if (s.trail.length > 36) s.trail.shift();
        }
      }

      // flashes land on the audible strike — one clock for marble, light, sound
      while (ei < drop.events.length && drop.events[ei].t <= ts) {
        const e = drop.events[ei++];
        if (e.pegId >= 0) {
          s.flashes.set(e.pegId, now);
          s.hits.set(e.pegId, now);
          if (!reduced) s.glyphs.push({ x: e.x, y: e.y, midi: e.midi, t0: now });
          // peg wobble along the strike normal + a camera kick on hard hits
          if (s.marble) {
            const dx = s.marble.x - e.x, dy = s.marble.y - e.y;
            const d = Math.hypot(dx, dy) || 1;
            s.wobs.set(e.pegId, { t0: now, nx: dx / d, ny: dy / d, amp: Math.min(1, e.vel * 1.4) });
            if (e.vel > 0.5 && !reduced) {
              s.shake.v = Math.min(0.014, s.shake.v + e.vel * 0.009);
              s.squashAt = now;
            }
          } else if (s.mode === 'replay') {
            s.wobs.set(e.pegId, { t0: now, nx: 0, ny: -1, amp: 0.5 });
          }
          if (navigator.vibrate) navigator.vibrate(3);
        } else {
          s.basinFlash = now;
          s.landedAt = now;
          audioEngine.knock(0, 150, 0.5);
          if (!reduced) s.shake.v = Math.min(0.016, s.shake.v + 0.011);
          if (navigator.vibrate) navigator.vibrate(12);
        }
      }
      const lastT = drop.events.length ? drop.events[drop.events.length - 1].t : 1;
      s.progress = Math.min(1, Math.max(0, ts) / Math.max(0.001, lastT));
      force(v => v + 1);
      if (ts < drop.duration + 0.5) {
        s.raf = requestAnimationFrame(tick);
      } else {
        setPhase('settled');
      }
    };
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [phase, run, drop, reduced]);

  return {
    phase, drop, reduced,
    marble: st.current.marble,
    flashes: st.current.flashes,
    glyphs: st.current.glyphs,
    trail: st.current.trail,
    hits: st.current.hits,
    wobs: st.current.wobs,
    shake: st.current.shake,
    squashAt: st.current.squashAt,
    basinFlash: st.current.basinFlash,
    landedAt: st.current.landedAt,
    progress: st.current.progress,
    start,
    replay,
    ping: (pegId: number, midi: number, vel = 0.18) => {
      const now = performance.now() / 1000;
      if (pegId >= 0) {
        st.current.flashes.set(pegId, now);
        st.current.hits.set(pegId, now);
        st.current.wobs.set(pegId, { t0: now, nx: 0, ny: -1, amp: 0.35 });
      } else {
        st.current.basinFlash = now; // replaying the tonic lights the basin
      }
      force(v => v + 1); // publish the flash to the canvas's snapshot
      if (audioEngine.ready && !audioEngine.muted) audioEngine.strike(midi, vel);
    },
  };
}
