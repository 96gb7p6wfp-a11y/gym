import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';
async function settings(page: Page) {
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.locator('.data-settings');
}
async function backup(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}

test('reviewing, cancelling and declining a restore preserve all current records', async ({ page }) => {
  await page.goto('/');
  const data = await settings(page);
  const incoming = await backup(page);
  incoming.data.profile.bodyWeight = 91;
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  const file = { name: 'incoming.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) };
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles(file);
  await expect(data.getByRole('region', { name: 'Backup restore preview' })).toContainText('Restore replaces all current local records');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
  await data.getByRole('button', { name: 'Cancel restore', exact: true }).click();
  await expect(data.getByRole('region', { name: 'Backup restore preview' })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles(file);
  page.once('dialog', dialog => dialog.dismiss());
  await data.getByRole('button', { name: 'Restore backup', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
  await expect(data.getByRole('region', { name: 'Backup restore preview' })).toBeVisible();
});

test('restore retains exportable previous records after reload', async ({ page }) => {
  await page.goto('/');
  let data = await settings(page);
  const old = await backup(page);
  const preferences = page.getByRole('dialog');
  await preferences.getByLabel('Body weight · kg', { exact: true }).fill('73');
  await preferences.getByRole('button', { name: 'Save preferences', exact: true }).click();
  data = await settings(page);
  const saved = await backup(page);
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'older.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([page.waitForNavigation(), data.getByRole('button', { name: 'Restore backup', exact: true }).click()]);
  data = await settings(page);
  await expect(page.getByLabel('Body weight · kg', { exact: true })).toHaveValue(String(old.data.profile.bodyWeight));
  const download = page.waitForEvent('download');
  await data.getByRole('button', { name: 'Export pre-restore safety copy', exact: true }).click();
  const prior = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  expect(prior.data).toEqual(saved.data);
});

test('share cancellation never claims a saved backup or modifies records', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  });
  await page.goto('/');
  const data = await settings(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await data.getByRole('button', { name: 'Save to Files / share', exact: true }).click();
  await expect(data.getByRole('status')).toHaveText('Backup sharing was cancelled. No records were changed.');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('a blocked safety-copy write aborts restore without replacing records', async ({ page }) => {
  await page.goto('/');
  const data = await settings(page);
  // Persist a valid current state before simulating a quota failure.
  const current = await backup(page);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORE, value: current.data });
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  const incoming = structuredClone(current);
  incoming.data.profile.bodyWeight = 99;
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'new.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'setline.gym.pre-restore.v1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  page.once('dialog', dialog => dialog.accept());
  await data.getByRole('button', { name: 'Restore backup', exact: true }).click();
  await expect(data.getByRole('alert')).toContainText('No records were replaced');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('native share contains the full backup and asks the user to verify the file', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async ({ files }: { files: File[] }) => { (window as any).__sharedBackup = await files[0].text(); },
    });
  });
  await page.goto('/');
  const data = await settings(page);
  const expected = await backup(page);
  await data.getByRole('button', { name: 'Save to Files / share', exact: true }).click();
  const shared = JSON.parse(await page.evaluate(() => (window as any).__sharedBackup));
  expect(shared.app).toBe('Setline');
  expect(shared.version).toBe(1);
  expect(shared.data).toEqual(expected.data);
  await expect(data.getByRole('status')).toContainText('Confirm the backup was saved');
});

test('unsupported file sharing provides download fallback and preserves records', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('Must not call share'); } });
  });
  await page.goto('/');
  const data = await settings(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await data.getByRole('button', { name: 'Save to Files / share', exact: true }).click();
  await expect(data.getByRole('alert')).toHaveText('File sharing is unavailable here. Use Export backup instead.');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
  const downloaded = page.waitForEvent('download');
  await data.getByRole('button', { name: 'Export backup', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/^setline-backup-/);
  await expect(data.getByRole('status')).toContainText('Backup download requested');
});

test('an already open tab cannot save preferences over a restored backup', async ({ page, context }) => {
  await page.goto('/');
  let data = await settings(page);
  await page.getByLabel('Body weight · kg', { exact: true }).fill('73');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  data = await settings(page);
  const incoming = await backup(page);
  incoming.data.profile.bodyWeight = 82;
  const stalePage = await context.newPage();
  await stalePage.goto('/');
  await settings(stalePage);
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'other-phone.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([page.waitForNavigation(), data.getByRole('button', { name: 'Restore backup', exact: true }).click()]);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await stalePage.getByLabel('Body weight · kg', { exact: true }).fill('99');
  await stalePage.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(stalePage.getByText('Local data was restored in another tab. Reload the app before saving changes.', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
  await stalePage.close();
});
