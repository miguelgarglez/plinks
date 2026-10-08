<p align="center">
  <img src="docs/launch-poster.png" alt="Plinks — the song of cassiopeia: a walnut bean machine with brass pegs, a scrubbable score rail and a machined control deck" width="720" />
</p>

# Plinks

**Type a word, drop a marble, and physics composes the song of that word.**

**Live → [play-plinks.vercel.app](https://play-plinks.vercel.app)** · [launch video](docs/launch.mp4)

## What it does

Every word is a different song. Type one, and your letters rain through the
pegboard as beads before a marble drops through them — a Galton bean machine
playing a plucked note each time it strikes a peg. The struck pegs keep a
pitch-colored ember, so the board remembers the melody it just played. Landing
in a basin resolves the song on a deep tonic.

The same word always produces the same song: the board, scale, instrument, tempo
and marble path are all derived deterministically from the word itself. `?take=N`
varies the drop without changing the song's identity.

- Type any word (or visit `/<word>` directly — the URL is the song) — each letter
  falls in as a bead you can hear land
- Strum the pegs with your cursor — the board answers even when it's idle
- Press the ember plunger; the drop plays out with peg wobble, pitch-colored
  sparks, dust and a small camera kick
- The settled score is playable — drag the rail to scrub the melody, tap a note
  to re-hear it, or hit replay
- Pull the share ticket: a punched card rises with the word, its line, the note
  strip and the URL — copy the link or save the 1200×630 card
- A machined walnut-and-brass deck holds the word slot, plunger, take dial,
  ticket and a mute knob — a first-run guide teaches it by doing (`?` replays it)
- No network calls, no accounts, no AI — physics and synthesis only

## How it works

The word is normalized to a URL-safe slug, hashed (FNV-1a), and the hash seeds a
mulberry32 RNG that picks the instrument kit, scale, root note, BPM, board
geometry and even each peg's tangential "personality" kick. A fixed-timestep
(1/240s) marble simulation records every peg strike as a note event — pitch from
the peg's position on the scale, velocity from impact speed — plus a final tonic
when it settles in a basin.

Each note is synthesized on impact with Karplus-Strong plucked-string synthesis:
a seeded noise burst rings through a feedback delay line shaped per instrument
(kalimba, marimba, celesta), then passes through a generated exponential-decay
convolution reverb.

Interesting detail: the audio is scheduled at the physical collision time, not a
quantized grid — so what you see is literally what you hear. The same seed
replays the identical performance, which is what makes a shared URL reproduce
the song exactly.

The board itself is alive between drops: typed letters spawn as weighted beads
in a small live physics layer, idle pegs answer the cursor with soft plucks, and
the recorded performance stays mapped to the score rail — scrubbing it replays
each note at its true physical timestamp.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite production build
npx vitest run     # engine determinism tests
npm run lint       # oxlint
```

## Stack

Vite · React 19 · TypeScript · Canvas 2D · Web Audio API (Karplus-Strong +
convolution reverb) · [`web-haptics`](https://haptics.lochie.me) for optional
tactile feedback · fonts self-hosted via @fontsource. Deployed on Vercel.

## Haptics

Plinks calls [`web-haptics`](https://haptics.lochie.me) on DROP, peg notes,
scrub, replay, and share. The library is kept on purpose; feedback is best-effort.

It only feels like something on devices that expose a real vibration path to the
page. In practice that is mostly **Android Chrome** (`navigator.vibrate`).

It will not fire on:

- **iPhone Safari or Chrome** — both use WebKit; there is no Vibration API, and
  the library's checkbox/`switch` fallback is unreliable across iOS versions
- **Mac Safari or Chrome** — no Taptic path for the web in normal browser use

Quick check: open [haptics.lochie.me](https://haptics.lochie.me) on the same
device and browser. If that demo is silent, Plinks will be too. That is a
platform limit, not a wiring bug in this repo.

## License

MIT
