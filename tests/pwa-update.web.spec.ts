import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, createSession } from '../src/domain.js';

const STORE = 'setline.gym.v1';

async function setup(page: Page, mode: 'current' | 'legacy' | 'ready' = 'current', active = false) {
  const session = active ? createSession(DEFAULT_PROFILE.plan[0], 0, '2026-10-19', DEFAULT_PROFILE, []) : undefined;
  await page.addInitScript(({ key, profile, session, mode }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1, profile, profileVersion: 1, sessions: session ? [{ session, version: 1 }] : [], nutrition: [], activities: [],
    }));
    const probe = { checks: 0, requests: 0 };
    (window as any).__pwaUpdateProbe = probe;
    const waiting = mode === 'current' || sessionStorage.getItem('update-test-complete') ? null : {
      postMessage(_message: unknown, ports: MessagePort[]) {
        probe.requests++;
        if (mode === 'legacy') return;
        ports[0].postMessage({ accepted: true });
        sessionStorage.setItem('update-test-complete', '1');
        setTimeout(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')), 50);
      },
    };
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', { configurable: true, value: async () => ({
      waiting, installing: null, update: async () => { probe.checks++; },
    }) });
  }, { key: STORE, profile: DEFAULT_PROFILE, session, mode });
  await page.goto('/');
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('region', { name: 'App updates', exact: true });
}

test('checking an installed update keeps the saved plan and records unchanged', async ({ page }) => {
  const settings = await setup(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await settings.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(settings.getByRole('status')).toHaveText('No newer version was found on this website.');
  expect(await page.evaluate(() => (window as any).__pwaUpdateProbe.checks)).toBe(1);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('an older waiting worker gives close-and-reopen instructions without claiming the update succeeded', async ({ page }) => {
  const settings = await setup(page, 'legacy');
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await settings.getByRole('button', { name: 'Update app', exact: true }).click();
  await expect(settings.getByRole('status')).toContainText('Close all Setline windows');
  await expect(page.getByRole('dialog', { name: 'Your preferences', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('a manual acknowledged update reloads without replacing the saved profile', async ({ page }) => {
  const settings = await setup(page, 'ready');
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await Promise.all([
    page.waitForEvent('framenavigated', frame => frame === page.mainFrame()),
    settings.getByRole('button', { name: 'Update app', exact: true }).click(),
  ]);
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
  expect(await page.evaluate(() => sessionStorage.getItem('update-test-complete'))).toBe('1');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('an active workout cannot be interrupted by applying a downloaded update', async ({ page }) => {
  const settings = await setup(page, 'ready', true);
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await expect(settings.getByRole('button', { name: 'Update app', exact: true })).toBeDisabled();
  await expect(settings).toContainText('Finish your workout before updating.');
  expect(await page.evaluate(() => (window as any).__pwaUpdateProbe.requests)).toBe(0);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('an update preserves unsaved preference edits instead of reloading over them', async ({ page }) => {
  const settings = await setup(page, 'ready');
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await page.getByRole('spinbutton', { name: 'Body weight · kg', exact: true }).fill('65.5');
  await settings.getByRole('button', { name: 'Update app', exact: true }).click();
  await expect(settings.getByRole('status')).toHaveText('Save your preference changes before updating.');
  await expect(page.getByRole('spinbutton', { name: 'Body weight · kg', exact: true })).toHaveValue('65.5');
  expect(await page.evaluate(() => (window as any).__pwaUpdateProbe.requests)).toBe(0);
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});
