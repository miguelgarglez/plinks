import type { DropResult } from '../lib/physics';
import type { Skin } from './render';

// The melody as a dot-rail score: x = grid time, y = pitch.
export function ScoreStrip({ drop, skin }: { drop: DropResult; skin: Skin }) {
  const evs = drop.events;
  const lastT = evs.length ? evs[evs.length - 1].tGrid : 1;
  const midis = evs.map(e => e.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);
  return (
    <div className="score-strip" role="img" aria-label="The melody as a rail of notes">
      <div className="score-rail" />
      {evs.map((e, i) => {
        const x = (e.tGrid / Math.max(lastT, 0.001)) * 96 + 2;
        const y = 12 + (1 - (e.midi - lo) / Math.max(1, hi - lo)) * 40;
        return (
          <div
            key={i}
            className="score-dot"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              background: skin.flashColors(e.midi, lo, hi),
            }}
          />
        );
      })}
    </div>
  );
}
