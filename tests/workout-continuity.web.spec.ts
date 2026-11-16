import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ExerciseSchema, ProfileSchema, SessionSchema, createSession } from '../src/domain.js';
import { WORKOUT_CONTINUITY_KEY } from '../src/workout-continuity';

const STORE = 'setline.gym.v1';
const NOW = new Date('2026-11-16T10:00:00Z');
const NAME = 'Machine Chest Press';
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
const record = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), WORKOUT_CONTINUITY_KEY);
const state = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function train(page: Page) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
}

async function seed(page: Page) {
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(new Date(NOW.getTime() + 1000));
  await page.goto('/');
  const movement = ExerciseSchema.parse({ key: 'continuity-press', exerciseId: 'chest-press', name: NAME,
    group: 'Strength', mode: 'weight', sets: 3, target: '8 reps', rest: 120, perSide: false,
    equipmentLabel: 'QA machine', defaultKg: 60 });
  const plan = { ...DEFAULT_PROFILE.plan[0], name: 'Continuity QA workout', exercises: [movement], warmup: [], cooldown: [] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), restSeconds: 120,
    appearance: 'light', presentationMode: 'athlete', timerSoundEnabled: true,
    plan: DEFAULT_PROFILE.plan.map((day, i) => i === 0 ? plan : day) });
  const session = SessionSchema.parse(createSession(plan, 0, '2026-11-16', profile, []));
  session.startedAt = NOW.getTime();
  session.runningSince = null;
  Object.assign(session.exercises[0].logs[0], { kg: 60, reps: 8, rir: 2,
    inputSources: { kg: 'manual', reps: 'manual' } });
  await page.evaluate(({ key, profile, session }) => {
    sessionStorage.clear();
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 7,
      sessions: [{ session, version: 1 }], nutrition: [], activities: [], reminders: { items: [], entries: [] } }));
  }, { key: STORE, profile, session });
  await page.reload();
  await train(page);
  await page.getByRole('button', { name: `Complete ${NAME} set 1`, exact: true }).click();
  await expect(page.locator('.rest-floating')).toBeVisible();
  await expect.poll(async () => (await record(page))?.receipt?.setId).toBe(session.exercises[0].logs[0].id);
  return session;
}

async function freshPage(context: BrowserContext, elapsedMs = 0) {
  // Same origin store, genuinely independent tab storage; no opener copy.
  const page = await context.newPage();
  const time = new Date(NOW.getTime() + 1000 + elapsedMs);
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.goto('/');
  await train(page);
  return page;
}

test('a fresh context explicitly restores the same rest deadline and Undo without duplicating sets or changing the plan', async ({ page, context }) => {
  const session = await seed(page);
  const before = await state(page), saved = await record(page);
  const resumed = await freshPage(context);
  await expect(resumed.locator('.rest-floating')).toHaveCount(0);
  await expect(resumed.getByRole('button', { name: 'Resume saved rest', exact: true })).toBeVisible();
  expect(await state(resumed)).toEqual(before);
  expect((await record(resumed)).ownerId, 'inspecting an independent tab does not claim its timer').toBe(saved.ownerId);
  await resumed.getByRole('button', { name: 'Resume saved rest', exact: true }).click();
  await expect(resumed.locator('.rest-floating')).toBeVisible();
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  expect(await resumed.evaluate(() => Number(sessionStorage.getItem('setline.rest-deadline.v1')))).toBe(saved.deadline);
  expect((await record(resumed)).ownerId).not.toBe(saved.ownerId);
  await resumed.getByRole('button', { name: 'Undo last set', exact: true }).click();
  await expect(resumed.locator('.rest-floating')).toHaveCount(0);
  await expect.poll(async () => (await state(resumed)).sessions[0].session.exercises[0].logs[0].done).toBe(false);
  const after = await state(resumed);
  expect(after.profile).toEqual(before.profile);
  expect(after.profileVersion).toBe(before.profileVersion);
  expect(after.sessions).toHaveLength(1);
  expect(after.sessions[0].session.id).toBe(session.id);
  expect(after.sessions[0].session.exercises[0].logs[0]).toMatchObject({ kg: 60, reps: 8, rir: 2, done: false });
  await resumed.close();
});

test('rest controls remain recoverable after tab termination and an expired deadline resolves without restarting the countdown', async ({ page, context }) => {
  await seed(page);
  const before = await raw(page), saved = await record(page);
  await page.close();
  const resumed = await freshPage(context, 180_000);
  await expect(resumed.getByRole('button', { name: 'Resume saved rest', exact: true })).toBeVisible();
  await resumed.getByRole('button', { name: 'Resume saved rest', exact: true }).click();
  await resumed.clock.runFor(100);
  await expect(resumed.locator('.rest-floating')).toHaveCount(0);
  await expect(resumed.getByRole('status', { name: 'Rest complete', exact: true })).toBeVisible();
  expect(await raw(resumed)).toBe(before);
  const recovered = await record(resumed);
  expect(recovered.deadline).toBeNull();
  expect(recovered.receipt).toEqual(saved.receipt);
  await expect(resumed.getByRole('button', { name: 'Undo last set', exact: true })).toBeEnabled();
  await resumed.close();
});

test('an interrupted workout restored from a different generation does not offer obsolete timer or Undo metadata', async ({ page, context }) => {
  await seed(page);
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)!);
    data.restoreGeneration = crypto.randomUUID();
    localStorage.setItem(key, JSON.stringify(data));
  }, STORE);
  await page.close();
  const resumed = await freshPage(context);
  await expect(resumed.getByRole('button', { name: 'Resume saved rest', exact: true })).toHaveCount(0);
  await expect(resumed.getByRole('button', { name: 'Restore workout controls', exact: true })).toHaveCount(0);
  await expect(resumed.locator('.rest-floating')).toHaveCount(0);
  await expect(resumed.getByRole('button', { name: 'Undo last set', exact: true })).toBeDisabled();
  expect((await state(resumed)).sessions[0].session.exercises[0].logs.filter((log: { done: boolean }) => log.done)).toHaveLength(1);
  await resumed.close();
});

test('a reopened tab with its old tab storage rejects controls from before a restore even when workout IDs match', async ({ page, context }) => {
  await seed(page);
  const tabEntries = await page.evaluate(() => Object.entries(sessionStorage));
  await page.close();
  const reopened = await context.newPage();
  await reopened.clock.install({ time: new Date(NOW.getTime() + 1000) });
  await reopened.clock.pauseAt(new Date(NOW.getTime() + 1000));
  await reopened.goto('/');
  await reopened.evaluate(({ key, tabEntries }) => {
    const data = JSON.parse(localStorage.getItem(key)!);
    data.restoreGeneration = crypto.randomUUID();
    localStorage.setItem(key, JSON.stringify(data));
    sessionStorage.clear();
    for (const [key, value] of tabEntries) sessionStorage.setItem(key, value);
  }, { key: STORE, tabEntries });
  const restored = await raw(reopened);
  await reopened.reload();
  await train(reopened);
  await expect(reopened.locator('.rest-floating')).toHaveCount(0);
  await expect(reopened.getByRole('button', { name: 'Resume saved rest', exact: true })).toHaveCount(0);
  await expect(reopened.getByRole('button', { name: 'Restore workout controls', exact: true })).toHaveCount(0);
  await expect(reopened.getByRole('button', { name: 'Undo last set', exact: true })).toBeDisabled();
  expect(await raw(reopened)).toBe(restored);
  expect((await state(reopened)).sessions[0].session.exercises[0].logs[0].done).toBe(true);
  await reopened.close();
});

for (const change of ['completed', 'undone', 'removed'] as const) {
  test(`another window ${change === 'completed' ? 'finishing the workout' : change === 'undone' ? 'undoing the owned set' : 'removing the local record'} cancels obsolete tab controls`, async ({ page, context }) => {
    await seed(page);
    const other = await context.newPage();
    await other.goto('/');
    await other.evaluate(({ key, change }) => {
      if (change === 'removed') { localStorage.removeItem(key); return; }
      const data = JSON.parse(localStorage.getItem(key)!);
      const record = data.sessions[0];
      record.version++;
      if (change === 'completed') Object.assign(record.session, {
        status: 'completed', finishedAt: Date.now(), runningSince: null, elapsedMs: 60_000,
      });
      else record.session.exercises[0].logs[0].done = false;
      localStorage.setItem(key, JSON.stringify(data));
    }, { key: STORE, change });
    await expect(page.locator('.rest-floating')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Undo last set', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.getItem('setline.last-completed-set.v16'))).toBeNull();
    await other.close();
  });
}
