import { expect, test } from '@playwright/test';
import { APP_URL } from '../src/navigation';

// These tests validate the deployable PWA shell. The hosted gym is deliberately
// replaced with a local response; its source and application behavior are separate.
test.beforeEach(async ({ page }) => {
  await page.route(`${APP_URL}/**`, (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body><h1>Mock gym content</h1></body></html>',
  }));
  await page.addInitScript(() => {
    // Chromium can offer its own install prompt. Simulate iPhone Safari, which
    // uses the documented Share > Add to Home Screen instructions instead.
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });
  });
});

test('renders the gym frame with usable controls at iPhone and narrow phone sizes', async ({ page }) => {
  await page.goto('/');
  const iframe = page.locator('iframe');
  await expect(iframe).toHaveAttribute('src', APP_URL);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Mock gym content' })).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ['Reload', 'Share', 'Install']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    const box = await iframe.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(400);
    expect(box!.width).toBe(width);
  }
});

test('reload replaces the embedded gym frame', async ({ page }) => {
  await page.goto('/');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Mock gym content' })).toBeVisible();
  const originalFrame = await page.locator('iframe').elementHandle();
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect.poll(() => originalFrame!.evaluate((element) => element.isConnected)).toBe(false);
  await expect(page.locator('iframe')).toHaveAttribute('src', APP_URL);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Mock gym content' })).toBeVisible();
});

test('opens and closes Safari home-screen installation instructions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Add Setline to your iPhone' })).toBeVisible();
  await expect(dialog).toContainText('Open this page in Safari');
  await expect(dialog).toContainText('Add to Home Screen');
  await dialog.getByRole('button', { name: 'Close install instructions' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).not.toBeVisible();
});

test('shares the installed app address through the clipboard fallback', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => { document.documentElement.dataset.copiedLink = value; } },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Link copied');
  await expect(page.locator('html')).toHaveAttribute('data-copied-link', `${baseURL}/`);
});

test('serves installable manifest and worker with browser-compatible content types', async ({ request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Setline');
  expect(manifest.start_url).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192' }),
    expect.objectContaining({ sizes: '512x512' }),
  ]));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  const workerResponse = await request.get('/service-worker.js');
  expect(workerResponse.ok()).toBe(true);
  expect(workerResponse.headers()['content-type']).toContain('javascript');
});

test('activates the service worker and reloads the cached shell offline', async ({ page, context }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 15_000 }).toBe('activated');
  const cachedPaths = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shellKey = keys.find((key) => key.startsWith('setline-pwa-'));
    if (!shellKey) return [];
    const cache = await caches.open(shellKey);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths).toContain('/index.html');
  expect(cachedPaths).toContain('/manifest.webmanifest');
  expect(cachedPaths.some((pathname) => pathname.endsWith('.js'))).toBe(true);
  await context.setOffline(true);
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  // Chromium's protocol emulation resets navigator.onLine on a service-worker
  // navigation. Keep the phone's offline status explicit while actual requests
  // remain offline, so this checks both cached navigation and the offline UI.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  });
  try {
    const response = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Setline home' })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  } finally {
    await context.setOffline(false);
    await page.evaluate(() => {
      Reflect.deleteProperty(navigator, 'onLine');
      window.dispatchEvent(new Event('online'));
    });
  }
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Mock gym content' })).toBeVisible();
});
