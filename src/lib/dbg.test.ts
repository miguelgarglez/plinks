import { it } from 'vitest';
import { songFor } from './song';
import { simulate } from './physics';
it('dbg', () => {
  for (const w of ['a','plinks','hello-world','zqx','composition','miguel','aria','x','qwerty','nonagon','marble','song']) {
    const s = songFor(w)!;
    const d = simulate(s,1);
    const d2 = simulate(s,2);
    console.log(w.padEnd(12), 'pegs:', s.board.pegs.length, 'ev1:', String(d.events.length).padStart(2), 'ev2:', String(d2.events.length).padStart(2), 'dur:', d.duration.toFixed(2), 'midis:', d.events.map(e=>e.midi).join(','));
  }
});
