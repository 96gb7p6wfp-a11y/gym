import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createVolleyballMasterPlan, createV9VolleyballMasterPlan } from '../src/volleyball-master-plan';
import { defaultReminderState } from '../src/reminders';
import { settingsGroup } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const SAFETY = 'setline.gym.pre-restore.v1';
const TODAY = '2026-11-06';
const SATURDAY = '2026-11-07';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
const preview = (page: Page) => page.getByRole('dialog', { name: 'Workout preview', exact: true });

async function seed(page: Page, options: { v9?: boolean; match?: boolean; readiness?: 'green' | 'yellow' | 'red'; active?: boolean; drafts?: boolean; appearance?: 'light' | 'dark' } = {}) {
  const legacy = createVolleyballMasterPlan();
  const plan = options.v9 ? createV9VolleyballMasterPlan() : legacy;
  const guidance = { impact: 'cleared' as const, heavyLifting: 'cleared' as const, note: 'Isolated QA guidance, not a real athlete profile.' };
  const history = SessionSchema.parse(stopSessionTimers(createSession(legacy[2], 2, '2026-10-28', DEFAULT_PROFILE, []), 'completed'));
  history.exercises.find(exercise => exercise.name === 'Hack Squat')!.logs[0] = {
    ...history.exercises.find(exercise => exercise.name === 'Hack Squat')!.logs[0], kg: 70, reps: 5, rir: 2, done: true,
  };
  const personal = { ...structuredClone(legacy[5]), name: 'My deliberate short Saturday edit', note: 'Saved rest and exercise choices to review, never silently delete.' };
  personal.exercises[0].rest = 165;
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance: options.appearance ?? 'light',
    presentationMode: 'athlete', bodyWeight: 70.5, restSeconds: 105, timerSoundEnabled: false,
    plan, trainingGuidance: guidance,
    masterProgram: { version: 1, revision: options.v9 ? '9' : '13.1', startDate: '2026-11-02', matchWeeks: options.match ? [1] : [],
      clearance: guidance, ...(options.v9 ? { v9EffectiveDate: TODAY } : {}),
      ...(options.v9 ? { dailyReadiness: [{ date: SATURDAY, feeling: options.readiness === 'yellow' ? 'tired' : options.readiness === 'red' ? 'poor' : 'normal' }] } : {}),
      readiness: [{ date: SATURDAY, status: options.readiness ?? 'green' }] },
    masterMatchWeekend: (options.v9 ? createV9VolleyballMasterPlan(true) : createVolleyballMasterPlan(true)).slice(5),
    customWorkouts: [{ ...structuredClone(legacy[0]), id: crypto.randomUUID(), name: 'Retained personal template' }],
    ...(options.drafts ? { sessionDrafts: [
      { date: '2026-11-04', slot: 'main', customized: true, plan: { ...structuredClone(legacy[2]), name: 'Past date edit stays' } },
      { date: SATURDAY, slot: 'main', customized: true, plan: personal, readiness: 'green' },
      { date: '2026-11-14', slot: 'main', customized: true, plan: { ...structuredClone(legacy[5]), name: 'Separate future edit stays' } },
    ] } : {}),
  });
  const active = SessionSchema.parse(stopSessionTimers(createSession(legacy[3], 3, '2026-11-05', profile, []), 'active'));
  Object.assign(active.exercises.find(exercise => exercise.mode === 'weight')!.logs[0], { kg: 22.5, reps: 8, done: true });
  const state = { schemaVersion: 1, profile, profileVersion: 7,
    sessions: [{ session: history, version: 2 }, ...(options.active ? [{ session: active, version: 3 }] : [])],
    nutrition: [{ id: 'preserved-qa-weight', date: '2026-11-05', version: 1, payload: { kind: 'weight', kg: 70.2 } }],
    activities: [], reminders: defaultReminderState(),
    performance: { jumps: [{ id: crypto.randomUUID(), date: '2026-10-28', type: 'approach', measurement: 'height', cm: 60,
      source: 'measured', conditions: 'Isolated QA test', notes: '' }], readiness: [] }, performanceVersion: 2,
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
  const offer = page.getByRole('dialog', { name: 'Upgrade Training Plan to V9', exact: true });
  await expect(offer).toContainText('App stays Setline V18');
  await offer.getByRole('button', { name: 'Review Weekly Schedule', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review Weekly Schedule', exact: true });
  await expect(review).toBeVisible();
  return review;
}

async function applyUpgrade(page: Page, choice?: 'replace' | 'keep') {
  const review = await reviewUpgrade(page);
  if (choice) await review.getByRole('combobox', { name: `V9 choice for ${SATURDAY} main`, exact: true }).selectOption(choice);
  const acknowledgement = review.getByRole('checkbox', { name: 'Use V9 recommendations for unmapped weekly edits', exact: true });
  if (await acknowledgement.isVisible()) await acknowledgement.check();
  await review.getByRole('button', { name: 'Apply V9 to Future Workouts', exact: true }).click();
  await expect(review).not.toBeVisible();
  await expect.poll(async () => (await read(page)).profile.masterProgram.revision).toBe('9');
}

async function saturdayPreview(page: Page) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(preview(page)).toBeVisible();
  return preview(page);
}

const fullSaturday = [
  ['10 m Acceleration', '4 × 10 m', '90 sec'],
  ['Split-Squat Jump', '2 × 3 reps', '120 sec'],
  ['Leg Press', '3 × 5–8 reps', '180 sec'],
  ['Smith Machine Bulgarian Split Squat', '3 × 6–8 reps', '120 sec'],
  ['Hip Thrust Machine', '3 × 6–8 reps', '120 sec'],
  ['Leg Curl', '3 × 8–12 reps', '90 sec'],
  ['Standing Calf Raise', '3 × 6–10 reps', '90 sec'],
  ['Standing Calf Isometric Hold', '2 × 30 sec', '90 sec'],
  ['Tibialis Raise', '2 × 15–20 reps', '60 sec'],
  ['Copenhagen Plank', '2 × 20–30 sec', '60 sec'],
  ['Cable Crunch', '2 × 10–15 reps', '60 sec'],
];
async function expectFullSaturday(sheet: ReturnType<typeof preview>) {
  const rows = sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li');
  await expect(rows).toHaveCount(11);
  for (const [index, [name, dose, rest]] of fullSaturday.entries()) {
    await expect(rows.nth(index).getByRole('button', { name: `Exercise details for ${name}`, exact: true })).toBeVisible();
    await expect(rows.nth(index)).toContainText(dose);
    await expect(rows.nth(index)).toContainText(rest);
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00Z`) });
  await page.goto('/');
});

test('V9 offer and complete weekly proposal are read-only until explicit application', async ({ page }) => {
  await seed(page, { drafts: true });
  const before = await raw(page);
  const review = await reviewUpgrade(page);
  await expect(review.getByRole('region', { name: 'V9 weekly schedule', exact: true }).locator('details')).toHaveCount(7);
  const saturday = review.locator('.v9-upgrade__day').filter({ has: page.locator('summary strong', { hasText: 'Lower B — Full Strength' }) });
  await expect(saturday.locator('ol > li')).toHaveCount(11);
  await expect(review.getByRole('region', { name: 'Upcoming date-specific workouts', exact: true })).toContainText('My deliberate short Saturday edit');
  await review.getByRole('button', { name: 'Keep current program', exact: true }).click();
  await expect(review).not.toBeVisible();
  expect(await raw(page)).toBe(before);
});

test('applying V9 archives V13.1, preserves personal records and quarantines the old five-exercise Saturday', async ({ page }) => {
  const before = await seed(page, { drafts: true, appearance: 'dark' });
  const beforeRaw = await raw(page);
  await applyUpgrade(page);
  const after = await read(page);
  expect(after.profile.masterProgramBackup.plan).toEqual(before.profile.plan);
  expect(after.profile.masterProgramBackup.sessionDrafts).toEqual(before.profile.sessionDrafts);
  expect(after.profile.sessionDrafts).toEqual(before.profile.sessionDrafts);
  expect(after.profile.masterProgram.v9EffectiveDate).toBe(TODAY);
  for (const field of ['bodyWeight', 'restSeconds', 'appearance', 'timerSoundEnabled', 'customWorkouts', 'trainingGuidance', 'volleyballSchedule']) {
    expect(after.profile[field]).toEqual(before.profile[field as keyof typeof before.profile]);
  }
  for (const field of ['sessions', 'nutrition', 'activities', 'performance', 'reminders']) expect(after[field]).toEqual(before[field as keyof typeof before]);
  expect(JSON.parse((await page.evaluate(key => localStorage.getItem(key), SAFETY))!).raw).toBe(beforeRaw);
  const sheet = await saturdayPreview(page);
  await expect(sheet.getByRole('heading', { name: 'Lower B — Full Strength', exact: true })).toBeVisible();
  await expectFullSaturday(sheet);
  await expect(sheet.getByRole('button', { name: 'Review saved date edit', exact: true })).toBeVisible();
  expect((await read(page)).sessions).toEqual(before.sessions);
});

test('approved replacement removes only the selected upcoming edit and preserves past and other future edits', async ({ page }) => {
  const before = await seed(page, { drafts: true });
  await applyUpgrade(page, 'replace');
  const after = await read(page);
  expect(after.profile.sessionDrafts).toEqual(before.profile.sessionDrafts!.filter(draft => draft.date !== SATURDAY));
  expect(after.profile.masterProgramBackup.sessionDrafts).toEqual(before.profile.sessionDrafts);
  expect(after.sessions).toEqual(before.sessions);
  await expectFullSaturday(await saturdayPreview(page));
});

test('an explicitly kept intentional date edit is labeled and the complete base remains read-only', async ({ page }) => {
  const before = await seed(page, { drafts: true });
  await applyUpgrade(page, 'keep');
  const sheet = await saturdayPreview(page);
  await expect(sheet).toContainText('Custom workout for this date');
  await expectFullSaturday(sheet);
  await expect(sheet.getByRole('region', { name: 'Executable recommendation', exact: true })).toContainText('5 exercises');
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li')).toHaveCount(5);
  await sheet.getByRole('button', { name: 'Full V9 base', exact: true }).click();
  await expectFullSaturday(sheet);
  await expect(sheet).toContainText('read-only reference');
  await expect(sheet.getByRole('button', { name: /^Options for / })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Start recommended workout', exact: true })).toBeVisible();
  const kept = (await read(page)).profile.sessionDrafts.find((draft: { date: string }) => draft.date === SATURDAY);
  expect(kept.plan).toEqual(before.profile.sessionDrafts!.find(draft => draft.date === SATURDAY)!.plan);
  expect(kept.reviewedForProgram).toEqual({ revision: '9', programSessionId: 'v9-lower-b' });
});

test('upgrading while an older workout is active preserves its exact V13.1 snapshot', async ({ page }) => {
  const before = await seed(page, { active: true, drafts: true });
  await applyUpgrade(page);
  const after = await read(page);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.sessions.find((row: { session: { status: string } }) => row.session.status === 'active').session.programRevision).toBe('13.1');
  await page.reload();
  expect((await read(page)).sessions).toEqual(before.sessions);
  expect((await read(page)).profile.masterProgram.revision).toBe('9');
});

for (const width of [320, 390]) {
  test(`Green no-match Saturday exposes all eleven exact working prescriptions before starting at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await seed(page, { v9: true, readiness: 'green' });
    const before = await raw(page);
    const sheet = await saturdayPreview(page);
    await expect(sheet.getByRole('heading', { name: 'Lower B — Full Strength', exact: true })).toBeVisible();
    await expect(sheet).toContainText('85–105 min');
    await expectFullSaturday(sheet);
    expect(await sheet.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await raw(page)).toBe(before);
  });
}

for (const readiness of ['yellow', 'red'] as const) {
  test(`${readiness} Saturday is visibly modified and cannot start the full-reference prescription`, async ({ page }) => {
    await seed(page, { v9: true, readiness });
    const before = await raw(page);
    const sheet = await saturdayPreview(page);
    await expect(sheet.getByRole('heading', { name: 'Lower B — Full Strength', exact: true })).toBeVisible();
    await expectFullSaturday(sheet);
    await expect(sheet.getByRole('region', { name: 'Executable recommendation', exact: true })).toContainText('Modified');
    await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
    await expect(sheet.getByRole('heading', { level: 2 })).toContainText('Modified');
    const recommendedRows = await sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li').count();
    expect(recommendedRows).toBeLessThan(11);
    await sheet.getByRole('button', { name: 'Full V9 base', exact: true }).click();
    await expectFullSaturday(sheet);
    await expect(sheet.getByRole('button', { name: 'Start recommended workout', exact: true })).toBeVisible();
    await expect(sheet).toContainText('cannot authorize restricted heavy or high-impact work');
    expect(await raw(page)).toBe(before);
  });
}

test('confirmed Sunday match selects the separate Saturday primer and keeps unknown match time unset', async ({ page }) => {
  await seed(page, { v9: true, match: true });
  const before = await raw(page);
  let sheet = await saturdayPreview(page);
  await expect(sheet.getByRole('heading', { name: 'Pre-Match Primer', exact: true })).toBeVisible();
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li')).toHaveCount(4);
  await expect(sheet).not.toContainText('Leg Press');
  await expect(sheet).toContainText('No additional long warm-up checklist');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /^Sun / }).click();
  await expect(page.locator('.native-session-prescription')).toContainText('Match · time not set');
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  sheet = preview(page);
  await expect(sheet.getByRole('heading', { name: 'Volleyball Match', exact: true })).toBeVisible();
  expect((await read(page)).profile.masterProgram.matchTimes).toBeUndefined();
  expect(await raw(page)).toBe(before);
});

test('browsing V9 Saturday does not change Friday Today or write planned sport as completed', async ({ page }) => {
  const before = await seed(page, { v9: true });
  const sheet = await saturdayPreview(page);
  await expectFullSaturday(sheet);
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('School PE + Volleyball');
  expect((await read(page)).sessions).toEqual(before.sessions);
  expect((await read(page)).activities).toEqual([]);
});

test('changing an actual match-week selection switches only upcoming recommendations between primer and full Lower B', async ({ page }) => {
  const before = await seed(page, { v9: true });
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sun / }).click();
  await page.getByRole('switch', { name: 'Match scheduled', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.calendarMatches.find((row: {date: string}) => row.date === '2026-11-08')?.scheduled).toBe(true);
  let sheet = await saturdayPreview(page);
  await expect(sheet.getByRole('heading', { name: 'Pre-Match Primer', exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /^Sun / }).click();
  await page.getByRole('switch', { name: 'Match scheduled', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.calendarMatches.find((row: {date: string}) => row.date === '2026-11-08')?.scheduled).toBe(false);
  expect((await read(page)).profile.masterProgram.matchWeeks).toEqual(before.profile.masterProgram!.matchWeeks);
  sheet = await saturdayPreview(page);
  await expectFullSaturday(sheet);
  expect((await read(page)).sessions).toEqual(before.sessions);
  expect((await read(page)).profile.plan).toEqual(before.profile.plan);
});

test('a V9 backup roundtrip and offline reopen preserve prescriptions, old history and current data', async ({ page, context }) => {
  const before = await seed(page, { v9: true });
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const data = await settingsGroup(page, 'Data & Backup');
  const downloaded = page.waitForEvent('download');
  await data.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloaded;
  const path = await download.path();
  if (!path) throw new Error('The isolated backup download was unavailable.');
  const text = await readFile(path, 'utf8');
  const backup = JSON.parse(text);
  expect(backup.version).toBe(1);
  expect(backup.data.profile.masterProgram.revision).toBe('9');
  expect(backup.data.sessions).toEqual(before.sessions);
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'v9-qa-backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(data.getByRole('region', { name: 'Backup restore preview', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), data.getByRole('button', { name: 'Restore backup', exact: true }).click()]);
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  const restored = await read(page);
  expect(restored.profile).toEqual(backup.data.profile);
  expect(restored.sessions).toEqual(before.sessions);
  expect(restored.nutrition).toEqual(before.nutrition);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expectFullSaturday(await saturdayPreview(page));
  expect((await read(page)).profile).toEqual(restored.profile);
  expect((await read(page)).sessions).toEqual(restored.sessions);
});
