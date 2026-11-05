import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession } from '../src/domain.js';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan.ts';
import { defaultReminderState } from '../src/reminders.ts';

// Capture only isolated local QA fixtures. Never build, start a server, or visit production.
if (process.argv.length !== 2) throw new Error('Usage: node --experimental-strip-types scripts/capture-v18.mjs');
const origin = 'http://127.0.0.1:4173';
const output = fileURLToPath(new URL('../artifacts/v18/', import.meta.url));
const results = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' });
async function fixture(profile, sessions = [], width = 390) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(({ origin, profile, sessions, reminders }) => {
    if (location.origin !== origin || localStorage.getItem('setline.gym.v1')) return;
    localStorage.setItem('setline.gym.v1', JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1,
      sessions: sessions.map(session => ({ session, version: 1 })), nutrition: [], activities: [], reminders }));
  }, { origin, profile, sessions, reminders: defaultReminderState() });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  await page.clock.install({ time: new Date('2026-11-04T10:00:00Z') });
  await page.goto(origin);
  await page.getByRole('region', { name: 'Your day', exact: true }).waitFor();
  return { page, context };
}
async function capture(page, name) {
  await page.waitForTimeout(250);
  const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth })) }));
  if (size.document > size.viewport || size.dialogs.some(element => element.scrollWidth > element.width)) throw new Error(`Horizontal overflow: ${name} ${JSON.stringify(size)}`);
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  console.log(`Captured ${name}`);
  results.push({ name, ...size });
}
try {
  for (const appearance of ['light', 'dark']) {
    const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance, bodyWeight: 70,
      plan: createVolleyballMasterPlan(), masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
      masterProgram: { version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: [],
        clearance: { impact: 'restricted', heavyLifting: 'unknown', note: 'Isolated QA fixture — not a user profile.' } } });
    const { page, context } = await fixture(profile);
    await capture(page, `today-${appearance}`);
    await page.getByRole('button', { name: 'View workout', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
    await preview.waitFor();
    await capture(page, `preview-${appearance}`);
    await preview.getByRole('button', { name: 'Review training guidance', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
    await settings.getByLabel('Heavy lifting clearance', { exact: true }).waitFor();
    await settings.getByRole('heading', { name: 'Your recorded guidance', exact: true }).scrollIntoViewIfNeeded();
    await capture(page, `training-guidance-${appearance}`);
    await settings.getByRole('button', { name: 'All settings', exact: true }).click();
    await settings.getByRole('navigation', { name: 'Settings groups', exact: true }).getByRole('button', { name: 'Data & Backup', exact: true }).click();
    const recovery = settings.locator('.setup-recovery');
    await recovery.locator(':scope > summary').click();
    await recovery.locator(':scope > summary').scrollIntoViewIfNeeded();
    await capture(page, `recovery-${appearance}`);
    await context.close();
  }
  for (const [width, appearance] of [[390, 'light'], [390, 'dark'], [320, 'light']]) {
    const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance, bodyWeight: 70 });
    const movement = { key: 'qa-v18-press', exerciseId: 'chest-press', name: 'Machine Chest Press', group: 'Strength',
      sets: 3, target: '8 reps', mode: 'weight', rest: 120, perSide: false };
    const plan = { ...profile.plan[2], name: 'QA strength session', warmup: [], cooldown: [], exercises: [movement] };
    profile.plan[2] = plan;
    const active = SessionSchema.parse(createSession(plan, 2, '2026-11-04', profile, []));
    active.runningSince = null;
    active.exercises[0].logs.forEach(log => Object.assign(log, { kg: null, reps: null, rir: null, seconds: null, done: false }));
    Object.assign(active.exercises[0].logs[0], { kg: 60, reps: 8 });
    const { page, context } = await fixture(profile, [active], width);
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await page.getByRole('button', { name: 'Complete Machine Chest Press set 1', exact: true }).click();
    await page.getByLabel('Current set suggestion', { exact: true }).waitFor();
    await capture(page, `focus-suggestion-${width}-${appearance}`);
    await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
    await capture(page, `quick-log-${width}-${appearance}`);
    await context.close();
  }
  await writeFile(path.join(output, 'README.txt'), 'Isolated localhost QA fixtures; no real user browser, installation or records accessed. Chromium mobile emulation is not physical iPhone validation.\n');
  await writeFile(path.join(output, 'layout-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ output, captures: results.length, horizontalOverflow: false }, null, 2));
} finally { await browser.close(); }
