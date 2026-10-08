// Records a scripted session against the live site for the launch video.
// Output: video/raw/session.webm at 1920x1080 — cut into frames by the
// HyperFrames composition in video/launch/.
import { chromium } from 'playwright';

const URL = 'https://play-plinks.vercel.app/';
const WORD = 'estrella';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'video/raw', size: { width: 1920, height: 1080 } },
});
// keep the footage clean of the first-run guide
await ctx.addInitScript(() => {
  try { localStorage.setItem('plinks.guide.v1', '1'); } catch { /* noop */ }
});
const page = await ctx.newPage();
const sleep = ms => page.waitForTimeout(ms);

await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(1800); // cold open — the instrument idles, pegs ping

// beat 1 — type the word; each letter rains as a bead through the pegs
await page.click('.slot');
for (const ch of WORD) {
  await page.type('.slot', ch, { delay: 320 + Math.random() * 120 });
}
await sleep(1600); // let the last beads settle in the basin

// beat 2 — strum the pegs; the board answers the cursor
const board = await page.locator('.board-canvas').boundingBox();
if (board) {
  const y = board.y + board.height * 0.42;
  await page.mouse.move(board.x + board.width * 0.12, y, { steps: 4 });
  await page.mouse.move(board.x + board.width * 0.85, y - 60, { steps: 40 });
  await page.mouse.move(board.x + board.width * 0.3, y + 90, { steps: 28 });
  await page.mouse.move(board.x + board.width * 0.6, y - 20, { steps: 22 });
}
await sleep(700);

// beat 3 — press the plunger, the marble drops
await page.click('.plunger');
await sleep(5200); // drop + settle

// beat 4 — the score is an instrument: scrub the rail
const rail = await page.locator('.score-inner').boundingBox();
if (rail) {
  const ry = rail.y + rail.height / 2;
  await page.mouse.move(rail.x + rail.width * 0.08, ry);
  await page.mouse.down();
  await page.mouse.move(rail.x + rail.width * 0.72, ry, { steps: 60 });
  await page.mouse.move(rail.x + rail.width * 0.3, ry, { steps: 30 });
  await page.mouse.up();
}
await sleep(1200);

// beat 5 — pull the ticket: the share card rises
await page.click('.ticket');
await sleep(2800);
await page.keyboard.press('Escape');
await sleep(1400);

await ctx.close();
await browser.close();
console.log('recorded to video/raw/');
