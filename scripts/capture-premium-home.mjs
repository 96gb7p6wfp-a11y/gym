import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import { defaultReminderState } from '../src/reminders.ts';
import { PerformanceDataSchema } from '../src/performance-data.ts';

// Isolated localhost samples only: never connect this script to a personal store.
const mode = process.argv[2] ?? 'after';
if (!['before', 'after'].includes(mode) || process.argv.length > 3) throw new Error('Use capture-premium-home.mjs [before|after].');
const output = path.resolve('artifacts/premium-home', mode);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' });
const results = [];
const today = '2026-11-10';
const plan = createV9VolleyballMasterPlan();
const guidance = { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated QA fixture. Not personal medical guidance.' };
const profileFor = appearance => ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), presentationMode: 'athlete',
  appearance, plan, masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5), trainingGuidance: guidance,
  masterProgram: { version: 1, revision: '9', startDate: '2026-11-02', matchWeeks: [], calendarMatches: [], clearance: guidance } });

function recordedSession(profile, date, improvement, active = false) {
  const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const session = SessionSchema.parse(createSession(plan[0], day, date, profile, []));
  for (const [index, exercise] of session.exercises.entries()) {
    for (const log of exercise.logs) {
      Object.assign(log, { done: true, rir: 2, ...(exercise.mode === 'timed' ? { seconds: 20 }
        : { reps: /slam/i.test(exercise.name) ? 3 : /pull.up/i.test(exercise.name) ? 6 : 8 }),
        kg: /slam/i.test(exercise.name) ? 2 : exercise.mode === 'weight' ? 25 + index * 2.5 + improvement : 0 });
    }
  }
  session.startedAt = Date.parse(`${date}T08:00:00Z`);
  session.elapsedMs = 111.5 * 60000;
  session.runningSince = null;
  if (!active) Object.assign(session, { status: 'completed', finishedAt: session.startedAt + session.elapsedMs });
  return SessionSchema.parse(active ? session : stopSessionTimers(session, 'completed'));
}

async function sample(width, appearance, active = false, largeText = false) {
  const profile = profileFor(appearance);
  const history = [recordedSession(profile, '2026-11-02', 0), recordedSession(profile, '2026-11-09', 2.5)];
  const state = { schemaVersion: 1, profile, profileVersion: 1,
    sessions: [...(active ? [recordedSession(profile, today, 5, true)] : []), ...history].map(session => ({ session, version: 1 })),
    nutrition: [{ id: 'qa-weight-one', date: '2026-11-09', version: 1, payload: { kind: 'weight', kg: 70 } }],
    activities: [], reminders: defaultReminderState(), performanceVersion: 1,
    performance: PerformanceDataSchema.parse({ jumps: [
      { id: crypto.randomUUID(), date: '2026-11-02', type: 'standing', measurement: 'height', cm: 65, source: 'measured', standingReachCm: 235, touchCm: 300, conditions: 'Same QA indoor court', notes: '' },
      { id: crypto.randomUUID(), date: '2026-11-02', type: 'approach', measurement: 'height', cm: 70, source: 'measured', standingReachCm: 235, touchCm: 305, conditions: 'Same QA indoor court', notes: '' },
      { id: crypto.randomUUID(), date: '2026-11-09', type: 'approach', measurement: 'height', cm: 72, source: 'measured', standingReachCm: 235, touchCm: 307, conditions: 'Same QA indoor court', notes: '' },
    ], readiness: [] }) };
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'en-GB', reducedMotion: 'reduce' });
  await context.addInitScript(state => { if (!localStorage.getItem('setline.gym.v1')) localStorage.setItem('setline.gym.v1', JSON.stringify(state)); }, state);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.clock.install({ time: new Date(`${today}T10:00:00Z`) });
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('region', { name: 'Your day', exact: true }).waitFor();
  if (largeText) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  return { page, context };
}

async function capture(page, name, fullPage = false) {
  const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage });
  results.push({ name, ...width });
  console.log(JSON.stringify({ name, ...width }));
}

try {
  for (const appearance of ['light', 'dark']) {
    const { page, context } = await sample(390, appearance);
    await capture(page, `today-390-${appearance}`, true);
    await context.close();
  }
  for (const width of mode === 'before' ? [320, 390] : [320, 375, 390, 430]) {
    for (const appearance of ['light', 'dark']) {
      const { page, context } = await sample(width, appearance, true);
      await page.getByRole('tab', { name: 'Train', exact: true }).click();
      await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
      await page.getByRole('dialog', { name: 'Finish your workout', exact: true }).getByRole('button', { name: 'Save completed workout', exact: true }).click();
      await page.getByRole('region', { name: 'Workout complete summary', exact: true }).waitFor();
      await capture(page, `completion-${width}-${appearance}`);
      if (mode === 'after' && width === 320) {
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        await capture(page, `completion-${width}-${appearance}-large-text`);
      }
      await context.close();
    }
  }
  if (mode === 'after') for (const appearance of ['light', 'dark']) {
    const { page, context } = await sample(390, appearance);
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await page.getByRole('button', { name: /^Wed / }).click();
    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
    const check = page.getByRole('dialog', { name: 'Ready to Train?', exact: true });
    await check.waitFor();
    await capture(page, `pre-workout-${appearance}`);
    await check.getByRole('button', { name: 'Yes — fit to train', exact: true }).click();
    await check.getByRole('button', { name: 'Not yet', exact: true }).click();
    await check.getByRole('button', { name: 'Quick warm-up', exact: true }).click();
    await page.getByRole('dialog', { name: 'Warm-up', exact: true }).waitFor();
    await capture(page, `specific-warmup-${appearance}`);
    await context.close();
  }
  await writeFile(path.join(output, 'layout-results.json'), JSON.stringify(results, null, 2));
} finally { await browser.close(); }
