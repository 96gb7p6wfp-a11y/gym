import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { BACKUP_STATUS_KEY, BACKUP_REMINDER_AFTER_MS } from '../src/backup-status';
import { settingsGroup, openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';
async function settings(page: Page) {
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settingsGroup(page, 'Data & Backup');
  return page.locator('.data-settings');
}
test.beforeEach(async ({ page }) => {
  // Existing data must stay existing; trust UX must not require new onboarding.
  await page.addInitScript(({ key, profile }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [] }));
  }, { key: STORE, profile: DEFAULT_PROFILE });
});

test('export records only a known action until the user explicitly checks an external file', async ({ page }) => {
  await page.goto('/');
  const data = await settings(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await expect(data.getByRole('definition').filter({ hasText: 'No saved file confirmed by you' })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await data.getByRole('button', { name: 'Export backup', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/^setline-backup-/);
  await expect(data.getByLabel('Backup status')).toContainText('Download requested');
  await expect(data.getByLabel('Backup status')).toContainText('No saved file confirmed by you');
  await data.getByRole('button', { name: 'I checked my saved backup file', exact: true }).click();
  await expect(data.getByLabel('Backup status')).toContainText('You confirmed a saved file');
  await expect(data.getByRole('status')).toContainText('Setline cannot verify external storage');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('backup reminder can be dismissed without changing workouts or pretending an export occurred', async ({ page }) => {
  await page.addInitScript(({ key, age }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify({ version: 1, firstSeenAt: Date.now() - age })); }, { key: BACKUP_STATUS_KEY, age: BACKUP_REMINDER_AFTER_MS + 1000 });
  await page.goto('/');
  await openSection(page, 'You');
  const reminder = page.getByLabel('Backup reminder', { exact: true });
  await expect(reminder).toBeVisible();
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await reminder.getByRole('button', { name: 'Remind me in 7 days', exact: true }).click();
  await expect(reminder).toHaveCount(0);
  const metadata = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), BACKUP_STATUS_KEY);
  expect(metadata.externalCopyConfirmedAt).toBeUndefined();
  expect(metadata.lastExportAction).toBeUndefined();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
  await page.reload();
  await openSection(page, 'You');
  await expect(page.getByLabel('Backup reminder', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('local problem report includes no diagnostics until opted in and never includes personal storage', async ({ page }) => {
  await page.goto('/');
  await settings(page);
  const support = page.getByLabel('Privacy and support', { exact: true });
  await support.locator('summary', { hasText: 'Report a Problem' }).click();
  await support.getByLabel('What happened?', { exact: true }).fill('Rest timer did not play');
  expect(await support.getByRole('textbox', { name: 'Report preview', exact: true }).evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  let preview = JSON.parse(await support.getByRole('textbox', { name: 'Report preview', exact: true }).inputValue());
  expect(preview.diagnostics).toBeUndefined();
  await support.getByLabel('Include app and browser diagnostics (optional)', { exact: true }).check();
  preview = JSON.parse(await support.getByRole('textbox', { name: 'Report preview', exact: true }).inputValue());
  expect(preview.diagnostics.appVersion).toBe('Setline V18');
  expect(Object.keys(preview.diagnostics).sort()).toEqual(['appVersion', 'browser', 'connection', 'localStorage', 'presentation', 'serviceWorker', 'viewport']);
  const downloaded = page.waitForEvent('download');
  await support.getByRole('button', { name: 'Export report', exact: true }).click();
  const text = await readFile((await (await downloaded).path())!, 'utf8');
  expect(JSON.parse(text)).toEqual(preview);
  for (const privateField of ['bodyWeight', 'masterProgram', 'sessions', 'nutrition', 'restoreGeneration', 'userAgent', 'http://']) expect(text).not.toContain(privateField);
  await expect(support.getByRole('status')).toContainText('It has not been sent');
});

test('domain transfer instructions preserve source data and explain destination replacement', async ({ page }) => {
  await page.goto('/');
  const data = await settings(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await data.locator('summary', { hasText: 'Move to another device or website' }).click();
  await expect(data).toContainText('Restore replaces the destination records');
  await expect(data).toContainText('does not copy data between website addresses automatically or clear the original copy');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});


test('invalid backup and cancelled review preserve both current records and external-file status', async ({ page }) => {
  await page.goto('/');
  const data = await settings(page);
  await data.getByRole('button', { name: 'I checked my saved backup file', exact: true }).click();
  const before = await page.evaluate(({ main, metadata }) => ({ records: localStorage.getItem(main), status: localStorage.getItem(metadata) }), { main: STORE, metadata: BACKUP_STATUS_KEY });
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
  await expect(data.getByRole('alert')).toContainText('not valid JSON');
  expect(await page.evaluate(({ main, metadata }) => ({ records: localStorage.getItem(main), status: localStorage.getItem(metadata) }), { main: STORE, metadata: BACKUP_STATUS_KEY })).toEqual(before);
  const download = page.waitForEvent('download');
  await data.getByRole('button', { name: 'Export backup', exact: true }).click();
  const file = await readFile((await (await download).path())!, 'utf8');
  const exported = await page.evaluate(key => localStorage.getItem(key), BACKUP_STATUS_KEY);
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await expect(data.getByRole('region', { name: 'Backup restore preview' })).toBeVisible();
  await data.getByRole('button', { name: 'Cancel restore', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before.records);
  expect(await page.evaluate(key => localStorage.getItem(key), BACKUP_STATUS_KEY)).toBe(exported);
});
