import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, PlanDaySchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';

const STORE = 'setline.gym.v1';
const TODAY = '2026-11-14';
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);

async function seed(page: Page, appearance: 'light' | 'dark') {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00Z`) });
  await page.goto('/');
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), presentationMode: 'athlete', appearance });
  const plan = PlanDaySchema.parse({ name: 'Isolated iPad progress fixture', kind: 'strength', minutes: 60, note: '',
    exercises: [
      { ...toPlanExercise(findLibraryExercise('Hack Squat')!), equipmentLabel: 'QA hack machine', sets: 1 },
      { ...toPlanExercise(findLibraryExercise('Romanian Deadlift')!), equipmentLabel: 'QA platform', sets: 1 },
    ], warmup: [], cooldown: [] });
  const sessions = ['2026-11-02', '2026-11-09'].map((date, index) => {
    const session = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, date, profile, []), 'completed'));
    session.exercises.forEach((exercise, exerciseIndex) => exercise.logs.forEach(log => {
      Object.assign(log, { done: true, kg: 60 + exerciseIndex * 10 + index * 5, reps: 6, rir: 2 });
    }));
    return { session, version: 1 };
  });
  const nutrition = ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13']
    .map((date, index) => ({ id: crypto.randomUUID(), date, version: 1, payload: { kind: 'weight', kg: 70 + index / 10 } }));
  const jumps = ['2026-11-02', '2026-11-09'].flatMap((date, index) => (['standing', 'approach'] as const).map(type => {
    const cm = (type === 'standing' ? 65 : 70) + index;
    return { id: crypto.randomUUID(), date, type, measurement: 'height', cm, standingReachCm: 235, touchCm: 235 + cm,
      source: 'measured', conditions: 'Same isolated QA indoor setup', notes: '' };
  }));
  await page.evaluate(({ profile, sessions, nutrition, jumps }) => {
    const state = JSON.parse(localStorage.getItem('setline.gym.v1')!);
    localStorage.setItem('setline.gym.v1', JSON.stringify({ ...state, profile, profileVersion: state.profileVersion + 1,
      sessions, nutrition, performance: { jumps, readiness: [] }, performanceVersion: 1 }));
  }, { profile, sessions, nutrition, jumps });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
}

for (const { width, height, appearance } of [
  { width: 1024, height: 768, appearance: 'dark' as const },
  { width: 1366, height: 1024, appearance: 'light' as const },
]) {
  test(`iPad Progress keeps one selected chart and its recorded data through narrow resizing at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await seed(page, appearance);
    const before = await raw(page);
    await page.getByRole('tab', { name: 'Progress', exact: true }).click();
    const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
    const primary = overview.locator('.progress-workspace__primary');
    const secondary = overview.locator('.progress-workspace__supporting');
    const [mainBounds, sideBounds] = await Promise.all([primary.boundingBox(), secondary.boundingBox()]);
    expect(mainBounds).not.toBeNull(); expect(sideBounds).not.toBeNull();
    expect(sideBounds!.x).toBeGreaterThanOrEqual(mainBounds!.x + mainBounds!.width + 15);
    expect(mainBounds!.width).toBeLessThanOrEqual(760);
    await expect(overview.getByRole('group', { name: 'Chart metric', exact: true })).toHaveCount(1);
    const selection = overview.getByRole('combobox', { name: 'Strength exercise', exact: true });
    await selection.selectOption({ label: 'Romanian Deadlift · QA platform' });
    const selected = await selection.inputValue();
    await expect(overview.getByRole('region', { name: 'Strength trend', exact: true })).toContainText('Romanian Deadlift');
    await page.screenshot({ path: testInfo.outputPath(`progress-${width}-${appearance}.png`), fullPage: true });
    await page.setViewportSize({ width: 820, height: 1180 });
    expect(await overview.locator('.progress-workspace').evaluate(element => getComputedStyle(element).display)).toBe('contents');
    await expect(selection).toHaveValue(selected);
    await expect(overview.locator('.progress-lens-card')).toHaveCount(1);
    await page.setViewportSize({ width, height });
    await expect(selection).toHaveValue(selected);
    const metrics = overview.getByRole('group', { name: 'Chart metric', exact: true });
    await metrics.getByRole('button', { name: 'Jump', exact: true }).click();
    await expect(overview.getByRole('region', { name: 'Jump performance', exact: true })).toContainText('Same isolated QA indoor setup');
    await metrics.getByRole('button', { name: 'Body weight', exact: true }).click();
    await expect(overview.getByRole('region', { name: 'Body weight trend', exact: true }).getByRole('img')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await raw(page)).toBe(before);
  });

  test(`iPad Settings keeps its group list beside the same unsaved form at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await seed(page, appearance);
    const before = await raw(page);
    await page.getByRole('tab', { name: 'You', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
    const groups = settings.getByRole('navigation', { name: 'Settings groups', exact: true });
    const training = settings.getByRole('region', { name: 'Training', exact: true });
    await expect(groups).toBeVisible(); await expect(training).toBeVisible();
    await expect(groups.getByRole('button', { name: 'Training', exact: true })).toHaveAttribute('aria-current', 'page');
    const [navBounds, panelBounds] = await Promise.all([groups.boundingBox(), training.boundingBox()]);
    expect(panelBounds!.x).toBeGreaterThan(navBounds!.x + navBounds!.width);
    const weight = training.getByLabel('Body weight · kg', { exact: true });
    await weight.fill('73.5');
    await training.getByLabel('Default rest · seconds', { exact: true }).fill('112');
    await groups.getByRole('button', { name: 'Appearance & Sound', exact: true }).press('Enter');
    await expect(settings.getByRole('heading', { name: 'Appearance & Sound', exact: true })).toBeFocused();
    await expect(groups).toBeVisible();
    await groups.getByRole('button', { name: 'Data & Backup', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Export backup', exact: true })).toBeVisible();
    await groups.getByRole('button', { name: 'Training', exact: true }).click();
    await expect(weight).toHaveValue('73.5');
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}-${appearance}.png`), fullPage: true });
    await page.setViewportSize({ width: 430, height: 932 });
    await expect(groups).toBeHidden();
    await expect(weight).toHaveValue('73.5');
    await settings.getByRole('button', { name: 'All settings', exact: true }).click();
    await expect(groups).toBeVisible();
    await page.setViewportSize({ width, height });
    await expect(training).toBeVisible();
    await expect(weight).toHaveValue('73.5');
    await expect(training.getByLabel('Default rest · seconds', { exact: true })).toHaveValue('112');
    expect(await settings.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await raw(page)).toBe(before);
  });
}
