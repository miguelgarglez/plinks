import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { songFor, normalizeWord } from './lib/song';
import { usePlayback, audioEngine } from './playback';
import { Board } from './board';
import { Rail, ScoreRail } from './components';
import { Deck } from './deck';
import { ShareCard } from './sharecard';
import { Guide, guideSeen, markGuideSeen } from './guide';
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
  const [showCard, setShowCard] = useState(false);
  const [guideOn, setGuideOn] = useState(() => !guideSeen());
  const [typed, setTyped] = useState(false);
  const [scrubbed, setScrubbed] = useState(false);
  const beadQueue = useRef({ q: [] as string[] });
  const dropTimer = useRef(0);
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
      if (idleFor > 12 && document.visibilityState === 'visible' && pb.phase !== 'dropping' && pb.phase !== 'replaying') {
        const r = rng(song.seed ^ Math.floor(performance.now() / 4000));
        const p = song.board.pegs[Math.floor(r() * song.board.pegs.length)];
        pb.ping(p.id, p.midi);
        lastActivity.current = performance.now() / 1000 - 6; // next ping sooner
      }
    }, 3000);
    return () => clearInterval(id);
  }, [song, pb]);

  // the plunger clacks, then gravity gets the marble — 140ms of anticipation
  const drop = useCallback(() => {
    if (pb.phase === 'dropping' || pb.phase === 'replaying') return;
    lastActivity.current = performance.now() / 1000;
    audioEngine.unlock();
    audioEngine.knock(0, 200, 0.3);
    window.clearTimeout(dropTimer.current);
    dropTimer.current = window.setTimeout(() => pb.start(), 140);
  }, [pb]);

  // a route/take change retires the pending plunger timer — no ghost drops
  useEffect(() => {
    window.clearTimeout(dropTimer.current);
  }, [route.word, take]);

  const wantDrop = useRef(false);
  const navigate = useCallback((w: string, t = 1, autoplay = false) => {
    const norm = normalizeWord(w);
    const url = `/${norm}${t > 1 ? `?take=${t}` : ''}`;
    if (norm !== route.word || t !== take) {
      history.pushState(null, '', url);
      if (autoplay) wantDrop.current = true; // play once the new drop is built
      setRoute({ word: norm || 'plinks', valid: !!norm });
      setTake(t);
    } else if (autoplay) {
      drop();
    }
  }, [route.word, take, drop]);

  const anotherTake = useCallback(() => {
    const next = Math.min(take + 1, MAX_TAKE);
    history.replaceState(null, '', `/${route.word}?take=${next}`);
    wantDrop.current = true;
    audioEngine.tick(1500, 0.07); // dial detent
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

  // typing feeds the machine: each new letter rains a bead through the pegs
  const onType = (v: string) => {
    if (v.length > input.length) {
      const added = v.slice(input.length);
      for (const ch of added.toUpperCase().slice(0, 8)) {
        if (/[A-Z0-9\-']/.test(ch)) beadQueue.current.q.push(ch);
      }
      if (!typed) setTyped(true);
    }
    setInput(v);
    lastActivity.current = performance.now() / 1000;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finePointer) (document.activeElement as HTMLElement)?.blur(); // hand the view back to the board
    setTyped(true);
    if (!input.trim()) { drop(); return; }
    audioEngine.unlock();
    audioEngine.knock(0, 200, 0.3);
    navigate(input, 1, true);
  };
  const finePointer = useMemo(() => window.matchMedia('(pointer: fine)').matches, []);

  const toggleMute = () => {
    audioEngine.unlock();
    const m = !muted;
    setMuted(m);
    audioEngine.setMuted(m);
    lastActivity.current = performance.now() / 1000;
  };

  const openShare = () => {
    if (!song) return;
    audioEngine.unlock();
    audioEngine.tear(); // the ticket shears off its perf edge
    lastActivity.current = performance.now() / 1000;
    setShowCard(true);
  };

  const replayGuide = () => {
    markGuideSeen();
    setTyped(false);
    setScrubbed(false);
    setGuideOn(false);
    requestAnimationFrame(() => setGuideOn(true));
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
            <a className="plate-btn" href="/">back to the board</a>
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
        <span className="mast-right">
          no. {song.serial}
          <button
            type="button"
            className="q-key"
            onClick={replayGuide}
            aria-label="Replay the first-run guide"
            title="How it works"
          >?</button>
        </span>
      </header>

      <main className="stage">
        <div className="hero">
          <h1 className="title">the song of <em key={song.word} className="word-em">{song.word}</em></h1>
          <p className="epithet">{song.epithet}</p>
          <p className="meta">no. {song.serial} · deterministic physics · same word, same song</p>
        </div>

        <section className="machine" aria-label="The bean machine">
          <Rail word={song.word} />
          <div className="board-wrap">
            <Board song={song} pb={pb} onDrop={drop} beadQueue={beadQueue} />
          </div>
          <ScoreRail song={song} drop={pb.drop} pb={pb} onScrub={() => setScrubbed(true)} />
          <Deck
            input={input}
            setInput={onType}
            onSubmit={onSubmit}
            phase={pb.phase}
            word={song.word}
            take={take}
            onTake={anotherTake}
            onShare={openShare}
            muted={muted}
            onMute={toggleMute}
            spec={`${KITS[song.kit].name} · ${SCALES[song.scale].name} · ${song.bpm} bpm${take > 1 ? ` · take ${take}` : ''}`}
            fresh={pb.phase === 'idle' && !input.trim()}
          />
        </section>
      </main>

      <p className="sr-only" role="status">
        {pb.landedAt !== null && pb.phase === 'settled'
          ? `The marble landed in pocket ${pb.drop.basin + 1}; the melody had ${pb.drop.events.length} notes.`
          : pb.phase === 'dropping' ? 'The marble is falling.' : ''}
      </p>

      <footer className="footer">
        <span>no network · no account · just physics</span>
        <a href="https://github.com/miguelgarglez/plinks" target="_blank" rel="noreferrer">source</a>
      </footer>

      {guideOn && (
        <Guide
          suspended={showCard}
          phase={pb.phase}
          typed={typed || input.trim().length > 0}
          scrubbed={scrubbed}
          onDone={() => setGuideOn(false)}
        />
      )}

      {showCard && (
        <ShareCard song={song} drop={pb.drop} take={take} onClose={() => setShowCard(false)} />
      )}
    </div>
  );
}
