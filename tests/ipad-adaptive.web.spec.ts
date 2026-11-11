import { expect, test, type Page } from '@playwright/test';
import { createIpadFixture, IPAD_STORE, IPAD_TODAY } from './helpers/ipad-fixture';

const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), IPAD_STORE);
async function seed(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.clock.install({ time: new Date(`${IPAD_TODAY}T10:00:00Z`) });
  await page.goto('/');
  await page.evaluate(state => localStorage.setItem('setline.gym.v1', JSON.stringify(state)), createIpadFixture(theme));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The app must fit the available window').toBe(true);
}
async function navigationFits(page: Page, width: number, height: number) {
  const navigation = page.getByRole('tablist', { name: 'Main navigation', exact: true });
  await expect(navigation.getByRole('tab')).toHaveCount(4);
  const bounds = (await navigation.boundingBox())!;
  if (width >= 1024) {
    expect(bounds.x).toBeLessThanOrEqual(24);
    expect(bounds.width).toBeLessThan(250);
    expect(bounds.height).toBeGreaterThan(bounds.width);
    await expect(navigation).toHaveAttribute('aria-orientation', 'vertical');
  } else {
    expect(bounds.y).toBeGreaterThan(height - 160);
    expect(bounds.width).toBeGreaterThan(bounds.height);
    await expect(navigation).toHaveAttribute('aria-orientation', 'horizontal');
  }
  for (const tab of await navigation.getByRole('tab').all()) {
    expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
}

const windows = [
  { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 },
  { width: 768, height: 1024 }, { width: 820, height: 1180 },
  { width: 1024, height: 768 }, { width: 1194, height: 834 }, { width: 1366, height: 1024 },
];
for (const size of windows) for (const theme of ['light', 'dark'] as const) {
  test(`adaptive navigation and real Today content fit ${size.width}×${size.height} in ${theme} without writing data`, async ({ page }) => {
    await page.setViewportSize(size);
    await seed(page, theme);
    const before = await raw(page);
    await navigationFits(page, size.width, size.height);
    await fits(page);
    const hero = page.getByRole('region', { name: 'Your day', exact: true });
    const progress = page.getByRole('region', { name: 'Your progress', exact: true });
    await expect(hero).toContainText('Speed + Jump + Heavy Lower A');
    await expect(progress).toContainText('+2.5');
    if (size.width >= 1024) {
      const primary = (await hero.boundingBox())!;
      const secondary = (await progress.boundingBox())!;
      expect(secondary.x).toBeGreaterThanOrEqual(primary.x + primary.width - 1);
      expect(primary.width).toBeGreaterThan(300);
      expect(secondary.width).toBeGreaterThan(230);
    } else {
      const start = hero.getByRole('button', { name: 'Start workout', exact: true });
      const button = (await start.boundingBox())!;
      const nav = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
      expect(button.y + button.height).toBeLessThan(nav.y);
    }
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Wed / })).toHaveAttribute('aria-pressed', 'true');
    await fits(page);
    await page.getByRole('tab', { name: 'Progress', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Progress overview', exact: true })).toBeVisible();
    await fits(page);
    expect(await raw(page)).toBe(before);
  });
}

test('resizing a selected training date switches navigation without changing Today, settings or histories', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1024 });
  await seed(page);
  const before = await raw(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await expect(page.getByRole('button', { name: /^Sat / })).toHaveAttribute('aria-pressed', 'true');
  for (const size of [{ width: 700, height: 900 }, { width: 540, height: 900 }, { width: 1194, height: 834 }]) {
    await page.setViewportSize(size);
    await navigationFits(page, size.width, size.height);
    await expect(page.getByRole('button', { name: /^Sat / })).toHaveAttribute('aria-pressed', 'true');
    await fits(page);
  }
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Speed + Jump + Heavy Lower A');
  expect(await raw(page)).toBe(before);
});

test('wide Today supports enlarged text and simulated safe areas without obscuring navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  await seed(page, 'dark');
  const before = await raw(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
    document.documentElement.style.setProperty('--app-safe-area-left', '24px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '21px');
  });
  await fits(page);
  const navigation = page.getByRole('tablist', { name: 'Main navigation', exact: true });
  await navigation.getByRole('tab', { name: 'Train', exact: true }).focus();
  await expect(navigation.getByRole('tab', { name: 'Train', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(navigation.getByRole('tab', { name: 'Progress', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(navigation.getByRole('tab', { name: 'Progress', exact: true })).toHaveAttribute('data-state', 'active');
  await fits(page);
  expect(await raw(page)).toBe(before);
});
