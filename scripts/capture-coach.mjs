import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_PROFILE, ProfileSchema, createSession, SessionSchema, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import { defaultReminderState } from '../src/reminders.ts';

// Fixed local QA origin only. Never open a personal installation or modify real data.
const mode = process.argv[2] ?? 'after';
if (process.argv.length > 3 || !['before', 'after'].includes(mode)) throw new Error('Use capture-coach.mjs [before|after].');
const origin = 'http://127.0.0.1:4173';
const output = path.resolve('artifacts', 'coach', mode);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
const results = [];

async function fixture({ width = 390, appearance = 'light', guidance = 'unknown' } = {}) {
  const reported = { impact: guidance, heavyLifting: guidance, note: 'Isolated visual QA fixture, not a real personal profile.' };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance, presentationMode: 'athlete', bodyWeight: 70,
    trainingGuidance: reported, plan: createV9VolleyballMasterPlan(), masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '9', startDate: '2026-10-12', v9EffectiveDate: '2026-10-12', matchWeeks: [], clearance: reported,
      readiness: [{ date: '2026-11-07', status: 'green' }], calendarMatches: [], dailyReadiness: [] } });
  const completed = (date, kg) => {
    const plan = structuredClone(createV9VolleyballMasterPlan()[2]);
    plan.exercises.find(item => item.name === 'Hack Squat').equipmentLabel = 'Matrix QA Hack Squat';
    const session = SessionSchema.parse(stopSessionTimers(createSession(plan, 2, date, profile, []), 'completed'));
    session.exercises.find(item => item.name === 'Hack Squat').logs.forEach(log => Object.assign(log, { kg, reps: 6, rir: 2, done: true }));
    return { session, version: 1 };
  };
  const state = { schemaVersion: 1, profile, profileVersion: 1, sessions: [completed('2026-10-20', 70), completed('2026-11-02', 75)],
    nutrition: [{ id: 'qa-weight', date: '2026-11-06', version: 1, payload: { kind: 'weight', kg: 70.1 } }], activities: [], reminders: defaultReminderState(),
    performance: { jumps: [
      { id: crypto.randomUUID(), date: '2026-10-20', type: 'approach', measurement: 'height', cm: 70, source: 'measured', notes: '', conditions: 'Same QA indoor court', standingReachCm: 235, touchCm: 305 },
      { id: crypto.randomUUID(), date: '2026-11-02', type: 'approach', measurement: 'height', cm: 73, source: 'measured', notes: '', conditions: 'Same QA indoor court', standingReachCm: 235, touchCm: 308 },
      { id: crypto.randomUUID(), date: '2026-11-02', type: 'standing', measurement: 'height', cm: 67, source: 'measured', notes: '', conditions: 'Same QA indoor court', standingReachCm: 235, touchCm: 302 },
    ], readiness: [] }, performanceVersion: 1 };
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: 'en-GB' });
  await context.addInitScript(({ origin, state }) => {
    if (location.origin === origin && !localStorage.getItem('setline.gym.v1')) localStorage.setItem('setline.gym.v1', JSON.stringify(state));
  }, { origin, state });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.clock.install({ time: new Date('2026-11-06T10:00:00Z') });
  await page.goto(origin);
  await page.getByRole('region', { name: 'Your day', exact: true }).waitFor();
  return { page, context };
}

async function capture(page, name) {
  await page.waitForTimeout(150);
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  if (dimensions.document > dimensions.viewport) throw new Error(`Horizontal overflow: ${name}`);
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  results.push({ name, ...dimensions });
  console.log(`Captured ${name}`);
}
async function selectedDay(page, day) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${day} `) }).click();
}

try {
  const { page, context } = await fixture();
  await capture(page, 'today-friday');
  await selectedDay(page, 'Sat');
  await capture(page, 'saturday-guidance-and-week4');
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await capture(page, 'progress-actual-data');
  if (mode === 'after') {
    const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
    await overview.getByRole('group', { name: 'Chart metric', exact: true }).getByRole('button', { name: 'Strength', exact: true }).click();
    await capture(page, 'progress-strength');
    await overview.getByRole('region', { name: 'Volleyball progress', exact: true }).getByRole('button', { name: 'View approach vertical jump', exact: true }).click();
    await capture(page, 'progress-jump');
    await selectedDay(page, 'Sat');
    await page.getByRole('button', { name: 'View workout', exact: true }).click();
    await capture(page, 'saturday-full-reference');
    const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
    await preview.getByRole('button', { name: 'Recommended today', exact: true }).click();
    await capture(page, 'saturday-safe-recommendation');
    await preview.getByRole('button', { name: 'Close', exact: true }).click();
    await selectedDay(page, 'Sun');
    const schedule = page.getByRole('region', { name: 'Sunday match schedule', exact: true });
    await schedule.getByRole('switch', { name: 'Match scheduled', exact: true }).click();
    await capture(page, 'sunday-match-calendar');
    await selectedDay(page, 'Sat');
    await capture(page, 'saturday-match-primer');
    for (const width of [320, 390]) {
      const dark = await fixture({ width, appearance: 'dark', guidance: 'cleared' });
      await capture(dark.page, `today-${width}-dark`);
      await selectedDay(dark.page, 'Sat');
      await dark.page.getByRole('region', { name: 'Daily readiness', exact: true }).getByRole('button', { name: 'Tired — Reduce some work', exact: true }).click();
      await capture(dark.page, `saturday-${width}-dark-tired`);
      await dark.context.close();
    }
  }
  await context.close();
  await writeFile(path.join(output, 'layout-results.json'), JSON.stringify(results, null, 2));
  await writeFile(path.join(output, 'README.txt'), 'Isolated localhost QA fixtures only. Before mode uses the prior compiled build and reproduces Week4 plus unknown guidance. These screenshots are not a personal phone store or physical iPhone validation.\n');
  console.log(JSON.stringify({ output, captures: results.length, horizontalOverflow: false }));
} finally { await browser.close(); }
