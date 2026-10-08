// Records a directed 33s session of the live product for the launch video.
// Beat timings match the composition's media-start cuts:
//   0.0–4.6  idle + typing (letters stamp, beads rain)
//   4.6–10.6 peg strumming under the cursor
//   10.6–16.8 plunger drop + marble fall
//   16.8–21.2 score scrub
//   21.2–25.8 share ticket
//   25.8–33  settled board, guide-free
// Run: node capture-session.mjs  →  writes /tmp/plinks-session.webm
import { chromium } from 'playwright';

const URL = 'https://play-plinks.vercel.app/';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  recordVideo: { dir: '/tmp/plinks-vid', size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('plinks.guide.v1', '1'));
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'networkidle' });
const at = (s) => sleep(Math.max(0, s * 1000 - (Date.now() - t0)));

// sync marker: a magenta frame pulse at a known wall time, so the head
// trim can align video-time to wall-time exactly
await page.evaluate(() => {
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:#ff00ff;z-index:99999';
  document.body.appendChild(m);
  setTimeout(() => m.remove(), 350);
});
const flashWall = (Date.now() - t0) / 1000;
const now = () => (Date.now() - t0) / 1000;
const mark = (name) => console.log(`MARK ${name} ${now().toFixed(2)}`);
console.log('flash at wall', flashWall.toFixed(2));

await at(0.8);

// beat 1 — type, slowly enough to watch the beads
const slot = page.locator('#word-slot');
await slot.click();
mark('type-start');
for (const ch of 'estrella') {
  await page.keyboard.type(ch, { delay: 0 });
  await sleep(430);
}
mark('type-end');

// beat 2 — strum the pegs: two slow sweeps across the board
const board = await page.locator('.board-canvas').boundingBox();
await at(4.8);
mark('strum-start');
for (let pass = 0; pass < 2; pass++) {
  const y = board.y + board.height * (0.35 + pass * 0.25);
  const from = pass % 2 ? board.x + board.width * 0.82 : board.x + board.width * 0.18;
  const to = pass % 2 ? board.x + board.width * 0.18 : board.x + board.width * 0.82;
  await page.mouse.move(from, y);
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from + (to - from) * (i / steps), y + Math.sin(i / 6) * 12);
    await sleep(32);
  }
}
mark('strum-end');

// beat 3 — plunger
await at(10.7);
await page.locator('.plunger').click();
mark('drop-start');

// beat 4 — scrub the tape once settled
await page.waitForSelector('.replay-key', { timeout: 20000 });
mark('settled');
await page.mouse.move(960, 540); // let it breathe a moment
await sleep(1200);
const score = await page.locator('.score-inner').boundingBox();
const sy = score.y + score.height / 2;
await page.mouse.move(score.x + 30, sy);
await page.mouse.down();
mark('scrub-start');
for (let i = 0; i <= 60; i++) {
  await page.mouse.move(score.x + 30 + (score.width - 60) * (i / 60), sy);
  await sleep(28);
}
for (let i = 60; i >= 10; i--) {
  await page.mouse.move(score.x + 30 + (score.width - 60) * (i / 60), sy);
  await sleep(22);
}
await page.mouse.up();
mark('scrub-end');

// beat 5 — the ticket (verify the card opened; retry once if it missed)
await sleep(800);
await page.locator('.ticket').click();
await sleep(600);
if (!(await page.$('[role="dialog"]'))) {
  console.log('ticket click missed — retrying');
  await page.locator('.ticket').click();
  await sleep(600);
}
mark('ticket-open');
await sleep(3000);
await page.keyboard.press('Escape');
await sleep(400);
mark('ticket-closed');

// beat 6 — settled board under the URL card
await sleep(3400);
mark('end');

await ctx.close(); // flushes the recording
await browser.close();
console.log('recorded to /tmp/plinks-vid/');
