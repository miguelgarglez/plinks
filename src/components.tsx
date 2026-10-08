import { useEffect, useRef, useState } from 'react';
import type { Song } from './lib/song';
import type { DropResult } from './lib/physics';
import type { Playback } from './playback';
import { audioEngine } from './playback';
import { midiName } from './lib/music';
import { melodyProgress, scrollForProgress } from './lib/scrub';
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
  const captId = useRef<number | null>(null);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const rungAt = useRef(new Map<number, number>());
  const lastClient = useRef<{ x: number; y: number } | null>(null);
  // while the press began on a dot, only that note has rung; a drag of
  // more than a few px graduates the gesture into a proximity scrub
  const downDot = useRef<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  const playableNow = (ev: DropResult['events'][number]) =>
    pb.phase === 'settled' || ev.t <= revealed + 0.001;
  const ring = (i: number, now = performance.now()) => {
    if (!playableNow(evs[i])) return false;
    if ((rungAt.current.get(i) ?? -9e3) >= now - 220) return false;
    rungAt.current.set(i, now);
    audioEngine.setKit(song.kit);
    pb.ping(evs[i].pegId, evs[i].midi, 0.8);
    return true;
  };

  // Finger x in the visible rail maps across the whole melody, so late notes
  // stay reachable on a tape wider than the phone. The paper scrolls under.
  const scrubAt = (clientX: number) => {
    const rail = strip.current;
    if (!rail) return;
    const rr = rail.getBoundingClientRect();
    const viewU = melodyProgress(clientX, rr.left, rr.width);
    rail.scrollLeft = scrollForProgress(viewU, rail.scrollWidth, rail.clientWidth);
    const fx = viewU * 100;
    let hit = false;
    evs.forEach((ev, i) => {
      const ex = 2 + (ev.t / Math.max(lastT, 0.001)) * 96;
      if (Math.abs(ex - fx) < 2.8 && ring(i)) hit = true;
    });
    if (hit) onScrub();
    setScrubX(fx);
  };

  const scrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // a press that begins on a dot rings exactly that note; the button's
    // own click is captured away by the strip, so ring on down instead
    audioEngine.unlock();
    scrubbing.current = true;
    lastClient.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      captId.current = e.pointerId;
    } catch { /* capture optional */ }
    e.preventDefault();
    const dotEl = (e.target as HTMLElement).closest('.score-dot');
    const ix = dotEl ? Number((dotEl as HTMLElement).dataset.i) : NaN;
    if (Number.isInteger(ix) && evs[ix]) {
      downDot.current = { x: e.clientX, y: e.clientY };
      if (ring(ix)) onScrub();
      setScrubX(2 + (evs[ix].t / Math.max(lastT, 0.001)) * 96);
    } else {
      downDot.current = null;
      scrubAt(e.clientX);
    }
  };
  const scrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return;
    e.preventDefault();
    lastClient.current = { x: e.clientX, y: e.clientY };
    const d = downDot.current;
    if (d) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
      downDot.current = null; // enough travel — this is a scrub now
    }
    scrubAt(e.clientX);
  };
  const scrubEnd = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e && captId.current !== null) {
      try { e.currentTarget.releasePointerCapture(captId.current); } catch { /* already released */ }
    }
    captId.current = null;
    scrubbing.current = false;
    downDot.current = null;
    lastClient.current = null;
    setScrubX(null);
  };

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
    const px = 2 + (ev.t / Math.max(lastT, 0.001)) * 96;
    setScrubX(px);
    // keep the stepped dot in view when the paper runs past the window
    const rail = strip.current;
    const inner = rail?.firstElementChild as HTMLElement | null;
    if (rail && inner) {
      const target = (px / 100) * inner.offsetWidth;
      rail.scrollTo({ left: Math.max(0, target - rail.clientWidth / 2), behavior: 'smooth' });
    }
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
        onLostPointerCapture={() => scrubEnd()}
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
            data-i={i}
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
