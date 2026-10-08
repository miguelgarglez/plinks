import { useEffect, useRef, useState } from 'react';

const KEY = 'plinks.guide.v1';

export function guideSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked — don't nag every visit
  }
}

export function markGuideSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* private mode — the guide simply won't persist */
  }
}

type Step = {
  sel: string;
  text: string;
  /** ms before the step gives up quietly — dismissal, not advancement */
  timeout: number;
  onlyPhase?: string;
  /** preferred slip positions, tried in order until one fits the viewport */
  prefer: Array<'aside' | 'above' | 'below'>;
};

const STEPS: Step[] = [
  {
    sel: '.deck-slot-block',
    text: 'Type any word — the machine eats the letters.',
    timeout: 16000,
    onlyPhase: 'idle',
    // below before above: above the slot is the rail the word stamps into
    prefer: ['aside', 'below', 'above'],
  },
  {
    sel: '.plunger',
    text: 'Now press the plunger — gravity plays your word.',
    timeout: 16000,
    prefer: ['aside', 'above', 'below'],
  },
  {
    sel: '.score',
    text: 'Drag the score strip — every note under your finger rings. The URL is the song.',
    timeout: 14000,
    onlyPhase: 'settled',
    prefer: ['aside', 'below', 'above'],
  },
];

type Props = {
  phase: string;
  typed: boolean;
  scrubbed: boolean;
  onDone: () => void;
  /** hide without losing the current step — e.g. while the share card is open */
  suspended?: boolean;
};

/**
 * First-run guide: three contextual steps on the real UI, each waiting for
 * the visitor to do the thing — type, press, scrub. A step that times out
 * bows out instead of marching on. Skippable, remembered in localStorage,
 * replayable from the "?" key in the masthead.
 */
export function Guide({ phase, typed, scrubbed, onDone, suspended }: Props) {
  const [ix, setIx] = useState(0);
  const [booted, setBooted] = useState(false);
  const [view, setView] = useState<{ ix: number; x: number; y: number; w: number; h: number } | null>(null);
  const [skipPos, setSkipPos] = useState<{ x: number; y: number } | null>(null);
  const done = useRef(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const [fading, setFading] = useState(false);

  const dismiss = () => {
    if (done.current || fading) return;
    setFading(true);
    markGuideSeen();
    window.setTimeout(() => {
      done.current = true;
      onDone();
    }, 480);
  };

  // Absolute leash: the guide never outlives a minute.
  useEffect(() => {
    const t = setTimeout(dismiss, 60_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A breath of quiet before the first lesson — the machine is the first
  // impression; a small pill bridges the wait.
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Real actions advance the guide; it never advances on a clock alone.
  useEffect(() => {
    if (scrubbed) dismiss();
    else if (phase === 'settled' && ix < 2) setIx(2);
    else if ((phase === 'dropping' || phase === 'replaying') && ix < 2) setIx(2);
    else if (typed && ix === 0) setIx(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, typed, scrubbed, ix]);

  const rect = view && view.ix === ix ? view : null;
  const visible = rect !== null;
  useEffect(() => {
    if (done.current || !visible || !booted) return;
    const t = setTimeout(dismiss, STEPS[ix].timeout);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ix, visible, booted]);

  // Track the target rect every frame — the instrument shifts between phases.
  useEffect(() => {
    if (done.current) return;
    let raf = 0;
    const tick = () => {
      const step = STEPS[ix];
      const el = step ? document.querySelector(step.sel) : null;
      if (el && (!step.onlyPhase || step.onlyPhase === phase)) {
        const r = el.getBoundingClientRect();
        setView({ ix, x: r.left, y: r.top, w: r.width, h: r.height });
      } else {
        setView(null);
        // Between steps the loose skip pill docks in the masthead band —
        // measured against the serial cluster so it can never sit on a
        // machine control. Off-screen masthead (scrolled) → no pill.
        const anchor = document.querySelector('.mast-right');
        const pill = skipRef.current;
        if (anchor && pill) {
          const a = anchor.getBoundingClientRect();
          const w = pill.offsetWidth;
          const x = a.left - w - 14;
          setSkipPos(a.bottom > 0 && x >= 8 ? { x, y: a.top + (a.height - pill.offsetHeight) / 2 } : null);
        } else {
          setSkipPos(null);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ix, phase]);

  if (done.current || suspended) return null;

  // The bridging pill sits just under the word slot.
  if (!booted) {
    const below = window.innerWidth < 560; // above the slot is the letter rail on phones
    return rect ? (
      <div className="guide-mini" style={{ left: rect.x + rect.w / 2, top: below ? rect.y + rect.h + 10 : rect.y - 34 }}>
        type a word, any word
      </div>
    ) : null;
  }

  const step = STEPS[ix];
  if (!step) return null;

  const pad = 7;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tipW = Math.min(250, vw - 32);
  const tipH = tipRef.current?.getBoundingClientRect().height || 104;
  const gap = 14;
  const inside = (x: number, y: number) =>
    x >= 12 && x + tipW <= vw - 12 && y >= 12 && y + tipH <= vh - 12;
  let tipX = vw / 2 - tipW / 2;
  let tipY = vh / 2;
  if (rect) {
    const spots: Record<string, { x: number; y: number }> = {
      // left of the target — lands on open placard space beside the deck,
      // or in the placard column for the score, never over the controls
      aside: { x: rect.x - gap - tipW, y: clamp(rect.y + rect.h / 2 - tipH / 2, 12, vh - tipH - 12) },
      above: { x: clamp(rect.x + rect.w / 2 - tipW / 2, 12, vw - tipW - 12), y: rect.y - gap - tipH },
      below: { x: clamp(rect.x + rect.w / 2 - tipW / 2, 12, vw - tipW - 12), y: rect.y + rect.h + gap },
    };
    const spot = step.prefer.map(p => spots[p]).find(s => inside(s.x, s.y));
    if (spot) ({ x: tipX, y: tipY } = spot);
    else {
      tipX = clamp(spots.below.x, 12, vw - tipW - 12);
      tipY = clamp(spots.below.y, 12, vh - tipH - 12);
    }
  }

  return (
    <div className={`guide${fading ? ' fading' : ''}`}>
      {rect && (
        <svg className="guide-corners" style={{ left: 0, top: 0 }} aria-hidden="true">
          <CornerMarks x={rect.x - pad} y={rect.y - pad} w={rect.w + pad * 2} h={rect.h + pad * 2} />
        </svg>
      )}
      {rect && (
        <div
          ref={tipRef}
          className="guide-tip"
          style={{ left: tipX, top: tipY, width: tipW }}
          role="status"
        >
          <span className="guide-step">step {ix + 1} of {STEPS.length}</span>
          <p>{step.text}</p>
          <button className="guide-skip" onClick={dismiss}>skip</button>
        </div>
      )}
      {!rect && (
        <button
          ref={skipRef}
          className="guide-skip guide-skip-floating"
          style={skipPos ? { left: skipPos.x, top: skipPos.y } : { visibility: 'hidden' }}
          onClick={dismiss}
        >
          skip intro
        </button>
      )}
    </div>
  );
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Four brass corner ticks around the target — a jeweler's mark, not a box. */
function CornerMarks({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const L = 14;
  const c = (cx: number, cy: number, sx: number, sy: number) => (
    <path
      key={`${cx}-${cy}`}
      d={`M ${cx + sx * L} ${cy} L ${cx} ${cy} L ${cx} ${cy + sy * L}`}
      className="guide-corner"
    />
  );
  return (
    <>
      {c(x, y, 1, 1)}
      {c(x + w, y, -1, 1)}
      {c(x, y + h, 1, -1)}
      {c(x + w, y + h, -1, -1)}
    </>
  );
}
