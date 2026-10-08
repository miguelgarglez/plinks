import { useEffect, useRef, useState } from 'react';
import type { Song } from './lib/song';
import type { DropResult } from './lib/physics';
import type { Playback } from './playback';
import { audioEngine } from './playback';
import { midiName } from './lib/music';
import { ramp } from './board';

// ── brass rail: the word stamps in, letter by letter ──
export function Rail({ word }: { word: string }) {
  const letters = word.toUpperCase().split('');
  const stagger = Math.min(75, 80 / Math.max(1, letters.length - 1)); // last letter lands ~500ms in
  return (
    <div className="rail" role="img" aria-label={`The word ${word} stamped in brass`}>
      {letters.map((ch, i) => (
        <span
          key={`${word}-${i}`}
          className="rail-letter"
          style={{ animationDelay: `${i * stagger}ms` }}
          onAnimationStart={() => {
            if (audioEngine.ready && !audioEngine.muted) audioEngine.knock(0, 320 + i * 14, 0.04);
          }}
        >
          {ch === '-' ? '·' : ch}
        </span>
      ))}
    </div>
  );
}

// ── the score: dots on a rhythm rail you can tap, scrub, or replay ──
export function ScoreRail({ song, drop, pb, onScrub }: {
  song: Song;
  drop: DropResult;
  pb: Playback;
  onScrub: () => void;
}) {
  const evs = drop.events;
  const lastT = evs.length ? evs[evs.length - 1].t : 1;
  // colors share the board's full pitch range so a dot matches its peg
  const midis = song.board.pegs.map(p => p.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);
  const revealed = pb.phase === 'settled' ? Infinity : pb.progress * lastT;

  const scrubbing = useRef(false);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const rungAt = useRef(new Map<number, number>());

  // drag across the rail: every note under the thumb rings as you pass it
  const scrubTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const now = performance.now();
    let hit = false;
    evs.forEach((ev, i) => {
      if (!(pb.phase === 'settled' || ev.t <= revealed + 0.001)) return;
      const ex = 2 + (ev.t / Math.max(lastT, 0.001)) * 96;
      if (Math.abs(ex - fx) < 2.4 && (rungAt.current.get(i) ?? -9e3) < now - 220) {
        rungAt.current.set(i, now);
        audioEngine.setKit(song.kit);
        pb.ping(ev.pegId, ev.midi, 0.8);
        hit = true;
      }
    });
    if (hit) onScrub();
    setScrubX(fx);
  };

  const scrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    audioEngine.unlock();
    scrubbing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubTo(e);
  };
  const scrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return;
    scrubTo(e);
  };
  const scrubEnd = () => {
    scrubbing.current = false;
    setScrubX(null);
  };

  const strip = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 4 && el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    check();
    el.addEventListener('scroll', check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
  }, [evs.length]);

  const playing = pb.phase === 'dropping' || pb.phase === 'replaying';

  // keyboard: the rail is one stop; arrows walk the notes and ring each
  const keyIx = useRef(0);
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const playable = evs.map((ev, i) => ({ ev, i })).filter(({ ev }) => pb.phase === 'settled' || ev.t <= revealed + 0.001);
    if (!playable.length) return;
    let ix = keyIx.current;
    if (e.key === 'ArrowRight') ix = Math.min(playable.length - 1, ix + 1);
    else if (e.key === 'ArrowLeft') ix = Math.max(0, ix - 1);
    else if (e.key === 'Home') ix = 0;
    else if (e.key === 'End') ix = playable.length - 1;
    else return;
    e.preventDefault();
    keyIx.current = ix;
    const { ev } = playable[ix];
    audioEngine.unlock();
    audioEngine.setKit(song.kit);
    pb.ping(ev.pegId, ev.midi, 0.8);
    setScrubX(2 + (ev.t / Math.max(lastT, 0.001)) * 96);
    onScrub();
    window.setTimeout(() => setScrubX(null), 300);
  };

  return (
    <div className={`score${canScroll ? ' can-scroll' : ''}`} ref={strip} aria-label="The melody as a rail of notes">
      <div
        className="score-inner"
        role="slider"
        tabIndex={0}
        aria-label="Scrub the melody. Arrow keys step through the notes."
        aria-valuemin={1}
        aria-valuemax={evs.length || 1}
        aria-valuenow={Math.min(keyIx.current + 1, evs.length || 1)}
        onKeyDown={onKey}
        onPointerDown={scrubDown}
        onPointerMove={scrubMove}
        onPointerUp={scrubEnd}
        onPointerCancel={scrubEnd}
      >
      <div className="score-rule" />
      {playing && (
        <div className="score-playhead" style={{ left: `${2 + pb.progress * 96}%` }} />
      )}
      {scrubX !== null && !playing && (
        <div className="score-scrubhead" style={{ left: `${scrubX}%` }} />
      )}
      {evs.map((e, i) => {
        const x = 2 + (e.t / Math.max(lastT, 0.001)) * 96;
        const u = hi > lo ? (e.midi - lo) / (hi - lo) : 0.5;
        const y = 8 + (1 - u) * 34; // keep dots (22px, centered) above the caption row
        const on = e.t <= revealed + 0.001;
        return (
          <button
            key={i}
            tabIndex={-1}
            className={`score-dot${e.pegId === -1 ? ' score-dot-tonic' : ''}${on ? ' on' : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, '--dot-color': e.pegId === -1 ? '#E4573C' : ramp(u) } as React.CSSProperties}
            onClick={() => {
              audioEngine.unlock();
              audioEngine.setKit(song.kit);
              pb.ping(e.pegId, e.midi, 0.8);
            }}
            aria-label={`Replay note ${midiName(e.midi)}`}
            disabled={!on && pb.phase !== 'settled'}
          />
        );
      })}
      </div>
      {pb.phase === 'idle' && evs.length > 0 && (
        <div className="score-hint"><span>the score appears as the marble plays</span></div>
      )}
      {pb.phase === 'settled' && (
        <div className="score-caption">
          <span>drag to play it</span>
          <button
            type="button"
            className="replay-key"
            onClick={() => { audioEngine.unlock(); pb.replay(); }}
            aria-label="Replay the whole melody"
          >
            ⟲ replay
          </button>
        </div>
      )}
    </div>
  );
}
