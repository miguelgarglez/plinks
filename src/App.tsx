import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { songFor, normalizeWord } from './lib/song';
import { usePlayback, audioEngine } from './playback';
import { Board } from './board';
import { Rail, ScoreRail } from './components';
import { shareSong } from './share';
import { KITS, SCALES } from './lib/music';
import { rng } from './lib/hash';

function pathWord(): { word: string; valid: boolean } {
  let raw = '';
  try {
    raw = decodeURIComponent(window.location.pathname.replace(/^\//, ''));
  } catch {
    return { word: 'plinks', valid: false };
  }
  if (!raw) return { word: 'plinks', valid: true };
  const w = normalizeWord(raw);
  return { word: w || 'plinks', valid: !!w };
}

const MAX_TAKE = 99;
function parseTake(search: string): number {
  const t = parseInt(new URLSearchParams(search).get('take') ?? '1', 10);
  return Number.isFinite(t) ? Math.min(Math.max(t, 1), MAX_TAKE) : 1;
}

export default function App() {
  const [route, setRoute] = useState(() => pathWord());
  const [input, setInput] = useState('');
  const [take, setTake] = useState(() => parseTake(location.search));
  const [muted, setMuted] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const finePointer = useMemo(() => window.matchMedia('(pointer: fine)').matches, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const song = useMemo(() => songFor(route.word), [route.word]);
  const pb = usePlayback(song!, take);
  const lastActivity = useRef(performance.now() / 1000);

  useEffect(() => {
    const onPop = () => {
      setRoute(pathWord());
      setTake(parseTake(location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // idle ping: after 12s of stillness a peg rings softly, like the board is waiting
  useEffect(() => {
    if (!song) return;
    const id = setInterval(() => {
      const idleFor = performance.now() / 1000 - lastActivity.current;
      if (idleFor > 12 && document.visibilityState === 'visible' && pb.phase !== 'dropping') {
        const r = rng(song.seed ^ Math.floor(performance.now() / 4000));
        const p = song.board.pegs[Math.floor(r() * song.board.pegs.length)];
        pb.ping(p.id, p.midi);
        lastActivity.current = performance.now() / 1000 - 6; // next ping sooner
      }
    }, 3000);
    return () => clearInterval(id);
  }, [song, pb]);

  const drop = useCallback(() => {
    lastActivity.current = performance.now() / 1000;
    pb.start();
  }, [pb]);

  const wantDrop = useRef(false);
  const navigate = useCallback((w: string, t = 1, autoplay = false) => {
    const norm = normalizeWord(w);
    const url = `/${norm}${t > 1 ? `?take=${t}` : ''}`;
    if (norm !== route.word || t !== take) {
      history.pushState(null, '', url);
      if (autoplay) wantDrop.current = true; // play once the new drop is built
      setRoute({ word: norm || 'plinks', valid: !!norm });
      setTake(t);
      setShareMsg('');
    } else if (autoplay) {
      drop();
    }
  }, [route.word, take, drop]);

  const anotherTake = useCallback(() => {
    const next = Math.min(take + 1, MAX_TAKE);
    history.replaceState(null, '', `/${route.word}?take=${next}`);
    wantDrop.current = true;
    setTake(next);
    lastActivity.current = performance.now() / 1000;
  }, [take, route.word]);

  // when the song or take changes the drop rebuilds; if the user asked, play it
  useEffect(() => {
    if (wantDrop.current && pb.phase === 'idle') {
      wantDrop.current = false;
      pb.start();
    }
  }, [pb]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finePointer) inputRef.current?.blur(); // hand the view back to the board
    if (!input.trim()) { drop(); return; }
    navigate(input, 1, true);
  };

  const toggleMute = () => {
    audioEngine.unlock();
    const m = !muted;
    setMuted(m);
    audioEngine.setMuted(m);
    lastActivity.current = performance.now() / 1000;
  };

  const doShare = async () => {
    if (!song) return;
    try {
      const how = await shareSong(song, pb.drop, take);
      if (how === 'cancelled') return;
      setShareMsg(how === 'shared' ? 'sent' : how === 'copied' ? 'link copied' : 'card saved');
    } catch {
      setShareMsg('sharing failed');
    }
    setTimeout(() => setShareMsg(''), 2400);
  };

  if (!route.valid || !song) {
    return (
      <div className="page">
        <header className="masthead">
          <a className="brand" href="/">Plinks</a>
          <span className="mast-mid">generative bean machine</span>
          <span className="mast-right">est. 2026</span>
        </header>
        <main className="fell">
          <div className="plate fell-plate">
            <p className="fell-cap">PLATE ∅</p>
            <h1 className="fell-title">that word fell<br />between the pegs</h1>
            <p className="fell-copy">Nothing to compose from. Letters, numbers and hyphens only.</p>
            <a className="btn" href="/">back to the board</a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="masthead">
        <a className="brand" href="/">Plinks</a>
        <span className="mast-mid">generative bean machine</span>
        <span className="mast-right">no. {song.serial}</span>
      </header>

      <main className="hero">
        <h1 className="title">the song of <em key={song.word} className="word-em">{song.word}</em></h1>
        <p className="epithet">{song.epithet}</p>
        <p className="meta">
          {KITS[song.kit].name} · {SCALES[song.scale].name} · {song.bpm} bpm
          {take > 1 && <> · take {take}</>}
        </p>
      </main>

      <section className="instrument" aria-label="The bean machine">
        <Rail word={song.word} />
        <div className="board-wrap">
          <Board song={song} pb={pb} onDrop={drop} />
        </div>
        <ScoreRail song={song} drop={pb.drop} pb={pb} />
      </section>

      <form className="controls" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          className="word-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="type a word"
          aria-label="A word to compose a song from"
          autoFocus={finePointer}
          maxLength={32}
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="go"
        />
        <button type="submit" className="btn primary">
          {pb.phase === 'dropping' ? 'falling…' : input.trim() ? 'compose' : 'drop'}
        </button>
        <button type="button" className="btn" onClick={() => { anotherTake(); }} disabled={pb.phase === 'dropping'} title="Same song, different drop">
          take {take} ↺
        </button>
        <button type="button" className="btn" onClick={doShare}>share</button>
        <span className="mute-wrap">
          <button
            type="button"
            className={`mute ${muted ? 'is-muted' : ''}`}
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
          >
            <span className="mute-dot" />
          </button>
          <span className="mute-tag">sound</span>
        </span>
      </form>
      {shareMsg && <p className="share-msg" role="status">{shareMsg}</p>}
      <p className="sr-only" role="status">
        {pb.landedAt !== null && pb.phase === 'settled'
          ? `The marble landed in pocket ${pb.drop.basin + 1}; the melody had ${pb.drop.events.length} notes.`
          : pb.phase === 'dropping' ? 'The marble is falling.' : ''}
      </p>

      <footer className="footer">
        <span>no network · no account · just physics</span>
        <a href="https://github.com/miguelgarglez/plinks" target="_blank" rel="noreferrer">source</a>
      </footer>
    </div>
  );
}
