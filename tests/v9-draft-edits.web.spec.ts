import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders';
import { createVolleyballMasterPlan, createV9VolleyballMasterPlan } from '../src/volleyball-master-plan';

const STORE = 'setline.gym.v1';
const SAFETY = 'setline.gym.pre-restore.v1';
const TODAY = '2026-11-06';
const SATURDAY = '2026-11-07';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const preview = (page: Page) => page.getByRole('dialog', { name: 'Workout preview', exact: true });

/** Every record belongs to this isolated browser context, never a real installation. */
async function seed(page: Page, alreadyV9 = false) {
  const legacy = createVolleyballMasterPlan();
  const guidance = { impact: 'cleared' as const, heavyLifting: 'cleared' as const, note: 'Isolated QA guidance.' };
  const previousSettings = { version: 1 as const, revision: '13.1' as const,
    startDate: '2026-11-02', matchWeeks: [], clearance: guidance,
    readiness: [{ date: SATURDAY, status: 'green' as const }] };
  const datePlan = structuredClone((alreadyV9 ? createV9VolleyballMasterPlan() : legacy)[5]);
  datePlan.name = alreadyV9 ? 'My V9 Saturday edit' : 'My deliberately short Saturday';
  datePlan.exercises[0].rest = 165;
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), presentationMode: 'athlete',
    appearance: 'light', bodyWeight: 70.5, restSeconds: 105, timerSoundEnabled: false,
    trainingGuidance: guidance,
    plan: alreadyV9 ? createV9VolleyballMasterPlan() : legacy,
    masterProgram: alreadyV9 ? { ...previousSettings, revision: '9', v9EffectiveDate: TODAY } : previousSettings,
    masterMatchWeekend: (alreadyV9 ? createV9VolleyballMasterPlan(true) : createVolleyballMasterPlan(true)).slice(5),
    ...(alreadyV9 ? { masterProgramBackup: { savedAt: Date.parse(`${TODAY}T09:00:00Z`),
      plan: structuredClone(legacy), masterProgram: previousSettings,
      masterMatchWeekend: createVolleyballMasterPlan(true).slice(5) } } : {}),
    sessionDrafts: [{ date: SATURDAY, slot: 'main', customized: true, readiness: 'green', plan: datePlan }],
  });
  const history = SessionSchema.parse(stopSessionTimers(createSession(legacy[2], 2, '2026-10-28', profile, []), 'completed'));
  Object.assign(history.exercises.find(exercise => exercise.name === 'Hack Squat')!.logs[0],
    { kg: 70, reps: 5, rir: 2, done: true });
  const state = { schemaVersion: 1, profile, profileVersion: 7,
    sessions: [{ session: history, version: 2 }],
    nutrition: [{ id: 'retained-qa-weight', date: '2026-11-05', version: 1, payload: { kind: 'weight', kg: 70.2 } }],
    activities: [], reminders: defaultReminderState(),
  };
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORE, state });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return state;
}

async function programOptions(page: Page) {
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  const options = page.locator('.native-program-options');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
  return options;
}

async function reviewUpgrade(page: Page) {
  const options = await programOptions(page);
  await options.getByRole('button', { name: 'Upgrade Training Plan to V9', exact: true }).click();
  await page.getByRole('dialog', { name: 'Upgrade Training Plan to V9', exact: true })
    .getByRole('button', { name: 'Review Weekly Schedule', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review Weekly Schedule', exact: true });
  await expect(review).toBeVisible();
  return review;
}

async function acknowledgeIfNeeded(review: ReturnType<Page['getByRole']>) {
  const checkbox = review.getByRole('checkbox', { name: 'Use V9 recommendations for unmapped weekly edits', exact: true });
  if (await checkbox.isVisible()) await checkbox.check();
}

async function saturdayPreview(page: Page) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(preview(page)).toBeVisible();
  return preview(page);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00Z`) });
  await page.goto('/');
});

test('an explicitly kept legacy Saturday remains approved after a date-only rest edit and refresh', async ({ page }) => {
  const before = await seed(page);
  const review = await reviewUpgrade(page);
  await review.getByRole('combobox', { name: `V9 choice for ${SATURDAY} main`, exact: true }).selectOption('keep');
  await acknowledgeIfNeeded(review);
  await review.getByRole('button', { name: 'Apply V9 to Future Workouts', exact: true }).click();
  await expect(review).not.toBeVisible();

  let sheet = await saturdayPreview(page);
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  const name = before.profile.sessionDrafts![0].plan.exercises[0].name;
  await sheet.getByRole('button', { name: `Options for ${name}`, exact: true }).click();
  const options = page.getByRole('dialog', { name, exact: true });
  await options.getByRole('button', { name: 'Sets, reps & rest', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit exercise', exact: true });
  await editor.getByLabel('Rest · seconds', { exact: true }).fill('150');
  await editor.getByRole('button', { name: 'Save for this day', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(sheet).toContainText('Custom workout for this date');
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li')).toHaveCount(5);
  let after = await read(page);
  const kept = after.profile.sessionDrafts.find((draft: { date: string }) => draft.date === SATURDAY);
  expect(kept.reviewedForProgram).toEqual({ revision: '9', programSessionId: 'v9-lower-b' });
  expect(kept.plan.exercises[0].rest).toBe(150);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.nutrition).toEqual(before.nutrition);
  await page.reload();
  sheet = await saturdayPreview(page);
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  await expect(sheet).toContainText('Custom workout for this date');
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li')).toHaveCount(5);
  after = await read(page);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.profile.plan[5].exercises).toHaveLength(11);
});

test('a profile changed after the V9 proposal cannot be overwritten by its stale approval', async ({ page }) => {
  const before = await seed(page);
  const review = await reviewUpgrade(page);
  await review.getByRole('combobox', { name: `V9 choice for ${SATURDAY} main`, exact: true }).selectOption('replace');
  await acknowledgeIfNeeded(review);
  // Emulate another tab saving after this dialog took its profile-version lease.
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.profile.bodyWeight = 71;
    state.profileVersion += 1;
    localStorage.setItem(key, JSON.stringify(state));
  }, STORE);
  const latest = await read(page);
  await review.getByRole('button', { name: 'Apply V9 to Future Workouts', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('Your setup changed after this review');
  expect(await read(page)).toEqual(latest);
  expect(latest.profile.masterProgram.revision).toBe('13.1');
  expect(latest.profile.sessionDrafts).toEqual(before.profile.sessionDrafts);
  expect(await page.evaluate(key => localStorage.getItem(key), SAFETY)).toBeNull();
});

test('a workout started after review prevents replacement of that date draft without losing its active snapshot', async ({ page }) => {
  const before = await seed(page);
  const review = await reviewUpgrade(page);
  await review.getByRole('combobox', { name: `V9 choice for ${SATURDAY} main`, exact: true }).selectOption('replace');
  await acknowledgeIfNeeded(review);
  const active = SessionSchema.parse(createSession(before.profile.sessionDrafts![0].plan, 5, SATURDAY, before.profile, []));
  active.runningSince = null;
  Object.assign(active.exercises[0].logs[0], { kg: 42.5, reps: 7, rir: 2, done: true });
  await page.evaluate(({ key, session }) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.sessions.unshift({ session, version: 3 });
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORE, session: active });
  const latest = await read(page);
  await review.getByRole('button', { name: 'Apply V9 to Future Workouts', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('Finish the active workout before changing its saved date edit');
  expect(await read(page)).toEqual(latest);
  expect(latest.profile.sessionDrafts).toEqual(before.profile.sessionDrafts);
  expect(await page.evaluate(key => localStorage.getItem(key), SAFETY)).toBeNull();
});

test('restoring V13.1 quarantines a retained V9 date edit without relabeling or deleting it', async ({ page }) => {
  const before = await seed(page, true);
  const options = await programOptions(page);
  await options.getByRole('button', { name: 'Restore previous program', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Restore your previous program?', exact: true });
  await confirmation.getByRole('button', { name: 'Restore previous program', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  const after = await read(page);
  expect(after.profile.masterProgram.revision).toBe('13.1');
  expect(after.profile.plan).toEqual(before.profile.masterProgramBackup!.plan);
  expect(after.profile.sessionDrafts).toEqual(before.profile.sessionDrafts);
  expect(after.profile.sessionDrafts[0].plan.programRevision).toBe('9');
  expect(after.sessions).toEqual(before.sessions);
  expect(after.nutrition).toEqual(before.nutrition);
  expect(after.profile.trainingGuidance).toEqual(before.profile.trainingGuidance);
  const sheet = await saturdayPreview(page);
  await expect(sheet).toContainText('Your restored training program is used for this date');
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li')).toHaveCount(5);
  await expect(sheet.getByRole('button', { name: 'Review date-only reset', exact: true })).toBeVisible();
  expect((await read(page)).profile.sessionDrafts).toEqual(before.profile.sessionDrafts);
});
