import { songFor } from './lib/song';
import { simulate } from './lib/physics';
import { KITS, SCALES } from './lib/music';
import { ramp } from './board';

// Static 1200×630 OG card, screenshot from /og into public/og.png.
export function OgCard() {
  const song = songFor('plinks')!;
  const drop = simulate(song, 1);
  const evs = drop.events;
  const lastT = evs.length ? evs[evs.length - 1].tGrid : 1;
  const midis = evs.map(e => e.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);

  return (
    <div style={{
      width: 1200, height: 630, background: '#EFE7DA', color: '#241b10',
      fontFamily: '"Space Mono", monospace', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 28, border: '2px solid #241b10' }} />
      <div style={{
        position: 'absolute', top: 60, left: 60, right: 60,
        display: 'flex', justifyContent: 'space-between',
        fontSize: 20, letterSpacing: '0.28em', color: '#6b5c4a',
        borderBottom: '1.5px solid #241b10', paddingBottom: 14,
      }}>
        <span style={{ fontFamily: 'Fraunces, serif', fontWeight: 640, fontSize: 26, letterSpacing: '0.06em', color: '#241b10' }}>Plinks</span>
        <span>GENERATIVE BEAN MACHINE</span>
      </div>
      <div style={{ position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontWeight: 560, fontSize: 88 }}>
          the song of <em>plinks</em>
        </div>
        <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 28, color: '#5a4a34', marginTop: 12 }}>
          {song.epithet}
        </div>
        <div style={{ fontSize: 19, color: '#6b5c4a', marginTop: 16, letterSpacing: '0.08em' }}>
          no. {song.serial} · {KITS[song.kit].name} · {SCALES[song.scale].name} · {song.bpm} bpm
        </div>
      </div>
      <svg width="1200" height="180" style={{ position: 'absolute', bottom: 92, left: 0 }}>
        <line x1="110" y1="90" x2="1090" y2="90" stroke="rgba(36,27,16,0.25)" />
        {evs.map((e, i) => {
          const u = hi > lo ? (e.midi - lo) / (hi - lo) : 0.5;
          const x = 110 + (e.tGrid / Math.max(lastT, 0.001)) * 980;
          const y = 90 - (u - 0.5) * 96;
          return <circle key={i} cx={x} cy={y} r={e.pegId === -1 ? 9 : 6.5} fill={e.pegId === -1 ? '#E4573C' : ramp(u)} />;
        })}
      </svg>
      <div style={{
        position: 'absolute', bottom: 42, left: 0, right: 0, textAlign: 'center',
        fontSize: 22, fontWeight: 600, letterSpacing: '0.04em',
      }}>
        type a word · a marble falls · it sings
      </div>
    </div>
  );
}
