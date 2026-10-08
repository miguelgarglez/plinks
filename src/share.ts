import type { Song } from './lib/song';
import type { DropResult } from './lib/physics';
import { KITS, SCALES } from './lib/music';
import { ramp } from './board';

// Share card: 1200×630 canvas — word, score, serial, in the product identity.
export async function shareCardPng(song: Song, drop: DropResult, take: number): Promise<Blob> {
  await document.fonts.ready;
  const W = 1200, H = 630;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;

  // bone paper
  ctx.fillStyle = '#EFE7DA';
  ctx.fillRect(0, 0, W, H);
  // subtle border plate
  ctx.strokeStyle = '#241b10';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);

  // masthead
  ctx.fillStyle = '#6b5c4a';
  ctx.font = '20px "Space Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('P L I N K S', 60, 82);
  ctx.textAlign = 'right';
  ctx.fillText('GENERATIVE BEAN MACHINE', W - 60, 82);
  ctx.strokeStyle = '#241b10';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 104); ctx.lineTo(W - 60, 104); ctx.stroke();

  // title — shrink until it fits the plate
  ctx.textAlign = 'center';
  ctx.fillStyle = '#241b10';
  const title = `the song of ${song.word}`;
  let titleSize = 92;
  do {
    ctx.font = `italic 560 ${titleSize}px Fraunces, serif`;
    titleSize -= 4;
  } while (titleSize > 24 && ctx.measureText(title).width > W - 160);
  ctx.fillText(title, W / 2, 230);

  // epithet + meta
  ctx.fillStyle = '#5a4a34';
  ctx.font = 'italic 400 28px Fraunces, serif';
  ctx.fillText(song.epithet, W / 2, 285);
  ctx.fillStyle = '#6b5c4a';
  ctx.font = '19px "Space Mono", monospace';
  ctx.fillText(
    `no. ${song.serial} · ${KITS[song.kit].name} · ${SCALES[song.scale].name} · ${song.bpm} bpm${take > 1 ? ` · take ${take}` : ''}`,
    W / 2, 330,
  );

  // score rail
  const evs = drop.events;
  const lastT = evs.length ? evs[evs.length - 1].t : 1;
  const midis = song.board.pegs.map(p => p.midi);
  const lo = Math.min(...midis), hi = Math.max(...midis);
  const sx0 = 110, sx1 = W - 110, sy = 440, sh = 120;
  ctx.strokeStyle = 'rgba(36,27,16,0.25)';
  ctx.beginPath(); ctx.moveTo(sx0, sy); ctx.lineTo(sx1, sy); ctx.stroke();
  for (const e of evs) {
    const u = hi > lo ? (e.midi - lo) / (hi - lo) : 0.5;
    const x = sx0 + (e.t / Math.max(lastT, 0.001)) * (sx1 - sx0);
    const y = sy + (u - 0.5) * -sh * 0.8;
    ctx.fillStyle = e.pegId === -1 ? '#E4573C' : ramp(u);
    ctx.beginPath();
    ctx.arc(x, y, e.pegId === -1 ? 9 : 6.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // url — the exact route, so the card reproduces this take
  ctx.fillStyle = '#241b10';
  ctx.font = '600 22px "Space Mono", monospace';
  ctx.fillText(`${location.host}/${song.word}${take > 1 ? `?take=${take}` : ''}`, W / 2, 556);

  const blob = await new Promise<Blob | null>(res => cv.toBlob(res, 'image/png'));
  if (!blob) throw new Error('card render failed');
  return blob;
}


