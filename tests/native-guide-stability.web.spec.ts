import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const NAME = 'Machine Chest Press';
const DATE = '2026-11-16';
const NOW = new Date(`${DATE}T10:00:00Z`);
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

test.use({ serviceWorkers: 'block' });

test('All sets keeps its touch target stable when the optional exercise guide module is unavailable', async ({ page }) => {
  const guideRequests: string[] = [];
  // An optional guide must not load, suspend, or move the set table until opened.
  await page.route(/\/assets\/ExerciseGuide-[^/]+\.js(?:\?.*)?$/, route => {
    guideRequests.push(route.request().url());
    return route.abort('failed');
  });
  await page.clock.setFixedTime(NOW);
  await page.goto('/');

  const movement = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.name === NAME)!;
  const workout = { ...structuredClone(DEFAULT_PROFILE.plan[0]), name: 'Stable touch logging QA', warmup: [], cooldown: [],
    exercises: [{ ...movement, key: 'native-guide-stable-press', exerciseId: 'chest-press', sets: 3, rest: 120 }] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance: 'light', presentationMode: 'athlete',
    timerSoundEnabled: false, plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? workout : day) });
  const session = SessionSchema.parse(createSession(workout, 0, DATE, profile, []));
  session.startedAt = NOW.getTime(); session.runningSince = null;
  session.exercises[0].logs.forEach((log, index) => Object.assign(log, {
    kg: 62.5 - index * 2.5, reps: 8 - index, rir: 2, done: false,
    inputSources: { kg: 'manual', reps: 'manual' },
  }));
  const initial = { schemaVersion: 1, profile, profileVersion: 5, sessions: [{ session, version: 1 }],
    nutrition: [], activities: [], reminders: defaultReminderState() };
  await page.evaluate(state => {
    sessionStorage.clear();
    localStorage.setItem('setline.gym.v1', JSON.stringify(state));
  }, initial);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await current.getByRole('button', { name: 'All sets', exact: true }).click();
  const allSets = current.locator('.focused-workout__all-sets');
  const details = allSets.getByRole('button', { name: `Exercise details for ${NAME}`, exact: true });
  await expect(details).toBeVisible();
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  expect(guideRequests).toEqual([]);

  const target = allSets.getByRole('checkbox', { name: `Complete ${NAME} set 1`, exact: true });
  await target.scrollIntoViewIfNeeded();
  const bounds = (await target.boundingBox())!;
  // Keep the original screen coordinates: a late guide render must not move the
  // target, and repeated real touches must not complete another set or undo it.
  for (let index = 0; index < 10; index++) {
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  }

  await expect.poll(async () => (await read(page)).sessions[0].session.exercises[0].logs.map((log: { done: boolean }) => log.done))
    .toEqual([true, false, false]);
  const saved = await read(page);
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0].version).toBe(initial.sessions[0].version + 1);
  expect(saved.sessions[0].session.exercises[0].logs).toEqual(session.exercises[0].logs.map((log, index) => ({ ...log, done: index === 0 })));
  expect(saved.profile).toEqual(initial.profile);
  expect(saved.profileVersion).toBe(initial.profileVersion);
  await expect(target).toBeChecked();
  await expect(target).toBeDisabled();
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const rest = await page.evaluate(() => ({
    deadline: sessionStorage.getItem('setline.rest-deadline.v1'),
    owner: sessionStorage.getItem('setline.rest-owner.v16'),
  }));
  expect(Number(rest.deadline)).toBe(NOW.getTime() + 120_000);
  expect(JSON.parse(rest.owner!)).toEqual({ sessionId: session.id, exerciseKey: session.exercises[0].key,
    setId: session.exercises[0].logs[0].id });
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  expect(guideRequests).toEqual([]);
});
