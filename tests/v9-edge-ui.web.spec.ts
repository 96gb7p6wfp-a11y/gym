import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-master-plan';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const TODAY = '2026-11-06';
const SATURDAY = '2026-11-07';
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seed(page: Page, options: { postBlock?: boolean; appearance?: 'light' | 'dark'; reaction?: boolean } = {}) {
  const plan = createV9VolleyballMasterPlan();
  const guidance = { impact: 'cleared' as const, heavyLifting: 'cleared' as const, note: 'Isolated QA guidance, not a real personal record.' };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan,
    appearance: options.appearance ?? 'light', presentationMode: 'athlete', trainingGuidance: guidance,
    masterProgram: { version: 1, revision: '9', startDate: options.postBlock ? '2026-09-07' : '2026-11-02',
      v9EffectiveDate: options.postBlock ? '2026-09-07' : '2026-11-02',
      matchWeeks: options.postBlock ? [1] : [], clearance: guidance,
      readiness: [{ date: SATURDAY, status: 'green' }] },
    masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5),
  });
  const reaction = plan[3].exercises.find(exercise => exercise.exerciseId === 'split-step-reaction')!;
  const active = SessionSchema.parse(stopSessionTimers(createSession({ ...plan[3], name: 'QA reaction practice',
    warmup: [], cooldown: [], exercises: [reaction] }, 3, '2026-11-05', profile, []), 'active'));
  await page.evaluate(({ key, profile, sessions, reminders }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 4, sessions,
    nutrition: [], activities: [], reminders,
  })), { key: STORE, profile, sessions: options.reaction ? [{ session: active, version: 1 }] : [], reminders: defaultReminderState() });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return { profile, active };
}

async function saturday(page: Page) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
}

function workoutPreview(page: Page) { return page.getByRole('dialog', { name: 'Workout preview', exact: true }); }

async function fullSaturday(sheet: Locator) {
  await expect(sheet.getByRole('heading', { name: 'Lower B — Full Strength', exact: true })).toBeVisible();
  const rows = sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li');
  await expect(rows).toHaveCount(11);
  await expect(rows.first()).toContainText('10 m Acceleration');
  await expect(rows.first()).toContainText('4 × 10 m');
  await expect(rows.last()).toContainText('Cable Crunch');
  await expect(rows.last()).toContainText('2 × 10–15 reps');
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00Z`) });
  await page.goto('/');
});

test('post-block V9 Saturday and its program preview do not inherit the old first-week match primer', async ({ page }) => {
  await seed(page, { postBlock: true });
  const before = await raw(page);
  await saturday(page);
  await expect(page.locator('.session-card h2')).toHaveText('Lower B — Full Strength');
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const sheet = workoutPreview(page);
  await fullSaturday(sheet);
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  const options = page.locator('.native-program-options');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
  const program = page.getByRole('region', { name: 'Volleyball training plan', exact: true });
  await expect(program.locator('.master-program__heading')).toContainText('Weekly training');
  await program.locator('.master-program__preview-disclosure > summary').click();
  const schedule = program.locator('.master-program__preview');
  await expect(schedule.locator('.master-program__preview-phase')).toHaveText('Full V9 base · No Sunday match');
  const lower = schedule.locator(':scope > ol > li').nth(5);
  await expect(lower.locator('summary strong')).toHaveText('Lower B — Full Strength');
  await lower.locator('summary').click();
  await expect(lower.locator('ul > li')).toHaveCount(11);
  await expect(schedule).not.toContainText('Pre-Match Primer');
  expect(await raw(page)).toBe(before);
});

test('320px dark V9 preview exposes all eleven working exercises and a reachable start action', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const initial = await seed(page, { appearance: 'dark' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
  const before = await raw(page);
  await saturday(page);
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const sheet = workoutPreview(page);
  await fullSaturday(sheet);
  expect(await sheet.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await raw(page)).toBe(before);
  const start = sheet.getByRole('button', { name: 'Start workout', exact: true });
  await start.scrollIntoViewIfNeeded();
  await expect.poll(() => start.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return bounds.height >= 52 && bounds.width >= 44 && bounds.top >= 0 && bounds.bottom <= innerHeight
      && hit !== null && element.contains(hit);
  })).toBe(true);
  await start.tap();
  await expect(page.getByRole('dialog', { name: 'Warm-up', exact: true })).toBeVisible();
  const after = await read(page);
  expect(after.sessions).toEqual([]);
  expect(after.profile.plan).toEqual(initial.profile.plan);
});

test('reaction cues start only by request and never complete or modify a workout set', async ({ page }) => {
  const { active } = await seed(page, { reaction: true });
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const notes = page.locator('.focused-training-notes');
  await notes.locator(':scope > summary').click();
  const aid = page.getByRole('region', { name: 'Optional reaction cue aid', exact: true });
  const before = await raw(page);
  await expect(aid).toContainText('0 / 4 cues shown');
  await page.clock.runFor(5_000);
  await expect(aid).toContainText('0 / 4 cues shown');
  expect(await raw(page)).toBe(before);
  await aid.getByRole('button', { name: 'Start 4 cues', exact: true }).click();
  await expect(aid.getByRole('button', { name: 'Stop cues', exact: true })).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(aid).toContainText('4 / 4 cues shown');
  await expect(aid).toContainText('Four cues shown. Log only the reactions you actually performed.');
  expect(await raw(page)).toBe(before);
  const record = (await read(page)).sessions.find((row: { session: { id: string } }) => row.session.id === active.id);
  expect(record.session.exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([false, false, false]);
  expect(record.session.exercises[0].logs.map((log: { reps: number | null }) => log.reps)).toEqual([4, 4, 4]);
  expect(record.session.exercises[0].logs.every((log: {inputSources?: {reps?: string}}) => log.inputSources?.reps === 'default')).toBe(true);
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const quick = page.getByRole('region', { name: 'Quick log Split-Step Reaction Drill', exact: true });
  await quick.locator('.quick-exercise__effort > summary').click();
  const quickAid = quick.getByRole('region', { name: 'Optional reaction cue aid', exact: true });
  await expect(quickAid).toContainText('0 / 4 cues shown');
  await quickAid.getByRole('button', { name: 'Start 4 cues', exact: true }).click();
  await quickAid.getByRole('button', { name: 'Stop cues', exact: true }).click();
  const stoppedCount = await quickAid.locator('.reaction-cue__direction > span').textContent();
  await page.clock.runFor(20_000);
  await expect(quickAid.locator('.reaction-cue__direction > span')).toHaveText(stoppedCount!);
  expect(await raw(page)).toBe(before);
});
