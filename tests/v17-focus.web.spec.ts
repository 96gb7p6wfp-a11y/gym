import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-02';
const PRESS = 'Machine Chest Press';

async function seed(page: Page, appearance: 'light' | 'dark', bodyweight = false) {
  const source = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.name === PRESS)!;
  const movement = { ...source, key: 'v17-focus', name: bodyweight ? 'Dead Bug' : PRESS,
    mode: bodyweight ? 'bodyweight' : 'weight', exerciseId: bodyweight ? 'dead-bug' : 'chest-press',
    sets: 2, target: '8–12 reps', equipmentLabel: bodyweight ? undefined : 'Technogym Chest Press',
    cue: 'Keep the saved exercise instruction.' };
  const plan = { ...DEFAULT_PROFILE.plan[0], warmup: [], cooldown: [], exercises: [movement] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance,
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? plan : day) });
  const history = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-10-26', profile, []), 'completed'));
  history.startedAt = Date.parse('2026-10-26T10:00:00Z');
  history.exercises[0].logs = history.exercises[0].logs.map(log => ({ ...log, kg: bodyweight ? null : 60, reps: 8, rir: 2, done: true }));
  const active = SessionSchema.parse(createSession(plan, 0, DATE, profile, []));
  active.startedAt = Date.parse(`${DATE}T10:00:00Z`); active.runningSince = null;
  active.exercises[0].logs = active.exercises[0].logs.map((log, index) => ({ ...log,
    kg: bodyweight ? index ? null : 0 : 62.5 - index * 2.5, reps: 8, rir: 2 }));
  await page.evaluate(({ key, profile, history, active }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: history, version: 1 }, { session: active, version: 1 }],
    nutrition: [], activities: [],
  })), { key: STORE, profile, history, active });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  return { profile, history, active };
}

async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

for (const appearance of ['light', 'dark'] as const) {
  test(`Focus prioritizes the current set and keeps optional context read-only in ${appearance}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 });
    const initial = await seed(page, appearance);
    const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
    const notes = focus.locator('.focused-training-notes');
    await expect(notes).not.toHaveAttribute('open');
    await expect(focus.getByText('Coach', { exact: true })).toBeHidden();
    await expect(focus.getByRole('button', { name: `Equipment for ${PRESS}`, exact: true })).toBeHidden();
    await expect(focus.locator('.focused-exercise__previous')).toContainText('60 kg × 8');
    const reuse = focus.getByRole('button', { name: `Reuse previous ${PRESS} set 1 weights and reps`, exact: true });
    await expect(reuse).toHaveText('Use previous');
    expect(await reuse.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const complete = focus.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true });
    const navigation = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
    const bounds = (await complete.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(navigation.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await focus.locator('.focused-exercise__previous b').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(15);
    const beforeNotes = await state(page);
    await notes.locator(':scope > summary').click();
    await expect(notes).toContainText('Upper-body pushing strength');
    await expect(notes.getByRole('button', { name: `Equipment for ${PRESS}`, exact: true })).toContainText('Technogym Chest Press');
    await expect(notes.getByText('Coach', { exact: true })).toBeVisible();
    await notes.locator(':scope > summary').click();
    expect(await state(page)).toEqual(beforeNotes);
    await reuse.click();
    await complete.click();
    await expect(focus.getByRole('status', { name: 'Set completion', exact: true })).toContainText(`${PRESS} · Set 1 recorded · 60 kg × 8`);
    await expect(focus.getByRole('button', { name: `Complete ${PRESS} set 2`, exact: true })).toBeDisabled();
    const saved = await state(page);
    const current = saved.sessions.find((row: { session: { id: string } }) => row.session.id === initial.active.id).session;
    expect(current.exercises[0].logs[0]).toMatchObject({ kg: 60, reps: 8, rir: 2, done: true });
    expect(current.exercises[0].logs[1]).toEqual(initial.active.exercises[0].logs[1]);
    expect(saved.sessions.find((row: { session: { id: string } }) => row.session.id === initial.history.id).session).toEqual(initial.history);
    expect(saved.profile).toEqual(initial.profile);
    await page.screenshot({ path: testInfo.outputPath(`v17-focus-${appearance}.png`) });
  });
}

test('bodyweight Focus keeps kilograms optional without losing a revealed invalid draft, completion or Undo values', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const initial = await seed(page, 'light', true);
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  const weight = focus.getByRole('textbox', { name: 'Dead Bug set 1 weight in kilograms', exact: true });
  await expect(weight).toHaveCount(0);
  const before = await state(page);
  await focus.getByRole('button', { name: 'Add weight to Dead Bug', exact: true }).click();
  await expect(weight).toHaveValue('0');
  expect(await state(page)).toEqual(before);
  await weight.fill('7,5');
  await weight.fill('12..5');
  await expect(weight).toHaveAttribute('aria-invalid', 'true');
  await expect(weight).toHaveValue('12..5');
  await focus.getByRole('button', { name: 'Complete Dead Bug set 1', exact: true }).click();
  await expect(focus.getByRole('button', { name: 'Complete Dead Bug set 1', exact: true })).toBeVisible();
  expect((await state(page)).sessions.find((row: { session: { id: string } }) => row.session.id === initial.active.id).session.exercises[0].logs[0].done).toBe(false);
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  await expect(weight).toBeVisible();
  await expect(weight).toHaveValue('12..5');
  await weight.fill('7,5');
  await focus.getByRole('button', { name: 'Complete Dead Bug set 1', exact: true }).click();
  await focus.getByRole('button', { name: 'Undo last set', exact: true }).click();
  const restored = (await state(page)).sessions.find((row: { session: { id: string } }) => row.session.id === initial.active.id).session;
  expect(restored.exercises[0].logs[0]).toMatchObject({ kg: 7.5, reps: 8, rir: 2, done: false });
  const suggestedNext = { ...initial.active.exercises[0].logs[1], kg: 7.5, inputSources: { ...initial.active.exercises[0].logs[1].inputSources, kg: 'last-set' } };
  // Undo reopens the completed set; its next-set suggestion stays an unfinished draft.
  expect(restored.exercises[0].logs[1]).toEqual(suggestedNext);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(weight).toHaveValue('7.5');
  const refreshed = await state(page);
  const resumed = refreshed.sessions.find((row: { session: { id: string } }) => row.session.id === initial.active.id).session;
  expect(resumed.exercises[0].logs[1]).toEqual(suggestedNext);
  expect(refreshed.sessions.find((row: { session: { id: string } }) => row.session.id === initial.history.id).session).toEqual(initial.history);
  expect(refreshed.profile).toEqual(initial.profile);
});
