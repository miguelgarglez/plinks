import { useRef, useState } from 'react';
import { normalizeWord } from './lib/song';

/**
 * The machined control deck: a walnut plate faced in brass, holding a word
 * slot, an ember drop plunger, a knurled take dial, a pilot lamp that glows
 * while the marble is in play, a perforated share ticket and the sound knob.
 * Everything has travel — press states sink, the dial spins on a detent,
 * the ticket shears. No outlined rectangles.
 */
export function Deck({
  input,
  setInput,
  onSubmit,
  phase,
  word,
  take,
  onTake,
  onShare,
  muted,
  onMute,
  spec,
  fresh,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  phase: string;
  word: string;
  take: number;
  onTake: () => void;
  onShare: () => void;
  muted: boolean;
  onMute: () => void;
  spec: string;
  fresh: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropping = phase === 'dropping' || phase === 'replaying';
  const finePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

  // the plunger's travel: it sinks on the press, then springs back once the
  // marble has cleared the chute — the pilot lamp keeps the running state
  const [engaged, setEngaged] = useState(false);
  const engage = () => {
    setEngaged(true);
    window.setTimeout(() => setEngaged(false), 700);
  };

  return (
    <form
      className={`deck${fresh ? ' fresh' : ''}`}
      onSubmit={onSubmit}
      aria-label="Instrument controls"
    >
      <div className="deck-feed">
        <div className="deck-slot-block">
          <label className="deck-label" htmlFor="word-slot">word</label>
          <input
            ref={inputRef}
            id="word-slot"
            className="slot"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !finePointer) inputRef.current?.blur(); }}
            placeholder="type a word"
            aria-label="A word to compose a song from"
            autoFocus={finePointer}
            maxLength={32}
            spellCheck={false}
            autoComplete="off"
            enterKeyHint="go"
          />
        </div>

        <button
          type="submit"
          className={`plunger${engaged ? ' is-down' : ''}`}
          onClick={engage}
          disabled={dropping}
          aria-label={input.trim() && normalizeWord(input) !== word ? 'Compose and drop the marble' : 'Drop the marble'}
        >
          <span className="plunger-cap">
            {dropping ? 'playing' : input.trim() && normalizeWord(input) !== word ? 'compose' : 'drop'}
          </span>
          <span className="plunger-collar" aria-hidden="true" />
        </button>
      </div>

      <div className="deck-pair">
        <div className="deck-cluster">
          <button
            type="button"
            className="dial"
            onClick={onTake}
            disabled={dropping}
            title="Same song, different fall"
            aria-label={`Variation ${take}. Advance to the next take`}
          >
            <span className="dial-face" style={{ transform: `rotate(${take * -40}deg)` }}>
              <span className="dial-notch" />
            </span>
            <span className="dial-num">t{take}</span>
          </button>
          <span className="deck-label">variation</span>
        </div>

        <div className="deck-cluster pilot-cluster">
          <span className={`pilot${dropping ? ' lit' : ''}`} aria-hidden="true">
            <span className="pilot-lamp" />
          </span>
          <span className="deck-label">in play</span>
        </div>

        <span className="mute-wrap">
          <button
            type="button"
            className={`mute ${muted ? 'is-muted' : ''}`}
            onClick={onMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
          >
            <span className="mute-dot" />
          </button>
          <span className={`mute-lamp${muted ? '' : ' on'}`} aria-hidden="true" />
          <span className="deck-label">sound</span>
        </span>
      </div>

      <div className="deck-foot">
        <button type="button" className="ticket" onClick={onShare} disabled={dropping} aria-label="Share this song">
          <span className="ticket-perf" aria-hidden="true" />
          <span className="ticket-text">share</span>
        </button>
        <div className="deck-spec">{spec}</div>
      </div>
    </form>
  );
}
