import type { Song } from './lib/song';
import type { DropResult } from './lib/physics';
import type { Playback } from './playback';
import { audioEngine } from './playback';
import { midiName } from './lib/music';
import { ramp } from './board';

// ── brass rail: the word stamps in, letter by letter ──
export function Rail({ word }: { word: string }) {
  const letters = word.toUpperCase().split('');
  return (
    <div className="rail" role="img" aria-label={`The word ${word} stamped in brass`}>
      {letters.map((ch, i) => (
        <span
          key={`${word}-${i}`}
          className="rail-letter"
          style={{ animationDelay: `${i * 75}ms` }}
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
  const lastT = evs.length ? evs[evs.length - 1].tGrid : 1;
  const midis = evs.map(e => e.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);
  const revealed = pb.phase === 'settled' ? Infinity : pb.progress * lastT;

  return (
    <div className="score" aria-label="The melody as a rail of notes">
      <div className="score-rule" />
      {pb.phase === 'dropping' && (
        <div className="score-playhead" style={{ left: `${2 + pb.progress * 96}%` }} />
      )}
      {evs.map((e, i) => {
        const x = 2 + (e.tGrid / Math.max(lastT, 0.001)) * 96;
        const u = hi > lo ? (e.midi - lo) / (hi - lo) : 0.5;
        const y = 12 + (1 - u) * 64;
        const on = e.tGrid <= revealed + 0.001;
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
      {pb.phase === 'settled' && (
        <div className="score-caption">tap a note to hear it again</div>
      )}
    </div>
  );
}
