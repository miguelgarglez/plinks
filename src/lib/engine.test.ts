import { describe, it, expect } from 'vitest';
import { songFor, normalizeWord } from './song';
import { simulate } from './physics';

describe('engine', () => {
  it('same word → same events, twice', () => {
    const s = songFor('miguel')!;
    const a = simulate(s, 1);
    const b = simulate(s, 1);
    expect(a.events.map(e => [e.pegId, e.tGrid, e.midi])).toEqual(
      b.events.map(e => [e.pegId, e.tGrid, e.midi]),
    );
  });

  it('different words → different melodies', () => {
    const a = simulate(songFor('aria')!, 1);
    const b = simulate(songFor('brutus')!, 1);
    const sig = (e: typeof a.events) => e.map(x => x.midi).join(',');
    expect(sig(a.events)).not.toEqual(sig(b.events));
  });

  it('take 2 is a different drop for the same word', () => {
    const s = songFor('miguel')!;
    const a = simulate(s, 1);
    const b = simulate(s, 2);
    expect(a.events.map(e => e.pegId).join(',')).not.toEqual(
      b.events.map(e => e.pegId).join(','),
    );
  });

  it('produces a melody of usable length for many words', () => {
    for (const w of ['a', 'plinks', 'hello-world', 'zqx', 'composition']) {
      const s = songFor(w)!;
      const d = simulate(s, 1);
      expect(d.events.length).toBeGreaterThanOrEqual(3);
      expect(d.duration).toBeLessThan(8);
    }
  });

  it('normalizeWord strips to url-safe', () => {
    expect(normalizeWord('  Héllo Wörld! ')).toBe('hello-world');
    expect(normalizeWord('')).toBe('');
  });
});
