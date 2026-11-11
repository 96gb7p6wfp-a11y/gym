import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createIpadFixture, IPAD_TODAY } from '../tests/helpers/ipad-fixture.ts';

// This script intentionally accepts no remote origin or personal-store input.
const mode = process.argv[2] ?? 'after';
if (!['before', 'after'].includes(mode) || process.argv.length > 3) throw new Error('Use capture-exercise-ipad.mjs [before|after].');
const output = path.resolve('artifacts/exercise-ipad', mode);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' });
const results = [];
const phones = [[375, 812], [390, 844], [430, 932]];
const tablets = [[768, 1024], [820, 1180], [1024, 768], [1194, 834], [1366, 1024], [700, 900], [540, 900]];

async function capture(page, name) {
  // The deterministic clock must also deliver viewport/ResizeObserver frames
  // after opening a sheet; disabling CSS animations alone can catch a midpoint.
  await page.clock.runFor(350);
  const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
    theme: document.documentElement.dataset.theme,
    activeTab: document.querySelector('[role="tab"][data-state="active"]')?.textContent }));
  await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
  results.push({ name, ...layout });
  console.log(JSON.stringify({ name, ...layout }));
}
async function sample(width, height, theme, active = false) {
  const state = createIpadFixture(theme, active);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    locale: 'en-GB', timezoneId: 'Europe/Berlin', reducedMotion: 'reduce' });
  await context.addInitScript(state => { if (!localStorage.getItem('setline.gym.v1')) localStorage.setItem('setline.gym.v1', JSON.stringify(state)); }, state);
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.install({ time: new Date(`${IPAD_TODAY}T10:00:00Z`) });
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('region', { name: 'Your day', exact: true }).waitFor();
  return { page, context };
}
async function destination(page, name) { await page.getByRole('tab', { name, exact: true }).click(); }

try {
  for (const [width, height] of mode === 'before' ? phones : [...phones, ...tablets]) for (const theme of ['light', 'dark']) {
    const prefix = `${width < 700 ? 'iphone' : 'window'}-${width}x${height}-${theme}`;
    const { page, context } = await sample(width, height, theme);
    await capture(page, `${prefix}-today`);
    await destination(page, 'Train'); await capture(page, `${prefix}-train`);
    await destination(page, 'Progress'); await capture(page, `${prefix}-progress`);
    await destination(page, 'You');
    await page.getByRole('button', { name: 'Exercise library', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Exercises', exact: true }); await library.waitFor();
    await capture(page, `${prefix}-library`);
    await library.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill('two-hand medicine ball overhead slam');
    await library.getByRole('button', { name: 'View Two-Hand Medicine Ball Overhead Slam', exact: true }).click();
    await capture(page, `${prefix}-exercise`);
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('dialog', { name: 'Your preferences', exact: true }).waitFor();
    await capture(page, `${prefix}-settings`);
    if (mode === 'after' && width === 1024 && theme === 'dark') {
      await page.addStyleTag({ content: 'html {font-size:200% !important}' });
      await capture(page, `${prefix}-settings-large-text`);
    }
    await context.close();
    if (mode === 'before' && width !== 390 || mode === 'after' && ![390, 1024, 1366, 700].includes(width)) continue;
    const active = await sample(width, height, theme, true);
    await destination(active.page, 'Train'); await capture(active.page, `${prefix}-active-focus`);
    await active.context.close();
  }
  const html = await readFile('dist/index.html');
  await writeFile(path.join(output, 'capture-results.json'), JSON.stringify({ mode, distHtmlSha256: createHash('sha256').update(html).digest('hex'),
    isolatedLocalhostFixtures: true, results }, null, 2));
} finally { await browser.close(); }
