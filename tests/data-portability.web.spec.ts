import { expect, test, type Page } from '@playwright/test';
import { openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';

async function dataSettings(page: Page) {
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.locator('.data-settings');
}

test('settings identify the actual data origin and copying it leaves records untouched', async ({ page }) => {
  await page.goto('/');
  const settings = await dataSettings(page);
  const address = await page.evaluate(() => window.location.origin);
  await expect(settings.locator('code')).toHaveText(address);
  await expect(settings).toContainText('Another website address has separate records');
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { (window as any).__copiedSetlineAddress = text; } },
    });
  });
  await settings.getByRole('button', { name: 'Copy app address', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__copiedSetlineAddress)).toBe(address);
  await expect(settings.getByRole('status')).toContainText('App address copied');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('on supported devices the backup share contains the full current data without modifying it', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async ({ files }: { files: File[] }) => {
        (window as any).__sharedSetlineBackup = { name: files[0].name, text: await files[0].text() };
      },
    });
  });
  await page.goto('/');
  const settings = await dataSettings(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await settings.getByRole('button', { name: 'Save to Files / share', exact: true }).click();
  const shared = await page.evaluate(() => (window as any).__sharedSetlineBackup);
  expect(shared.name).toMatch(/^setline-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(shared.text);
  expect(backup.app).toBe('Setline');
  expect(backup.version).toBe(1);
  if (before) expect(backup.data).toEqual(JSON.parse(before));
  else expect(backup.data).toMatchObject({ schemaVersion: 1, sessions: [], nutrition: [] });
  await expect(settings.getByRole('status')).toContainText('Confirm the backup was saved');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('canceling the backup share does not claim a saved backup', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => { throw new DOMException('Cancelled', 'AbortError'); },
    });
  });
  await page.goto('/');
  const settings = await dataSettings(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await settings.getByRole('button', { name: 'Save to Files / share', exact: true }).click();
  await expect(settings.getByRole('status')).toContainText('Backup sharing was cancelled');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});
