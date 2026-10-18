import { openSection } from './helpers/navigation';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const FIRST = 'Medicine Ball Spike Slam';

async function tab(page: Page, name: string) {
  await openSection(page, name);
}

async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

async function openPlan(page: Page) {
  await tab(page, 'More');
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  await page.locator('.native-program-options > summary').click();
}

async function openCustomWorkouts(page: Page) {
  await tab(page, 'More');
  await page.getByRole('button', { name: 'My workouts', exact: true }).click();
}

async function addExercise(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await chooseLibraryExercise(page, 'Add exercise', name);
}

async function chooseLibraryExercise(page: Page, title: string, name: string) {
  const library = page.getByRole('dialog', { name: title, exact: true });
  await expect(library).toBeVisible();
  await library.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill(name);
  await library.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  const detail = page.locator('.exercise-library-sheet');
  await detail.getByRole('button', { name: title === 'Replace exercise' ? 'Replace exercise' : 'Add exercise', exact: true }).click();
  await expect(detail).not.toBeVisible();
}

async function createWorkout(page: Page, name = 'Travel strength') {
  await openCustomWorkouts(page);
  await page.getByRole('button', { name: 'Create workout', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Create workout', exact: true });
  await builder.getByLabel('Workout name', { exact: true }).fill(name);
  await builder.getByRole('combobox', { name: 'Training goal', exact: true }).selectOption('strength');
  await addExercise(page, 'Goblet Squat');
  return builder;
}

async function startMonday(page: Page) {
  await tab(page, 'Train');
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
}

async function exerciseOptions(page: Page, name: string) {
  await page.getByRole('button', { name: `Options for ${name}`, exact: true }).click();
  return page.getByRole('dialog').last();
}

async function selectMovement(page: Page, name: string) {
  const movements = page.locator('.focused-movements');
  if (!(await movements.evaluate(element => (element as HTMLDetailsElement).open))) await movements.locator(':scope > summary').click();
  await movements.getByRole('button', { name: `Train ${name}`, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T10:00:00Z') });
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
  // A version-one profile without any new optional fields must remain editable.
  await page.evaluate(({ key, profile }) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [] }));
  }, { key: STORE, profile: DEFAULT_PROFILE });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
});

test('creates and edits a reusable workout with decimal defaults without changing the weekly plan', async ({ page }) => {
  const originalPlan = (await state(page)).profile.plan;
  const builder = await createWorkout(page);
  await builder.getByLabel('Sets', { exact: true }).fill('2');
  await builder.getByLabel('Target', { exact: true }).fill('8–10 reps');
  await builder.getByRole('textbox', { name: 'Goblet Squat starting weight in kilograms', exact: true }).fill('12,5');
  await builder.getByLabel('Rest · sec', { exact: true }).fill('105');
  await builder.locator('.builder-exercise-options > summary').click();
  await builder.getByLabel('Target RPE', { exact: true }).fill('7.5');
  await builder.getByRole('textbox', { name: 'Technique / pairing notes', exact: true }).fill('Keep two clean reps in reserve.');
  await builder.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(builder).not.toBeVisible();
  const saved = await state(page);
  expect(saved.profile.plan).toEqual(originalPlan);
  expect(saved.profile.customWorkouts).toHaveLength(1);
  const workout = saved.profile.customWorkouts[0];
  expect(workout).toMatchObject({ name: 'Travel strength', goal: 'strength', exercises: [{ sets: 2, target: '8–10 reps', defaultKg: 12.5, rest: 105, targetRpe: 7.5, cue: 'Keep two clean reps in reserve.' }] });
  expect(workout.exercises[0].exerciseId).toBe('goblet-squat');
  await page.reload();
  await openCustomWorkouts(page);
  await page.getByRole('button', { name: 'Edit custom workout Travel strength', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit workout', exact: true });
  await edit.getByLabel('Workout name', { exact: true }).fill('Hotel strength');
  await edit.getByRole('button', { name: 'Edit Goblet Squat', exact: true }).click();
  await expect(edit.getByRole('textbox', { name: 'Goblet Squat starting weight in kilograms', exact: true })).toHaveValue('12.5');
  await edit.getByLabel('Target', { exact: true }).fill('10–12 reps');
  await edit.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(edit).not.toBeVisible();
  const updated = (await state(page)).profile.customWorkouts[0];
  expect(updated.id).toBe(workout.id);
  expect(updated.exercises[0].key).toBe(workout.exercises[0].key);
  expect(updated).toMatchObject({ name: 'Hotel strength', exercises: [{ defaultKg: 12.5, target: '10–12 reps' }] });
  expect((await state(page)).profile.plan).toEqual(originalPlan);
});

test('blocks invalid exercise prescriptions and cancels without changing saved data', async ({ page }) => {
  const builder = await createWorkout(page, 'Quick strength');
  const weight = builder.getByRole('textbox', { name: 'Goblet Squat starting weight in kilograms', exact: true });
  await weight.fill('12..5');
  await builder.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(builder.getByRole('alert')).toContainText('starting weight');
  expect((await state(page)).profile.customWorkouts ?? []).toHaveLength(0);
  await weight.fill('12.5');
  await builder.getByLabel('Sets', { exact: true }).fill('21');
  await builder.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(builder).toBeVisible();
  expect((await state(page)).profile.customWorkouts ?? []).toHaveLength(0);
  await builder.getByLabel('Sets', { exact: true }).fill('3');
  await builder.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(builder).not.toBeVisible();
  expect((await state(page)).profile.customWorkouts ?? []).toHaveLength(0);
  expect((await state(page)).profile.plan).toEqual(DEFAULT_PROFILE.plan);
});

test('edits a planned day with library replacement, ordering and removal while retaining its preparation', async ({ page }) => {
  const baseline = (await state(page)).profile.plan[0];
  await openPlan(page);
  await page.getByRole('button', { name: 'Edit Monday', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Edit Monday', exact: true });
  await builder.getByLabel('Workout name', { exact: true }).fill('Upper strength revised');
  await builder.getByRole('button', { name: `Edit ${FIRST}`, exact: true }).click();
  await builder.getByRole('button', { name: 'Replace', exact: true }).click();
  await chooseLibraryExercise(page, 'Replace exercise', 'Medicine Ball Chest Pass');
  await expect(builder.getByRole('button', { name: 'Edit Medicine Ball Chest Pass', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await builder.getByRole('button', { name: 'Move Medicine Ball Chest Pass down', exact: true }).click();
  await addExercise(page, 'Goblet Squat');
  await builder.getByRole('button', { name: 'Remove Goblet Squat', exact: true }).click();
  await expect(builder.getByRole('button', { name: 'Edit Goblet Squat', exact: true })).toHaveCount(0);
  await builder.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(builder).not.toBeVisible();
  const plan = (await state(page)).profile.plan;
  expect(plan[0].name).toBe('Upper strength revised');
  expect(plan[0].exercises).toHaveLength(baseline.exercises.length);
  expect(plan[0].exercises[0]).toEqual(baseline.exercises[1]);
  expect(plan[0].exercises[1].name).toBe('Medicine Ball Chest Pass');
  expect(plan[0].exercises[1].exerciseId).toBe('chest-pass');
  expect(plan[0].warmup).toEqual(baseline.warmup);
  expect(plan[0].cooldown).toEqual(baseline.cooldown);
  expect(plan.slice(1)).toEqual(DEFAULT_PROFILE.plan.slice(1));
  await page.reload();
  expect((await state(page)).profile.plan).toEqual(plan);
});

test('swaps planned days, schedules saved workouts and restores recommendations without deleting templates', async ({ page }) => {
  const builder = await createWorkout(page, 'Extra upper');
  await builder.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(builder).not.toBeVisible();
  const template = (await state(page)).profile.customWorkouts[0];
  await openPlan(page);
  await page.locator('.weekly-plan-customize > summary').click();
  await page.getByRole('button', { name: 'Customize Monday', exact: true }).click();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.getByRole('button', { name: 'Swap Monday with Wednesday', exact: true }).click();
  await expect.poll(async () => (await state(page)).profile.plan[2].name).toBe(DEFAULT_PROFILE.plan[0].name);
  expect((await state(page)).profile.plan[0]).toEqual(DEFAULT_PROFILE.plan[2]);
  await page.getByRole('button', { name: 'Schedule Extra upper', exact: true }).click();
  await page.getByRole('button', { name: 'Use Extra upper on Thursday', exact: true }).click();
  await expect.poll(async () => (await state(page)).profile.plan[3].name).toBe('Extra upper');
  expect((await state(page)).profile.plan[3].exercises).toEqual(template.exercises);
  await page.getByRole('button', { name: 'Reset to recommended plan', exact: true }).click();
  const reset = page.getByRole('alertdialog', { name: 'Restore recommended plan?', exact: true });
  await reset.getByRole('button', { name: 'Restore plan', exact: true }).click();
  await expect.poll(async () => (await state(page)).profile.plan).toEqual(DEFAULT_PROFILE.plan);
  expect((await state(page)).profile.customWorkouts).toEqual([template]);
  await page.reload();
  expect((await state(page)).profile.plan).toEqual(DEFAULT_PROFILE.plan);
});

test('a recovery day requires confirmation and removes only that scheduled day', async ({ page }) => {
  const baseline = (await state(page)).profile.plan;
  await openPlan(page);
  await page.locator('.weekly-plan-customize > summary').click();
  await page.getByRole('button', { name: 'Customize Wednesday', exact: true }).click();
  await page.getByRole('button', { name: 'Recovery day', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Make it a recovery day?', exact: true });
  await confirm.getByRole('button', { name: 'Keep workout', exact: true }).click();
  expect((await state(page)).profile.plan).toEqual(baseline);
  await page.getByRole('button', { name: 'Recovery day', exact: true }).click();
  await confirm.getByRole('button', { name: 'Set recovery day', exact: true }).click();
  await expect(confirm).not.toBeVisible();
  const revised = (await state(page)).profile.plan;
  expect(revised[2]).toMatchObject({ name: 'Recovery', kind: 'recovery', goal: 'recovery', exercises: [] });
  expect(revised.filter((_: unknown, index: number) => index !== 2)).toEqual(baseline.filter((_: unknown, index: number) => index !== 2));
  await tab(page, 'Today');
  await page.getByRole('button', { name: 'Choose training day', exact: true }).click();
  const days = page.getByRole('dialog', { name: 'Choose a day', exact: true });
  await days.getByRole('button', { name: /^Wed / }).click();
  await days.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'View recovery', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Train', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(page.getByRole('button', { name: 'Start recovery', exact: true })).toBeDisabled();
  expect((await state(page)).sessions).toHaveLength(0);
});

test('starting a custom workout uses its decimal prescription and leaves the recommended week intact', async ({ page }) => {
  const builder = await createWorkout(page, 'Quick legs');
  await builder.locator('.builder-session-options > summary').click();
  await builder.getByLabel('Planned minutes', { exact: true }).fill('35');
  await builder.getByRole('textbox', { name: 'Goblet Squat starting weight in kilograms', exact: true }).fill('12.5');
  await builder.getByLabel('Sets', { exact: true }).fill('2');
  await builder.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(builder).not.toBeVisible();
  await page.getByRole('button', { name: 'Use custom workout Quick legs', exact: true }).click();
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await expect(current.getByRole('heading', { name: 'Goblet Squat', exact: true })).toBeVisible();
  await expect(current.getByRole('textbox', { name: 'Goblet Squat set 1 weight in kilograms', exact: true })).toHaveValue('12.5');
  await expect.poll(async () => (await state(page)).sessions[0]?.session.name).toBe('Quick legs');
  expect((await state(page)).sessions[0].session.exercises[0].logs).toHaveLength(2);
  expect((await state(page)).profile.plan).toEqual(DEFAULT_PROFILE.plan);
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  await page.getByRole('dialog', { name: 'Your session', exact: true }).getByRole('button', { name: 'Save as custom workout', exact: true }).click();
  await builder.locator('.builder-session-options > summary').click();
  await expect(builder.getByLabel('Planned minutes', { exact: true })).toHaveValue('35');
  await builder.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await tab(page, 'Train');
  await expect(current.getByRole('textbox', { name: 'Goblet Squat set 1 weight in kilograms', exact: true })).toHaveValue('12.5');
});

test('adds and replaces today’s movements without changing the plan or previously entered sets', async ({ page }) => {
  await startMonday(page);
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await current.getByRole('textbox', { name: `${FIRST} set 1 weight in kilograms`, exact: true }).fill('12.5');
  await current.getByRole('spinbutton', { name: `${FIRST} set 1 reps`, exact: true }).fill('4');
  await current.getByRole('button', { name: `Complete ${FIRST} set 1`, exact: true }).click();
  await expect.poll(async () => (await state(page)).sessions[0].session.exercises[0].logs[0].done).toBe(true);
  const originalSet = (await state(page)).sessions[0].session.exercises[0].logs[0];
  let options = await exerciseOptions(page, FIRST);
  await options.getByRole('button', { name: 'Replace remaining sets', exact: true }).click();
  await chooseLibraryExercise(page, 'Replace exercise', 'Goblet Squat');
  await expect.poll(async () => (await state(page)).sessions[0].session.exercises[1].name).toBe('Goblet Squat');
  expect((await state(page)).sessions[0].session.exercises[0].logs).toEqual([originalSet]);
  expect((await state(page)).sessions[0].session.exercises[1].logs).toHaveLength(3);
  await selectMovement(page, 'Goblet Squat');
  options = await exerciseOptions(page, 'Goblet Squat');
  await options.getByRole('button', { name: 'Add exercise after', exact: true }).click();
  await chooseLibraryExercise(page, 'Add exercise', 'Hack Squat');
  await expect.poll(async () => (await state(page)).sessions[0].session.exercises[2].name).toBe('Hack Squat');
  expect((await state(page)).sessions[0].session.exercises[0].logs[0]).toEqual(originalSet);
  expect((await state(page)).profile.plan).toEqual(DEFAULT_PROFILE.plan);
  await page.reload();
  expect((await state(page)).sessions[0].session.exercises[2].name).toBe('Hack Squat');
  expect((await state(page)).sessions[0].session.exercises[0].logs[0]).toEqual(originalSet);
});

test('reorders and removes today’s movements with a confirmation and leaves all other exercises intact', async ({ page }) => {
  await startMonday(page);
  const baseline = (await state(page)).sessions[0].session.exercises;
  let options = await exerciseOptions(page, FIRST);
  await options.getByRole('button', { name: 'Move exercise', exact: true }).click();
  await page.getByRole('button', { name: `Move ${FIRST} to position 3`, exact: true }).click();
  await expect.poll(async () => (await state(page)).sessions[0].session.exercises[2].key).toBe(baseline[0].key);
  expect((await state(page)).sessions[0].session.exercises.slice(0, 2)).toEqual(baseline.slice(1, 3));
  await selectMovement(page, FIRST);
  options = await exerciseOptions(page, FIRST);
  await options.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Remove exercise?', exact: true });
  await confirmation.getByRole('button', { name: 'Keep exercise', exact: true }).click();
  expect((await state(page)).sessions[0].session.exercises).toHaveLength(baseline.length);
  await page.getByRole('dialog', { name: FIRST, exact: true }).getByRole('button', { name: 'Remove exercise', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  const revised = (await state(page)).sessions[0].session.exercises;
  expect(revised).toEqual(baseline.slice(1));
  expect((await state(page)).profile.plan).toEqual(DEFAULT_PROFILE.plan);
});

test('saves readiness and an active session as a reusable workout without copying recorded sets', async ({ page }) => {
  await startMonday(page);
  const active = (await state(page)).sessions[0].session;
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  const options = page.getByRole('dialog', { name: 'Your session', exact: true });
  await options.getByRole('button', { name: 'Ready', exact: true }).click();
  await options.getByRole('button', { name: 'low leg soreness', exact: true }).click();
  await options.getByRole('button', { name: 'Save check-in', exact: true }).click();
  await expect(options).not.toBeVisible();
  const readiness = (await state(page)).performance.readiness;
  expect(readiness).toHaveLength(1);
  expect(readiness[0]).toMatchObject({ date: '2026-10-12', energy: 'normal', soreness: 'low' });
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  await options.getByRole('button', { name: 'Save as custom workout', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Create workout', exact: true });
  await builder.getByLabel('Workout name', { exact: true }).fill('Upper on the go');
  await builder.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect(builder).not.toBeVisible();
  const template = (await state(page)).profile.customWorkouts[0];
  expect(template.name).toBe('Upper on the go');
  expect(template.exercises).toHaveLength(active.exercises.length);
  expect(template.exercises.every((exercise: object) => !('logs' in exercise) && !('runningSince' in exercise))).toBe(true);
  expect((await state(page)).sessions[0].session.exercises).toEqual(active.exercises);
  await page.reload();
  expect((await state(page)).performance.readiness).toEqual(readiness);
  expect((await state(page)).profile.customWorkouts).toEqual([template]);
});
