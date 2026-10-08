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

// ── the score: dots on a rhythm rail, revealed as they ring ──
export function ScoreRail({ song, drop, pb }: { song: Song; drop: DropResult; pb: Playback }) {
  const evs = drop.events;
  const lastT = evs.length ? evs[evs.length - 1].t : 1;
  // colors share the board's full pitch range so a dot matches its peg
  const midis = song.board.pegs.map(p => p.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);
  const revealed = pb.phase === 'settled' ? Infinity : pb.progress * lastT;

  // taps anywhere on the strip replay the nearest note — forgiving on touch
  const tapStrip = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * 100;
    let best = -1, bd = Infinity;
    evs.forEach((ev, i) => {
      const ex = 2 + (ev.t / Math.max(lastT, 0.001)) * 96;
      const d = Math.abs(ex - fx);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return;
    const ev = evs[best];
    if (!(pb.phase === 'settled' || ev.t <= revealed + 0.001)) return;
    audioEngine.unlock();
    audioEngine.setKit(song.kit);
    pb.ping(ev.pegId, ev.midi, 0.8);
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

  return (
    <div className={`score${canScroll ? ' can-scroll' : ''}`} ref={strip} aria-label="The melody as a rail of notes">
      <div className="score-inner" onClick={tapStrip}>
      <div className="score-rule" />
      {pb.phase === 'dropping' && (
        <div className="score-playhead" style={{ left: `${2 + pb.progress * 96}%` }} />
      )}
      {evs.map((e, i) => {
        const x = 2 + (e.t / Math.max(lastT, 0.001)) * 96;
        const u = hi > lo ? (e.midi - lo) / (hi - lo) : 0.5;
        const y = 12 + (1 - u) * 64;
        const on = e.t <= revealed + 0.001;
        return (
          <button
            key={i}
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
      {pb.phase === 'idle' && evs.length > 0 && (
        <div className="score-hint">the score appears as the marble plays</div>
      )}
      </div>
      {pb.phase === 'settled' && (
        <div className="score-caption">tap a note to hear it again</div>
      )}
    </div>
  );
}
