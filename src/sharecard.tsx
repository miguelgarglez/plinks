import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Song } from './lib/song';
import type { DropResult } from './lib/physics';
import { KITS, SCALES } from './lib/music';
import { audioEngine } from './playback';
import { ramp } from './board';
import { shareCardPng } from './share';

/**
 * The share card, composed live: the plate slides in, the word stamps letter
 * by letter, and every note drops onto the rail with its own plink. Then it
 * hands over the send / copy / save actions. This is the thing a visitor
 * screen-records, so the card is DOM, not the exported PNG.
 */
export function ShareCard({ song, drop, take, onClose }: {
  song: Song;
  drop: DropResult;
  take: number;
  onClose: () => void;
}) {
  const [dots, setDots] = useState(0);
  const [msg, setMsg] = useState('');
  const timers = useRef<number[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  const evs = drop.events;
  const lastT = evs.length ? evs[evs.length - 1].t : 1;
  const midis = song.board.pegs.map(p => p.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);
  const url = `${location.origin}/${song.word}${take > 1 ? `?take=${take}` : ''}`;

  // letter thunks, then the score plays itself onto the card
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    audioEngine.unlock();
    audioEngine.setKit(song.kit);
    song.word.toUpperCase().split('').forEach((_, i) => {
      timers.current.push(window.setTimeout(() => audioEngine.knock(0, 340 + i * 12, 0.045), 90 + i * 75));
    });
    const startAt = 120 + song.word.length * 75;
    const step = Math.min(85, 1400 / Math.max(1, evs.length));
    evs.forEach((e, i) => {
      timers.current.push(window.setTimeout(() => {
        setDots(i + 1);
        if (audioEngine.ready && !audioEngine.muted) audioEngine.strike(e.midi, 0.28);
      }, startAt + i * step));
    });
    cardRef.current?.focus();
    return () => {
      timers.current.forEach(clearTimeout);
      prevFocus?.focus?.(); // hand the ticket back to the finger that pulled it
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // real dialog behaviour: Tab loops inside the plate, Escape folds it away
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key !== 'Tab' || !cardRef.current) return;
    const els = cardRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    const active = document.activeElement;
    // the plate itself holds initial focus — treat it as past-the-end so
    // Shift+Tab wraps to the last control and Tab wraps to the first
    if (e.shiftKey && (active === first || active === cardRef.current)) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && (active === last || active === cardRef.current)) { first.focus(); e.preventDefault(); }
  };

  const flash = (m: string) => {
    setMsg(m);
    timers.current.push(window.setTimeout(() => setMsg(''), 2200));
  };

  const send = async () => {
    try {
      const blob = await shareCardPng(song, drop, take);
      const file = new File([blob], `the-song-of-${song.word}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `the song of ${song.word}`, url });
        flash('sent');
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('link copied');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      flash('sharing failed');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      flash('link copied');
    } catch {
      flash('copy failed');
    }
  };

  const save = async () => {
    try {
      const blob = await shareCardPng(song, drop, take);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `the-song-of-${song.word}.png`;
      a.click();
      timers.current.push(window.setTimeout(() => URL.revokeObjectURL(href), 4000));
      flash('card saved');
    } catch {
      flash('save failed');
    }
  };

  return createPortal(
    <div className="veil" onClick={onClose}>
      <div
        className="share-plate"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share card for the song of ${song.word}`}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="share-perf" aria-hidden="true" />
        <div className="share-head">
          <span>P L I N K S</span>
          <span className="share-head-end">
            <span>no. {song.serial}</span>
            <button type="button" className="screw-close" onClick={onClose} aria-label="Close share card">
              <span className="screw-cross" aria-hidden="true" />
            </button>
          </span>
        </div>
        <h2 className="share-title">
          the song of{' '}
          <em>
            {song.word.toUpperCase().split('').map((ch, i) => (
              <span key={i} className="share-letter" style={{ animationDelay: `${90 + i * 75}ms` }}>
                {ch}
              </span>
            ))}
          </em>
        </h2>
        <p className="share-epithet">{song.epithet}</p>
        <p className="share-meta">
          {KITS[song.kit].name} · {SCALES[song.scale].name} · {song.bpm} bpm{take > 1 ? ` · take ${take}` : ''}
        </p>
        <div className="share-rail" aria-hidden="true">
          <div className="share-rule" />
          {evs.slice(0, dots).map((e, i) => {
            const u = hi > lo ? (e.midi - lo) / (hi - lo) : 0.5;
            return (
              <span
                key={i}
                className={`share-dot${e.pegId === -1 ? ' share-dot-tonic' : ''}`}
                style={{
                  left: `${4 + (e.t / Math.max(lastT, 0.001)) * 92}%`,
                  top: `${50 - (u - 0.5) * 70}%`,
                  '--dot-color': e.pegId === -1 ? '#E4573C' : ramp(u),
                } as React.CSSProperties}
              />
            );
          })}
        </div>
        <p className="share-url">{location.host}/{song.word}{take > 1 ? `?take=${take}` : ''}</p>

        <div className="sc-controls">
          <button type="button" className="sc-send" onClick={send} aria-label="Send this song">
            <span className="sc-send-cap">send</span>
            <span className="sc-send-collar" aria-hidden="true" />
          </button>
          <span className="sc-stud-wrap">
            <button type="button" className="sc-stud" onClick={copy} aria-label="Copy the song link">
              <svg className="sc-stud-icon" viewBox="-2 -2 20 20" width="16" height="16" aria-hidden="true">
                <path d="M6.5 9.5l3-3M5 11.5l-1.8 1.8a2.3 2.3 0 1 1-3.2-3.2L3.5 6.5a2.3 2.3 0 0 1 3.2 0M11 4.5l1.8-1.8a2.3 2.3 0 1 1 3.2 3.2L12.5 9.5a2.3 2.3 0 0 1-3.2 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <span className="sc-stud-label">{msg === 'link copied' ? 'copied' : 'link'}</span>
          </span>
          <span className="sc-stud-wrap">
            <button type="button" className="sc-stud" onClick={save} aria-label="Save the card as an image">
              <svg className="sc-stud-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M8 2v8M4.5 7 8 10.5 11.5 7M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="sc-stud-label">{msg === 'card saved' ? 'saved' : 'png'}</span>
          </span>
        </div>
        {msg && <p className="share-status" role="status">{msg}</p>}
      </div>
    </div>,
    document.body,
  );
}
