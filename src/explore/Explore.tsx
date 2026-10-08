import { useMemo, useState } from 'react';
import { songFor } from '../lib/song';
import { usePlayback } from './playback';
import { BoardCanvas } from './BoardCanvas';
import { ScoreStrip } from './ScoreStrip';
import { KITS, SCALES } from '../lib/music';
import { skinA, skinB, skinC } from './skins';
import './explore.css';

function useSong() {
  const [word, setWord] = useState('miguel');
  const [take, setTake] = useState(1);
  const song = useMemo(() => songFor(word) ?? songFor('plinks')!, [word]);
  return { word, setWord, song, take, setTake };
}

function Controls({ word, setWord, onDrop, phase }: {
  word: string; setWord: (w: string) => void; onDrop: () => void; phase: string;
}) {
  return (
    <div className="controls">
      <input
        className="word-input"
        value={word}
        onChange={e => setWord(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onDrop()}
        placeholder="a word"
        aria-label="Word to compose from"
      />
      <button className="drop-btn" onClick={onDrop} disabled={phase === 'dropping'}>
        {phase === 'dropping' ? '…' : 'Drop'}
      </button>
    </div>
  );
}

function Meta({ song }: { song: ReturnType<typeof songFor> }) {
  if (!song) return null;
  return (
    <div className="meta">
      composition no. {song.serial}<br />
      {KITS[song.kit].name} · {SCALES[song.scale].name} · {song.bpm} bpm
    </div>
  );
}

export function ExploreA() {
  const { word, setWord, song, take } = useSong();
  const pb = usePlayback(song, take);
  const drop = () => { if (pb.phase !== 'dropping') pb.start(); };
  return (
    <div className="xp xp-a">
      <div className="mast">
        <h1>the song of {song.word}</h1>
        <div className="sub">plink</div>
      </div>
      <div className="rail">{song.word}</div>
      <div className="board-wrap"><BoardCanvas song={song} pb={pb} skin={skinA} /></div>
      <div className="under"><ScoreStrip drop={pb.drop} skin={skinA} /></div>
      <div className="epithet">{song.epithet}</div>
      <div className="serial">composition no. {song.serial} · {KITS[song.kit].name} · {SCALES[song.scale].name} · {song.bpm} bpm</div>
      <Controls word={word} setWord={setWord} onDrop={drop} phase={pb.phase} />
    </div>
  );
}

export function ExploreB() {
  const { word, setWord, song, take } = useSong();
  const pb = usePlayback(song, take);
  const drop = () => { if (pb.phase !== 'dropping') pb.start(); };
  return (
    <div className="xp xp-b">
      <div className="left">
        <div className="kicker">plinks · generative bean machine</div>
        <h1>the song<br />of {song.word}</h1>
        <div className="epithet">{song.epithet}</div>
        <Meta song={song} />
        <Controls word={word} setWord={setWord} onDrop={drop} phase={pb.phase} />
        <ScoreStrip drop={pb.drop} skin={skinB} />
      </div>
      <div className="right"><BoardCanvas song={song} pb={pb} skin={skinB} /></div>
    </div>
  );
}

export function ExploreC() {
  const { word, setWord, song, take } = useSong();
  const pb = usePlayback(song, take);
  const drop = () => { if (pb.phase !== 'dropping') pb.start(); };
  return (
    <div className="xp xp-c">
      <div className="masthead"><span>Plinks</span><span>Generative bean machine</span><span>Est. 2026</span></div>
      <div className="plate">
        <div className="plate-cap"><span>Plate I.</span><span>the instrument</span></div>
        <BoardCanvas song={song} pb={pb} skin={skinC} />
      </div>
      <div className="program">
        <h1>The Song of <em>{song.word}</em></h1>
        <div className="epithet">{song.epithet}</div>
        <div className="rule" />
        <Meta song={song} />
      </div>
      <div className="score-strip" style={{ position: 'relative' }}>
        <ScoreStrip drop={pb.drop} skin={skinC} />
      </div>
      <Controls word={word} setWord={setWord} onDrop={drop} phase={pb.phase} />
    </div>
  );
}
