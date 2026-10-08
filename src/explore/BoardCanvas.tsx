import { useEffect, useRef } from 'react';
import type { Song } from '../lib/song';
import type { Playback } from './playback';
import { drawScene, type Skin } from './render';

export function BoardCanvas({ song, pb, skin, className, style }: {
  song: Song; pb: Playback; skin: Skin; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pbRef = useRef(pb);
  pbRef.current = pb;

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const loop = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth;
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = w * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, w, w, song, pbRef.current, skin, performance.now() / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [song, skin]);

  return <canvas ref={ref} className={className} style={style} />;
}
