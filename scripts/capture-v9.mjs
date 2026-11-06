import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createVolleyballMasterPlan, createV9VolleyballMasterPlan } from '../src/volleyball-master-plan.ts';
import { defaultReminderState } from '../src/reminders.ts';

// Fixed localhost only: isolated QA contexts, no production URL or real records.
if (process.argv.length !== 2) throw new Error('Usage: node --experimental-strip-types scripts/capture-v9.mjs');
const origin = 'http://127.0.0.1:4173';
const output = fileURLToPath(new URL('../artifacts/v9/', import.meta.url));
const results = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' });

async function fixture({ revision = '9', match = false, width = 390, appearance = 'light' } = {}) {
  const factory = revision === '9' ? createV9VolleyballMasterPlan : createVolleyballMasterPlan;
  const guidance = { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated QA fixture, not a real personal profile.' };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), bodyWeight: 70, nutrition: undefined,
    appearance, presentationMode: 'athlete', plan: factory(), trainingGuidance: guidance,
    masterProgram: { version: 1, revision, startDate: '2026-11-02', matchWeeks: match ? [1] : [], clearance: guidance,
      ...(revision === '9' ? { v9EffectiveDate: '2026-11-02' } : {}),
      readiness: [{ date: '2026-11-04', status: 'green' }, { date: '2026-11-07', status: 'green' }] },
    masterMatchWeekend: factory(true).slice(5),
  });
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'Europe/Berlin' });
  await context.addInitScript(({ origin, profile, reminders }) => {
    if (location.origin !== origin || localStorage.getItem('setline.gym.v1')) return;
    localStorage.setItem('setline.gym.v1', JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1,
      sessions: [], nutrition: [], activities: [], reminders, performance: { jumps: [], readiness: [] }, performanceVersion: 1 }));
  }, { origin, profile, reminders: defaultReminderState() });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  await page.clock.install({ time: new Date('2026-11-06T10:00:00Z') });
  await page.goto(origin);
  await page.getByRole('region', { name: 'Your day', exact: true }).waitFor();
  return { page, context };
}

async function capture(page, name) {
  await page.waitForTimeout(250);
  const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth })) }));
  if (size.document > size.viewport || size.dialogs.some(element => element.scrollWidth > element.width)) throw new Error(`Horizontal overflow: ${name}`);
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  results.push({ name, ...size });
  console.log(`Captured ${name}`);
}

async function preview(page, day) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${day} `) }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await sheet.waitFor();
  return sheet;
}

try {
  const legacy = await fixture({ revision: '13.1' });
  let sheet = await preview(legacy.page, 'Sat');
  await capture(legacy.page, 'prescription-v131-saturday-five');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await legacy.page.getByRole('tab', { name: 'You', exact: true }).click();
  await legacy.page.getByRole('button', { name: 'Training plan', exact: true }).click();
  const options = legacy.page.locator('.native-program-options');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
  await options.getByRole('button', { name: 'Upgrade Training Plan to V9', exact: true }).click();
  await capture(legacy.page, 'v9-upgrade-offer');
  const offer = legacy.page.getByRole('dialog', { name: 'Upgrade Training Plan to V9', exact: true });
  await offer.getByRole('button', { name: 'Review Weekly Schedule', exact: true }).click();
  await capture(legacy.page, 'v9-upgrade-schedule');
  await legacy.context.close();

  for (const [width, appearance] of [[390, 'light'], [390, 'dark'], [320, 'dark']]) {
    const { page, context } = await fixture({ width, appearance });
    sheet = await preview(page, 'Sat');
    await capture(page, `prescription-v9-saturday-${width}-${appearance}`);
    if (width === 320 || appearance === 'light') {
      await sheet.locator('.plan-preview__exercise-main').last().scrollIntoViewIfNeeded();
      await capture(page, `v9-saturday-final-exercises-${width}-${appearance}`);
    }
    await context.close();
  }
  const power = await fixture();
  sheet = await preview(power.page, 'Wed');
  await capture(power.page, 'v9-wednesday-speed-jump');
  await sheet.getByRole('button', { name: 'Exercise details for Hack Squat', exact: true }).scrollIntoViewIfNeeded();
  await capture(power.page, 'v9-wednesday-complex');
  await power.context.close();

  const upper = await fixture({ appearance: 'dark' });
  await preview(upper.page, 'Thu');
  await capture(upper.page, 'v9-thursday-agility-upper-dark');
  await upper.context.close();

  const match = await fixture({ match: true });
  await preview(match.page, 'Sat');
  await capture(match.page, 'v9-saturday-match-primer');
  await match.context.close();

  const testing = await fixture();
  await testing.page.getByRole('tab', { name: 'Progress', exact: true }).click();
  const metrics = testing.page.getByRole('region', { name: 'Speed and joint readiness', exact: true });
  if (!await metrics.isVisible()) await testing.page.getByRole('button', { name: 'Performance details', exact: true }).click();
  await metrics.scrollIntoViewIfNeeded();
  await capture(testing.page, 'v9-speed-metrics-empty');
  await testing.context.close();

  await writeFile(path.join(output, 'README.txt'), 'Isolated localhost QA fixtures. Legacy V13.1 and V9 prescription captures are rendered by the same current build; they are not screenshots of a real user installation. No real profile or workout records were read or changed. Chromium touch emulation is not physical iPhone validation.\n');
  await writeFile(path.join(output, 'layout-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ output, captures: results.length, horizontalOverflow: false }));
} finally { await browser.close(); }
