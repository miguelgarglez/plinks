# Review of 06b5d54

Verdict: **FIX-FIRST**

HEAD confirmed with `git rev-parse HEAD`: `06b5d54f25fe4ef09e8fc0f2f381b6b10dab9b24`. Source matched HEAD and the working tree was clean before this report. No source files were modified.

## Findings

### MED: Initial Shift+Tab escapes the share dialog

`src/sharecard.tsx:49`, `src/sharecard.tsx:58-65`

Opening the card focuses its container, which has `tabIndex={-1}`. The trap only intercepts Shift+Tab from the first button and Tab from the last button. It does not intercept Shift+Tab from that initially focused container. The background is not inert. Reverse tabbing can therefore leave the modal; once focus is outside, Escape no longer reaches the dialog's handler.

Executed evidence: extracted the actual key-handler body and invoked it with `activeElement === cardRef.current` and a Shift+Tab event. Result: `prevented=false`, `moved=false`. This tests the handler, not native browser focus traversal. Reproduce in a browser by opening Share and immediately pressing Shift+Tab. Focus the first button initially or handle the container case explicitly; verify reverse traversal and Escape after opening.

### MED: Desktop deck never claims its two-row grid area

`src/app.css:181-200`

The template declares `"rail rail" "board deck" "score deck"`, but no rule assigns `grid-area: deck` to the form. The other three direct grid items explicitly claim their areas. The form is consequently auto-placed in the first free cell, row 2 / column 2, with the default one-row span. It stops above the score instead of extending alongside it, leaving an unused lower-right cell and reducing the height available to its controls.

Static evidence: searched the full stylesheet; there are zero `grid-area: deck` declarations. The omitted span corresponds to the score's declared 62px height at viewport heights <=700px and 74px otherwise. These are CSS-derived dimensions, not browser measurements. Add the area assignment inside the desktop rule and check that the form's bottom equals the score's bottom. Do not assign it unconditionally to the mobile `display: contents` form.

### LOW: Mobile keyboard sequence disagrees with the new visual sequence

`src/App.tsx:207-226`, `src/app.css:103`

Mobile visually places the input and plunger before the board and score. DOM order remains Board, ScoreRail, Deck. Their focusable controls therefore traverse board, score, input, plunger, variation, mute, share; the settled score also adds its replay button before the input. CSS grid placement and `display: contents` do not reorder keyboard traversal. A keyboard user starting at the header jumps past the entry controls, then returns upward to them. Align source and visual order without introducing positive tabindex values.

Static evidence: Board and the score slider each declare `tabIndex={0}`, before Deck in the JSX. No browser traversal was available.

## Previous fixes and requested checks

| Check | Evidence and result |
| --- | --- |
| Guide no longer covers input while typing | Steps 1 and 2 prefer `aside`, then `above`, then `below` (`src/guide.tsx:30-45`). A fitting aside candidate is separated from its target by 14px. This fixes the original desktop placement mechanism. Actual desktop and 375/390px overlap measurements, correction, submission, and step 3 scrubbing remain unverified. The fallback at lines 172-174 clamps into the viewport without testing target overlap, so code alone cannot establish “never covers.” |
| Mobile meta removed | Confirmed: `.meta` defaults to `display: none` at `src/app.css:89`; only the >=900px rule restores it. This removes its mobile layout contribution. Above-the-fold placement with mobile browser chrome and keyboard remains unmeasured. |
| Machine cannot flex-shrink | Confirmed `flex: none` at `src/app.css:173`. The desktop column sum fits the available stage in the calculations below. Inner-content clipping and page scroll still need a browser check, particularly long words and font metrics. |
| Tilt leaves seams stationary | Confirmed transforms target `cv.style.transform`, not the wrap (`src/board.tsx:146-151`). The wrap retains clipping and a dark background. Tilt pointermove/leave listeners remain on the wrap (170-171); play/strum listeners remain on the canvas (166-169). Edge reveals, transformed hit coordinates, and visual artifacts were not rendered. |
| Mobile form semantics | The input and submit button remain DOM descendants of the form; `display: contents` only removes its CSS box. `onSubmit` still prevents navigation and starts/composes playback. Enter handlers blur coarse-pointer input without preventing default. No code-level loss of form ownership was found, but native Enter and touch behavior were not executed. |
| Share suspension | `src/App.tsx:243` passes `suspended={showCard}` and Guide returns null while suspended. Its effects and dismissal timers continue running, so the guide can expire while the card is open. Escape closes while focus is inside; see the focus-trap finding above. |
| Empty / loading / invalid path | Blank input drops the current song. An empty path selects `plinks`; malformed URI decoding or normalization to an empty word selects the fallback page with a home link. Song generation and simulation are synchronous; there is no asynchronous loading state. Rendering these states was not verified. |
| ARIA | Input, plunger, board, score slider, variation, mute, share, modal and close controls retain accessible labels in source. This does not certify the browser accessibility tree for `display: contents`. |
| Full type → drop → scrub → share cycle and console | Not executed. No claim of a clean browser console. |

Desktop width calculations from the actual CSS, at a 600px viewport height:

| Viewport width | Board | Deck | Machine including borders | Minimum stage width with 180px placard and gap | Available stage width |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 900 | 350 | 196 | 548 | 759.5 | 860 |
| 1024 | 350 | 196 | 548 | 763.84 | 984 |
| 1280 | 350 | 198.4 | 550.4 | 775.2 | 1240 |
| 1440 | 350 | 218 | 570 | 800.4 | 1400 |
| 1920 | 350 | 218 | 570 | 814 | 1880 |

These are executed arithmetic calculations, not `getBoundingClientRect` measurements. They verify horizontal capacity for the declared columns, not every child's bounds or the absence of vertical scroll at 1024x600.

## Execution limitations

Both preview attempts failed with `listen EPERM`: default localhost and explicit `127.0.0.1:4176`. The Playwright MCP code tool returned “MCP tool call requires approval, but approval policy is never.” Locally installed Playwright was available, but Chromium could not start because macOS denied `bootstrap_check_in` for its Mach rendezvous server. No packages were installed and no permission escalation was attempted. The existing dist was present; the build was not rerun because the request states it already passed.

The verdict rests on the concrete source defects above. A live viewport matrix, real mobile input/keyboard checks, visual tilt inspection, and a console-monitored interaction cycle are still required to complete runtime sign-off.
