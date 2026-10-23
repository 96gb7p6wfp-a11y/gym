import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';

const STORE = 'setline.gym.v1';

async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

async function openEntry(page: Page) {
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Log jump', exact: true }).click();
  return page.getByRole('dialog', { name: 'Log jump', exact: true });
}

async function details(page: Page) {
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Performance details', exact: true }).click();
  return page.getByRole('region', { name: 'Performance details', exact: true });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-22T10:00:00Z') });
  await page.goto('/');
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [], activities: [],
    nutrition: [{ id: 'existing-weight', date: '2026-10-20', version: 1, payload: { kind: 'weight', kg: 64.2 } }],
  })), { key: STORE, profile: DEFAULT_PROFILE });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
});

test('one reach test saves separate standing and approach heights atomically and survives refresh', async ({ page }) => {
  const before = await state(page);
  const entry = await openEntry(page);
  await entry.getByLabel('Standing reach in centimetres', { exact: true }).fill('235');
  await entry.getByLabel('Standing-jump touch in centimetres', { exact: true }).fill('310,5');
  await entry.getByLabel('Approach-jump touch in centimetres', { exact: true }).fill('316');
  await expect(entry.locator('[aria-label="Calculated jump heights"]')).toContainText('75.5 cm');
  await expect(entry.locator('[aria-label="Calculated jump heights"]')).toContainText('81 cm');
  await entry.getByLabel('Date', { exact: true }).fill('2026-10-21');
  await entry.getByText('Add a note', { exact: true }).click();
  await entry.getByLabel('Jump notes', { exact: true }).fill('Same wall, volleyball shoes.');
  await entry.getByRole('button', { name: 'Save jump', exact: true }).click();
  await expect(entry).not.toBeVisible();
  const saved = await state(page);
  expect(saved.performanceVersion).toBe((before.performanceVersion ?? 0) + 1);
  expect(saved.performance.jumps).toEqual([
    expect.objectContaining({ type: 'standing', measurement: 'height', cm: 75.5, standingReachCm: 235, touchCm: 310.5, date: '2026-10-21', source: 'measured', notes: 'Same wall, volleyball shoes.' }),
    expect.objectContaining({ type: 'approach', measurement: 'height', cm: 81, standingReachCm: 235, touchCm: 316, date: '2026-10-21', source: 'measured' }),
  ]);
  expect(saved.sessions).toEqual(before.sessions);
  expect(saved.profile).toEqual(before.profile);
  const performance = page.getByRole('region', { name: 'Performance details', exact: true });
  await expect(performance.getByRole('region', { name: 'Standing jump height', exact: true })).toContainText('75.5');
  await expect(performance.getByRole('region', { name: 'Approach jump height', exact: true })).toContainText('81');
  await expect(performance.getByRole('img')).toHaveCount(0);
  await page.reload();
  const restored = await details(page);
  await expect(restored.getByRole('region', { name: 'Standing jump height', exact: true })).toContainText('75.5');
  await expect(restored.getByRole('region', { name: 'Approach jump height', exact: true })).toContainText('81');
});

test('a video estimate stays labeled and cannot become a measured trend or personal best', async ({ page }) => {
  const entry = await openEntry(page);
  await entry.getByLabel('Standing reach in centimetres', { exact: true }).fill('235');
  await entry.getByLabel('Approach-jump touch in centimetres', { exact: true }).fill('320');
  await entry.locator('summary').filter({ hasText: /^Measurement method/ }).click();
  await entry.getByRole('button', { name: 'Video estimate', exact: true }).click();
  await expect(entry).toContainText('not a confirmed personal record');
  await entry.getByRole('button', { name: 'Save jump', exact: true }).click();
  await expect(entry).not.toBeVisible();
  const performance = page.getByRole('region', { name: 'Performance details', exact: true });
  await expect(performance.getByRole('region', { name: 'Approach jump height', exact: true })).toHaveCount(0);
  await expect(performance.getByRole('img')).toHaveCount(0);
  await performance.locator('summary').filter({ hasText: 'Recent jump entries' }).click();
  await expect(performance.locator('.performance-entry')).toContainText('Video estimate');
  await expect(performance.locator('.performance-entry')).toContainText('85 cm');
  await page.reload();
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('group', { name: 'Chart metric', exact: true }).getByRole('button', { name: 'Jump', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Jump performance', exact: true })).toContainText('Your first jump.');
  await expect(page.getByRole('region', { name: 'Progress summary', exact: true })).not.toContainText('85');
});

test('touch must exceed reach and an unmeasured jump is never saved', async ({ page }) => {
  const entry = await openEntry(page);
  await entry.getByLabel('Standing reach in centimetres', { exact: true }).fill('235');
  await entry.getByRole('button', { name: 'Save jump', exact: true }).click();
  await expect(entry.getByRole('alert')).toContainText('Enter a standing-jump or approach-jump touch height.');
  await entry.getByLabel('Approach-jump touch in centimetres', { exact: true }).fill('230');
  await entry.getByRole('button', { name: 'Save jump', exact: true }).click();
  await expect(entry.getByRole('alert')).toContainText('Jump touch must be above standing reach.');
  expect((await state(page)).performance?.jumps ?? []).toHaveLength(0);
});

for (const width of [320, 390, 430]) {
  test(`reach entry and measurement guide remain usable on a ${width}px iPhone`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--app-safe-area-top', '47px');
      document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
    });
    const entry = await openEntry(page);
    const close = entry.getByRole('button', { name: 'Close', exact: true });
    const closeBox = (await close.boundingBox())!;
    expect(closeBox.height).toBeGreaterThanOrEqual(44);
    expect(closeBox.y).toBeGreaterThanOrEqual(47);
    await entry.getByLabel('Standing reach in centimetres', { exact: true }).fill('235');
    await entry.getByLabel('Standing-jump touch in centimetres', { exact: true }).fill('310');
    await entry.locator('summary').filter({ hasText: 'How to measure' }).click();
    await expect(entry).toContainText('Take three attempts');
    await expect(entry).toContainText('Known-height reference');
    await expect(entry).toContainText('Slow-motion video');
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width);
    const save = entry.getByRole('button', { name: 'Save jump', exact: true });
    await save.scrollIntoViewIfNeeded();
    const box = (await save.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await save.tap();
    await expect(entry).not.toBeVisible();
    expect((await state(page)).performance.jumps[0]).toMatchObject({ type: 'standing', cm: 75 });
  });
}


test('an open jump measurement survives midnight and PWA resume without losing the test date', async ({ page }) => {
  const entry = await openEntry(page);
  await entry.getByLabel('Standing reach in centimetres', { exact: true }).fill('235');
  await entry.getByLabel('Approach-jump touch in centimetres', { exact: true }).fill('317');
  await entry.locator('summary').filter({ hasText: 'Add a note' }).click();
  await entry.getByLabel('Jump notes', { exact: true }).fill('Best of three at the same wall.');
  await page.clock.setSystemTime(new Date('2026-10-22T23:10:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(entry.getByLabel('Date', { exact: true })).toHaveAttribute('max', '2026-10-23');
  await expect(entry.getByLabel('Date', { exact: true })).toHaveValue('2026-10-22');
  await expect(entry.getByLabel('Standing reach in centimetres', { exact: true })).toHaveValue('235');
  await expect(entry.getByLabel('Jump notes', { exact: true })).toHaveValue('Best of three at the same wall.');
  await entry.getByRole('button', { name: 'Save jump', exact: true }).click();
  await expect(entry).not.toBeVisible();
  expect((await state(page)).performance.jumps[0]).toMatchObject({ date: '2026-10-22', cm: 82 });
});
