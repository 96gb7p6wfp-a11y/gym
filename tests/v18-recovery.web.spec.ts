import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, NutritionPayloadSchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { defaultReminderState, reminderEntryId } from '../src/reminders';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan';
import { settingsGroup } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const SAFETY_COPY = 'setline.gym.pre-restore.v1';
const TODAY = '2026-11-02';
const NOW = Date.parse(`${TODAY}T10:00:00Z`);

function fixture(active = false, appearance: 'light' | 'dark' = 'light') {
  const profile = ProfileSchema.parse({
    ...structuredClone(DEFAULT_PROFILE), appearance,
    trainingGuidance: { impact: 'restricted', heavyLifting: 'unknown', note: 'Current personal guidance' },
    customWorkouts: [{ ...structuredClone(DEFAULT_PROFILE.plan[0]), id: crypto.randomUUID(), name: 'My saved custom workout' }],
    sessionDrafts: [{ date: '2026-11-06', slot: 'main', customized: true,
      plan: { ...structuredClone(DEFAULT_PROFILE.plan[0]), name: 'My Friday date edit' } }],
    masterProgramArchive: [{ savedAt: NOW - 1000, plan: structuredClone(DEFAULT_PROFILE.plan) }],
  });
  const history = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[0], 0, '2026-10-26', profile, []), 'completed'));
  history.startedAt = Date.parse('2026-10-26T10:00:00Z');
  history.finishedAt = history.startedAt + 30 * 60_000;
  history.elapsedMs = 30 * 60_000;
  Object.assign(history.exercises[0].logs[0], { kg: 6, reps: 4, rir: 2, done: true });
  history.notes = 'A real record in this isolated test installation';
  const sessions = [{ session: history, version: 4 }];
  if (active) {
    const current = SessionSchema.parse(createSession(profile.plan[0], 0, TODAY, profile, []));
    current.startedAt = NOW; current.runningSince = null;
    Object.assign(current.exercises[0].logs[0], { kg: 7.5, reps: 4, rir: 3 });
    sessions.unshift({ session: current, version: 2 });
  }
  const reminders = defaultReminderState();
  reminders.entries = [{ entry: { id: reminderEntryId('zinc', '2026-11-01'), reminderId: 'zinc',
    date: '2026-11-01', status: 'later', takenAt: null, updatedAt: NOW - 1000 }, version: 2 }];
  return {
    schemaVersion: 1, profile, profileVersion: 7, sessions,
    nutrition: [
      { id: 'weight-kept', date: '2026-11-01', version: 2,
        payload: NutritionPayloadSchema.parse({ kind: 'weight', kg: 64.2 }) },
      { id: 'meal-kept', date: '2026-11-01', version: 3,
        payload: NutritionPayloadSchema.parse({ kind: 'meal', name: 'Saved partial meal',
          foods: [{ name: 'Quick entry', portion: '1 portion', calories: 500, protein: 30, carbs: null, fat: null }],
          source: 'manual', notes: '', assumptions: '', confidence: null, favorite: true }) },
    ],
    activities: [{ version: 2, activity: { id: 'walk-kept', date: '2026-11-01', type: 'walk', name: 'Saved walk',
      durationMinutes: 20, distanceKm: 1.5, intensity: 'easy', bodyWeightKg: 64, watchCalories: null,
      notes: 'Keep the original activity', createdAt: NOW - 1000, deletedAt: null } }],
    reminders,
    performance: { jumps: [{ id: crypto.randomUUID(), date: '2026-11-01', type: 'standing',
      measurement: 'height', cm: 75, standingReachCm: 235, touchCm: 310, notes: 'Original measurement', source: 'measured' }],
      readiness: [{ id: crypto.randomUUID(), date: TODAY, energy: 'normal', soreness: 'moderate' }] },
    performanceVersion: 3,
  };
}

type Fixture = ReturnType<typeof fixture>;

function recoveryFile(current: Fixture) {
  const plan = createVolleyballMasterPlan();
  const profile = ProfileSchema.parse({ ...structuredClone(current.profile), bodyWeight: 74, restSeconds: 120,
    appearance: 'dark', timerSoundEnabled: false, timerSoundVolume: 0.2,
    plan, preMasterPlan: structuredClone(DEFAULT_PROFILE.plan), masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '13.1', startDate: TODAY, matchWeeks: [1],
      clearance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Backup guidance must not replace current guidance' } },
    trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Not automatically imported' },
    sessionDrafts: [], customWorkouts: [], masterProgramArchive: [],
  });
  return { app: 'Setline', version: 1, exportedAt: '2026-11-01T10:00:00Z',
    data: { ...structuredClone(current), profile, profileVersion: 1, sessions: [], nutrition: [], activities: [],
      reminders: { items: [], entries: [] }, performance: { jumps: [], readiness: [] }, performanceVersion: 1 } };
}

const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE) as Promise<Fixture & { restoreGeneration?: string }>;
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
const safety = (page: Page) => page.evaluate(key => localStorage.getItem(key), SAFETY_COPY);
const restState = (page: Page) => page.evaluate(() => ({
  deadline: sessionStorage.getItem('setline.rest-deadline.v1'),
  owner: sessionStorage.getItem('setline.rest-owner.v16'),
}));

async function seed(page: Page, active = false, appearance: 'light' | 'dark' = 'light') {
  const current = fixture(active, appearance);
  await page.goto('/');
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORE, state: current });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
  return current;
}

async function openRecovery(page: Page) {
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const data = await settingsGroup(page, 'Data & Backup');
  const disclosure = data.locator('.setup-recovery');
  if (!await disclosure.evaluate(element => (element as HTMLDetailsElement).open)) {
    await disclosure.locator(':scope > summary').click();
  }
  const recovery = data.getByRole('region', { name: 'Setup recovery', exact: true });
  await expect(recovery).toBeVisible();
  return recovery;
}

async function chooseFile(page: Page, backup: unknown) {
  await page.getByLabel('Choose setup recovery backup', { exact: true }).setInputFiles({
    name: 'reviewed-setup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
  const preview = page.getByRole('region', { name: 'Setup recovery preview', exact: true });
  await expect(preview).toBeVisible();
  return preview;
}

async function confirmRecovery(page: Page) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.getByRole('button', { name: 'Confirm setup recovery', exact: true }).click(),
  ]);
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(NOW) });
});

test('settings recovery requires review, preserves active work and keeps newer records saved after preview', async ({ page }) => {
  const current = await seed(page, true);
  const incoming = recoveryFile(current);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const exercise = current.sessions[0].session.exercises[0];
  await page.getByRole('button', { name: `Complete ${exercise.name} set 1`, exact: true }).click();
  await expect.poll(async () => (await read(page)).sessions[0].session.exercises[0].logs[0].done).toBe(true);
  const runningRest = await restState(page);
  expect(Number(runningRest.deadline)).toBeGreaterThan(NOW);
  expect(JSON.parse(runningRest.owner!)).toEqual({ sessionId: current.sessions[0].session.id,
    exerciseKey: exercise.key, setId: exercise.logs[0].id });
  const before = await raw(page);
  const recovery = await openRecovery(page);
  await expect(recovery).toContainText('http://127.0.0.1:4173');
  await expect(recovery).toContainText('separate browser data');
  let preview = await chooseFile(page, incoming);
  await expect(preview).toContainText('74 kg');
  expect(await raw(page)).toBe(before);
  await preview.getByRole('button', { name: 'Cancel recovery', exact: true }).click();
  await expect(preview).toHaveCount(0);
  expect(await raw(page)).toBe(before);
  expect(await safety(page)).toBeNull();
  preview = await chooseFile(page, incoming);
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.nutrition.push({ id: 'newer-weight', date: '2026-11-02', version: 1, payload: { kind: 'weight', kg: 64.5 } });
    localStorage.setItem(key, JSON.stringify(state));
  }, STORE);
  const latestRaw = await raw(page);
  const latest = await read(page);
  await confirmRecovery(page);
  const restored = await read(page);
  expect(restored.profile).toEqual({ ...current.profile, bodyWeight: 74, restSeconds: 120,
    appearance: 'dark', timerSoundEnabled: false, timerSoundVolume: 0.2 });
  for (const field of ['sessions', 'nutrition', 'activities', 'reminders', 'performance', 'performanceVersion'] as const) {
    expect(restored[field]).toEqual(latest[field]);
  }
  expect(restored.profileVersion).toBe(current.profileVersion + 1);
  expect(JSON.parse((await safety(page))!).raw).toBe(latestRaw);
  expect(restored.restoreGeneration).toMatch(/^[0-9a-f-]{36}$/);
  expect(await restState(page)).toEqual(runningRest);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  expect(await read(page)).toEqual(restored);
  expect(await restState(page)).toEqual(runningRest);
});

test('training recovery replaces the reviewed week while keeping current guidance, date edits, templates and history', async ({ page }) => {
  const current = await seed(page);
  const incoming = recoveryFile(current);
  const before = await raw(page);
  const recovery = await openRecovery(page);
  await recovery.getByRole('button', { name: 'Training plan only', exact: true }).click();
  const preview = await chooseFile(page, incoming);
  await preview.locator('.setup-recovery__plan > summary').click();
  await expect(preview).toContainText(incoming.data.profile.plan[0].name);
  await expect(recovery).toContainText('Medical-clearance flags from this backup are not applied');
  expect(await raw(page)).toBe(before);
  await confirmRecovery(page);
  const restored = await read(page);
  expect(restored.profile.plan).toEqual(incoming.data.profile.plan);
  expect(restored.profile.preMasterPlan).toEqual(incoming.data.profile.preMasterPlan);
  expect(restored.profile.masterMatchWeekend).toEqual(incoming.data.profile.masterMatchWeekend);
  expect(restored.profile.masterProgram).toEqual({ ...incoming.data.profile.masterProgram,
    clearance: current.profile.trainingGuidance });
  expect(restored.profile.trainingGuidance).toEqual(current.profile.trainingGuidance);
  for (const field of ['bodyWeight', 'restSeconds', 'appearance', 'nutrition', 'volleyballSchedule',
    'customWorkouts', 'sessionDrafts', 'masterProgramArchive'] as const) {
    expect(restored.profile[field]).toEqual(current.profile[field]);
  }
  for (const field of ['sessions', 'nutrition', 'activities', 'reminders', 'performance', 'performanceVersion'] as const) {
    expect(restored[field]).toEqual(current[field]);
  }
  expect(JSON.parse((await safety(page))!).raw).toBe(before);
});

test('active workout blocks plan recovery while settings recovery remains available', async ({ page }) => {
  const current = await seed(page, true);
  const before = await raw(page);
  const recovery = await openRecovery(page);
  await expect(recovery.getByRole('button', { name: 'Training plan only', exact: true })).toBeDisabled();
  await expect(recovery).toContainText('Finish your active workout');
  await expect(recovery.getByRole('button', { name: 'Settings only', exact: true })).toBeEnabled();
  await chooseFile(page, recoveryFile(current));
  await expect(page.getByRole('heading', { name: 'Review settings recovery', exact: true })).toBeVisible();
  expect(await raw(page)).toBe(before);
  expect(await safety(page)).toBeNull();
});

test('invalid recovery files never change current records or the safety copy', async ({ page }) => {
  const current = await seed(page);
  const before = await raw(page);
  const recovery = await openRecovery(page);
  await recovery.getByLabel('Choose setup recovery backup', { exact: true }).setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid'),
  });
  await expect(recovery.getByRole('alert')).toContainText('not valid JSON');
  const broken = recoveryFile(current);
  (broken.data.sessions as unknown[]) = [{ session: { id: 'not-a-valid-workout' }, version: 1 }];
  await recovery.getByLabel('Choose setup recovery backup', { exact: true }).setInputFiles({
    name: 'invalid-history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)),
  });
  await expect(recovery.getByRole('alert')).toContainText('saved workout is invalid');
  await expect(recovery.getByRole('region', { name: 'Setup recovery preview', exact: true })).toHaveCount(0);
  expect(await raw(page)).toBe(before);
  expect(await safety(page)).toBeNull();
});

test('a settings change in another tab invalidates a recovery preview without overwriting the new value', async ({ page, context }) => {
  const current = await seed(page);
  const recovery = await openRecovery(page);
  await chooseFile(page, recoveryFile(current));
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('tab', { name: 'You', exact: true }).click();
  await other.getByRole('button', { name: 'Settings', exact: true }).click();
  const training = await settingsGroup(other, 'Training');
  await training.getByLabel('Body weight · kg', { exact: true }).fill('69.5');
  await training.getByRole('button', { name: 'Save training defaults', exact: true }).click();
  await expect.poll(async () => (await read(other)).profile.bodyWeight).toBe(69.5);
  const changed = await raw(other);
  await recovery.getByRole('button', { name: 'Confirm setup recovery', exact: true }).click();
  await expect(recovery.getByRole('alert')).toContainText('setup changed after this preview');
  expect(await raw(page)).toBe(changed);
  expect(await safety(page)).toBeNull();
  await recovery.getByRole('button', { name: 'Review current setup again', exact: true }).click();
  await expect(recovery.getByRole('region', { name: 'Setup recovery preview', exact: true })).toContainText('69.5 kg');
  expect(await raw(page)).toBe(changed);
  await other.close();
});

for (const appearance of ['light', 'dark'] as const) {
  test(`setup recovery review fits a 320px phone and retains keyboard actions in ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const current = await seed(page, false, appearance);
    const before = await raw(page);
    const recovery = await openRecovery(page);
    const preview = await chooseFile(page, recoveryFile(current));
    // The clipped native picker is triggered by the full-size Choose button;
    // it must not add a second, unreachable control to keyboard/VoiceOver order.
    await expect(recovery.getByRole('button', { name: 'Choose setup recovery backup', exact: true })).toHaveCount(0);
    for (const button of await recovery.getByRole('button').all()) {
      const size = (await button.boundingBox())!;
      const name = (await button.textContent())?.trim() ?? 'Recovery control';
      expect(size.height, `${name} height`).toBeGreaterThanOrEqual(44);
      expect(size.width, `${name} width`).toBeGreaterThanOrEqual(44);
    }
    const sheet = page.getByRole('dialog', { name: 'Your preferences', exact: true });
    expect(await sheet.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await recovery.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const cancel = preview.getByRole('button', { name: 'Cancel recovery', exact: true });
    await cancel.scrollIntoViewIfNeeded();
    await cancel.focus();
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(preview).toHaveCount(0);
    expect(await raw(page)).toBe(before);
    await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
  });
}

test('an already hydrated installation refuses to replace vanished records with default settings', async ({ page }) => {
  await seed(page);
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const appearance = await settingsGroup(page, 'Appearance & Sound');
  await page.evaluate(key => localStorage.removeItem(key), STORE);
  await appearance.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.getByText(/Saved data disappeared from this app address while it was open/)).toBeVisible();
  expect(await raw(page)).toBeNull();
  expect(await safety(page)).toBeNull();
});
