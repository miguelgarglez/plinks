import { useEffect, useRef, useState } from 'react';
import type { Song } from './lib/song';
import type { DropResult } from './lib/physics';
import type { Playback } from './playback';
import { audioEngine } from './playback';
import { midiName } from './lib/music';
import { gestureDown, gestureFinish, gestureLost, gestureMove } from './lib/scrub';
import type { Gesture, RailBox, ScrubHit } from './lib/scrub';
import { haptic } from './lib/haptics';
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

  const gesture = useRef<Gesture>({ kind: 'idle' });
  const captId = useRef<number | null>(null);
  const blockReplayClick = useRef(false);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const rungAt = useRef(new Map<number, number>());
  const strip = useRef<HTMLDivElement>(null);

  const playableNow = (ev: DropResult['events'][number]) =>
    pb.phase === 'settled' || ev.t <= revealed + 0.001;
  const ring = (i: number, now = performance.now()) => {
    if (!playableNow(evs[i])) return false;
    if ((rungAt.current.get(i) ?? -9e3) >= now - 220) return false;
    rungAt.current.set(i, now);
    audioEngine.setKit(song.kit);
    haptic('note');
    pb.ping(evs[i].pegId, evs[i].midi, 0.8);
    return true;
  };

  const railBox = (): RailBox | null => {
    const rail = strip.current;
    if (!rail) return null;
    const rr = rail.getBoundingClientRect();
    return { left: rr.left, width: rr.width, scrollWidth: rail.scrollWidth, clientWidth: rail.clientWidth };
  };

  const ringAtProgress = (progress: number) => {
    const fx = progress * 100;
    let hit = false;
    evs.forEach((ev, i) => {
      const ex = 2 + (ev.t / Math.max(lastT, 0.001)) * 96;
      if (Math.abs(ex - fx) < 2.8 && ring(i)) hit = true;
    });
    if (hit) onScrub();
    setScrubX(fx);
  };

  const holdPointer = (el: HTMLElement, pointerId: number) => {
    try {
      el.setPointerCapture(pointerId);
      captId.current = pointerId;
    } catch {
      captId.current = null;
    }
  };

  const dropHold = (el: HTMLElement) => {
    const id = captId.current;
    captId.current = null;
    if (id !== null && el.hasPointerCapture(id)) el.releasePointerCapture(id);
  };

  const clearBead = () => setScrubX(null);

  // Finger x in the visible rail maps across the whole melody, so late notes
  // stay reachable on a tape wider than the phone. The paper scrolls under.
  const scrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rail = railBox();
    if (!rail) return;
    blockReplayClick.current = false;
    const target = e.target as HTMLElement;
    const hit: ScrubHit = target.closest('.replay-key') ? 'replay' : target.closest('.score-dot') ? 'dot' : 'tape';
    const next = gestureDown(e.pointerId, e.clientX, e.clientY, hit, rail);
    gesture.current = next;
    holdPointer(e.currentTarget, e.pointerId);
    if (hit === 'replay') return;
    // ring the pressed dot on the way down; travel past the slop becomes a scrub
    audioEngine.unlock();
    e.preventDefault();
    if (next.kind === 'dot') {
      const ix = Number((target.closest('.score-dot') as HTMLElement).dataset.i);
      if (Number.isInteger(ix) && evs[ix] && ring(ix)) onScrub();
      if (evs[ix]) setScrubX(2 + (evs[ix].t / Math.max(lastT, 0.001)) * 96);
      return;
    }
    if (next.kind === 'scrub' && strip.current) {
      strip.current.scrollLeft = next.scrollLeft;
      ringAtProgress(next.progress);
    }
  };
  const scrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rail = railBox();
    if (!rail || gesture.current.kind === 'idle') return;
    const prev = gesture.current;
    const next = gestureMove(prev, e.clientX, e.clientY, rail);
    gesture.current = next;
    if (prev.kind === 'replay' && next.kind === 'scrub') blockReplayClick.current = true;
    if (next.kind !== 'scrub' || !strip.current) return;
    audioEngine.unlock();
    e.preventDefault();
    strip.current.scrollLeft = next.scrollLeft;
    ringAtProgress(next.progress);
  };
  const scrubUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const done = gestureFinish(gesture.current, 'up');
    gesture.current = done.gesture;
    dropHold(e.currentTarget);
    clearBead();
    if (!done.replay) return;
    blockReplayClick.current = true;
    audioEngine.unlock();
    haptic('replay');
    pb.replay();
  };
  const scrubCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    gesture.current = gestureFinish(gesture.current, 'cancel').gesture;
    dropHold(e.currentTarget);
    clearBead();
  };
  const scrubLost = (e: React.PointerEvent<HTMLDivElement>) => {
    const still = e.currentTarget.hasPointerCapture(e.pointerId);
    const next = gestureLost(gesture.current, e.pointerId, still);
    if (next.kind !== 'idle') return;
    gesture.current = next;
    captId.current = null;
    clearBead();
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
    <div
      className={`score${canScroll ? ' can-scroll' : ''}`}
      ref={strip}
      aria-label="The melody as a rail of notes"
      onPointerDown={scrubDown}
      onPointerMove={scrubMove}
      onPointerUp={scrubUp}
      onPointerCancel={scrubCancel}
      onLostPointerCapture={scrubLost}
    >
      <div
        className="score-inner"
        role="slider"
        tabIndex={0}
        aria-label="Scrub the melody. Arrow keys step through the notes."
        aria-valuemin={1}
        aria-valuemax={evs.length || 1}
        aria-valuenow={Math.min(keyIx.current + 1, evs.length || 1)}
        onKeyDown={onKey}
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
            onClick={() => {
              // pointerup already replayed, or the press turned into a scrub
              if (blockReplayClick.current) {
                blockReplayClick.current = false;
                return;
              }
              audioEngine.unlock();
              haptic('replay');
              pb.replay();
            }}
            aria-label="Replay the whole melody"
          >
            ⟲ replay
          </button>
        </div>
      )}
    </div>
  );
}
