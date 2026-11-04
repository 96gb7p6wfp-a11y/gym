import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seed(page: Page, { date = '2026-11-05', match = false, cleared = true, appearance = 'dark' as 'light' | 'dark' } = {}) {
  await page.clock.install({ time: new Date(`${date}T11:00:00Z`) });
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance,
    plan: createVolleyballMasterPlan(), masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: match ? [1] : [],
      clearance: { impact: cleared ? 'cleared' : 'unknown', heavyLifting: cleared ? 'cleared' : 'unknown' } } });
  await page.addInitScript(({ key, profile }) => {
    if (!localStorage.getItem(key) || JSON.parse(localStorage.getItem(key)!).profileVersion === 0) localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [] }));
  }, { key: STORE, profile });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
}

for (const appearance of ['light', 'dark'] as const) test(`V13.1 Thursday preview retains exact list and explains paired rounds in ${appearance}`, async ({ page }) => {
  await seed(page, { appearance });
  const before = await read(page);
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  const rows = preview.locator('ol[aria-label="Scheduled exercises"] > li');
  await expect(rows).toHaveCount(10);
  await expect(rows.nth(5)).toContainText('Reverse Pec Deck');
  await expect(rows.nth(5)).toContainText('3 × 12–20 reps');
  await expect(rows.nth(6)).toContainText('Cable Lateral Raise');
  await expect(rows.nth(6)).toContainText('2 × 12–20 reps');
  await preview.getByText('Superset order', { exact: true }).click();
  const pairs = preview.getByRole('list', { name: 'Prescribed supersets', exact: true });
  await expect(pairs).toContainText('Cable Lateral Raise → Reverse Pec Deck');
  await expect(pairs).toContainText('2 paired rounds · 75 sec after each pair');
  await expect(pairs).toContainText('Reverse Pec Deck: 1 remaining set separately · 75 sec rest.');
  await expect(pairs).toContainText('Incline Dumbbell Curl → Rope Triceps Extension');
  await expect(pairs).toContainText('3 paired rounds · 75 sec after each pair');
  expect(await read(page)).toEqual(before);
  await page.screenshot({ path: test.info().outputPath(`v131-thursday-preview-${appearance}.png`) });
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await expect(warmup).toBeVisible();
  await expect(warmup.getByRole('list', { name: 'Quick warm-up exercises', exact: true }).locator(':scope > li')).toHaveCount(5);
  await expect(warmup).toContainText('Shoulder + Trunk quick prep');
  await expect(warmup.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  expect((await read(page)).sessions).toHaveLength(0);
  await page.screenshot({ path: test.info().outputPath(`v131-thursday-warmup-${appearance}.png`) });
});

test('unknown clearance previews easy preparation and does not restore impact warm-up drills', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, { date: '2026-11-02', cleared: false });
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview.getByRole('button', { name: 'Exercise details for Max Approach Jump', exact: true })).toHaveCount(0);
  await preview.locator('details.plan-preview__warmup > summary').click();
  const warmup = preview.getByRole('list', { name: 'Preview warm-up exercises', exact: true });
  await expect(warmup).not.toContainText(/Progressive Practice Jumps|Pogo|Throw Rehearsal/);
  await expect(preview.locator('details.plan-preview__warmup')).toContainText('3–5 min');
  await expect(preview).toContainText('Do not add heavy loading, maximal jumps or ballistic work');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await read(page)).sessions).toHaveLength(0);
  await page.screenshot({ path: test.info().outputPath('v131-unknown-clearance-small.png') });
});

test('match-week Saturday preparation is included and never blocks starting on an empty checklist', async ({ page }) => {
  await seed(page, { date: '2026-11-07', match: true });
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await expect(warmup).toBeVisible();
  await expect(warmup).toContainText('Preparation is already part of this easy session');
  await expect(warmup.getByRole('status', { name: 'Warm-up progress', exact: true })).toHaveText('No preparation checklist needed');
  await expect(warmup).not.toContainText('0 of 0');
  await expect(warmup.getByRole('button', { name: 'Mark warm-up complete', exact: true })).toHaveCount(0);
  await expect(warmup.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  expect((await read(page)).sessions).toHaveLength(0);
});

test('editing planned pair rest updates both partners for that date and retains the standalone rear set rest', async ({ page }) => {
  await seed(page);
  const before = await read(page);
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await preview.getByRole('button', { name: 'Options for Cable Lateral Raise', exact: true }).click();
  await page.getByRole('dialog', { name: 'Cable Lateral Raise', exact: true }).getByRole('button', { name: 'Sets, reps & rest', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit exercise', exact: true });
  await expect(editor.getByRole('spinbutton', { name: 'Rest after pair · seconds', exact: true })).toHaveValue('75');
  await editor.getByRole('spinbutton', { name: 'Rest after pair · seconds', exact: true }).fill('90');
  await editor.getByRole('button', { name: 'Save for this day', exact: true }).click();
  await expect(editor).not.toBeVisible();
  const pairedRows = preview.locator('.plan-preview__exercise').filter({ hasText: 'Superset A' });
  await expect(pairedRows).toHaveCount(2);
  await expect(pairedRows.locator('.plan-preview__pair')).toHaveText(['Superset A', 'Superset A']);
  await expect(pairedRows.locator('.plan-preview__dose')).toHaveText([/90 sec after pair/, /90 sec after pair/]);
  const after = await read(page);
  const day = after.profile.sessionDrafts.find((draft: { date: string }) => draft.date === '2026-11-05').plan;
  const shoulders = day.exercises.filter((exercise: { superset?: { id: string } }) => exercise.superset?.id === 'v131-shoulders');
  expect(shoulders.map((exercise: { superset: { restAfterRound: number } }) => exercise.superset.restAfterRound)).toEqual([90, 90]);
  expect(shoulders.find((exercise: { name: string }) => exercise.name === 'Reverse Pec Deck').rest).toBe(75);
  expect(after.profile.plan).toEqual(before.profile.plan);
  expect(after.sessions).toEqual(before.sessions);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(pairedRows).toHaveCount(2);
  await expect(pairedRows.locator('.plan-preview__dose')).toHaveText([/90 sec after pair/, /90 sec after pair/]);
});
