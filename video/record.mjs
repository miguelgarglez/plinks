// Records a scripted ~28s session against the live site for docs/launch.mp4.
// Output: video/raw.webm (2x device scale). Overlay titles are added by ffmpeg.
import { chromium } from 'playwright';

const URL = 'https://play-plinks.vercel.app/';
const WORD = 'marble';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
  recordVideo: { dir: 'video', size: { width: 1600, height: 900 } },
});
const page = await ctx.newPage();
const sleep = ms => page.waitForTimeout(ms);

await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(1600); // hook: the instrument sits waiting (overlay: "type a word")

// beat 1 — type the word, human pacing
await page.fill('.word-input', '');
for (const ch of WORD) {
  await page.type('.word-input', ch, { delay: 60 + Math.random() * 70 });
}
await sleep(350);
await page.press('.word-input', 'Enter');

// beat 2 — the drop (compose auto-plays)
await sleep(5200);

// beat 3 — tap a revealed note to replay it
await sleep(400);
const dots = await page.$$('.score-dot.on');
if (dots.length > 2) await dots[Math.floor(dots.length * 0.6)].click();
await sleep(900);
if (dots.length > 4) await dots[Math.floor(dots.length * 0.3)].click();
await sleep(1400);

// beat 4 — another take
await page.click('button:has-text("take")');
await sleep(5200);

// end card beat — hold on the settled board (URL overlay added by ffmpeg)
await sleep(2600);

await ctx.close();
await browser.close();
console.log('recorded video/raw-*.webm');
