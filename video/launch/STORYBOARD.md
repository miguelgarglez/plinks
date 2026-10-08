---
format: 1920x1080
duration: 30.4s
message: "type a word, drop a marble — the board plays it back"
arc: Hook → Feed → Press → Play → Share → URL
audience: makers and web-toy collectors on X
mode: autonomous
music: none
---

## Frame 1 — The board eats your letters

- scene: Cold open on the real instrument — peg field idling, then each typed letter rains in as a bead through the pegs
- duration: 4.6s
- poster: 3s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html
- asset_candidates: assets/session-1080.mp4 — [video] 33.9s real product session at 1920x1080: idle, typing beads, peg strum, plunger drop, score scrub, share ticket

Footage session-1080.mp4, media_start 0s → 4.6s, full-bleed. The product column is centered and narrow — the left third is open bone paper for type.

Text (seek-safe, GSAP):
- kicker (Space Mono, upper, ember): "PLINKS" — fades in at 0.2s, top-left safe zone.
- headline (Fraunces italic, ink, ~72px, lower-left): "type a word — the board eats it" — rises in 0.5–1.5s, ease-out.

## Frame 2 — Every peg answers

- scene: Beads settle in the basin; the cursor sweeps the peg field and the pegs ping back
- duration: 6.0s
- poster: 2s
- transition_in: cut
- src: compositions/frames/02-strum.html
- asset_candidates: assets/session-1080.mp4

Footage session-1080.mp4, media_start 4.6s → 10.6s, full-bleed, continuous with frame 1.

Text: one mono label lower-left, "strum it — every peg answers", Space Mono 24px ember, in at 0.3s, out at -0.6s before cut.

handoff_in: session-1080.mp4, full-bleed, scale 1, playing continuously from 4.6s
handoff_out: same, at media time 10.6s

## Frame 3 — Physics writes the melody

- scene: The plunger presses; the marble drops through the pegs leaving its trail — sparks and wobble on every strike
- duration: 6.2s
- poster: 4s
- transition_in: cut
- src: compositions/frames/03-drop.html
- asset_candidates: assets/session-1080.mp4

Footage session-1080.mp4, media_start 15.4s → 21.6s, full-bleed (jump cut past the idle hold — the press lands right after the cut).

Text: mono label lower-left, "press — physics writes the melody", in at 0.3s, out at -0.6s.

## Frame 4 — The score is playable

- scene: The melody settles into a note rail; a drag scrubs it back and forth, replaying notes by hand
- duration: 4.4s
- poster: 2s
- transition_in: cut
- src: compositions/frames/04-scrub.html
- asset_candidates: assets/session-1080.mp4

Footage session-1080.mp4, media_start 21.9s → 26.3s, full-bleed.

Text: mono label lower-left, "the score is an instrument — drag it", in at 0.3s, out at -0.6s.

## Frame 5 — The ticket prints itself

- scene: The share ticket pulls a punched card up over the instrument — word, line, note strip, URL
- duration: 4.6s
- poster: 3s
- transition_in: cut
- src: compositions/frames/05-ticket.html
- asset_candidates: assets/session-1080.mp4

Footage session-1080.mp4, media_start 26.8s → 31.4s, full-bleed.

Text: mono label lower-left, "share it — the ticket prints itself", in at 0.3s, out at -0.6s.

## Frame 6 — URL

- scene: Walnut end card — product name, one line, the URL in ember
- duration: 4.6s
- transition_in: cut
- src: compositions/frames/06-url.html
- asset_candidates: none — type-only frame

Text:
- kicker (Space Mono, brass): "PLINKS"
- headline (Fraunces italic, bone, ~88px): "the song of a word"
- url (Space Mono, ember, ~30px): "play-plinks.vercel.app"
- mono footnote: "type a word · drop a marble · open source"
