import { expect, test, type Locator, type Page } from '@playwright/test';

async function safeAreas(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
}

async function visibleViewport(page: Page, height: number, offsetTop = 0, event = 'resize') {
  await page.evaluate(({ height, offsetTop, event }) => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: height });
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: offsetTop });
    window.visualViewport!.dispatchEvent(new Event(event));
  }, { height, offsetTop, event });
}

async function clearAction(control: Locator, visibleBottom: number) {
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate((element, bottom) => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return bounds.height >= 44 && bounds.bottom <= bottom && hit != null && element.contains(hit);
  }, visibleBottom)).toBe(true);
}

test('meal sheets fit the visible keyboard viewport and keep the save action reachable', async ({ page }) => {
  await page.goto('/');
  await safeAreas(page);
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const meal = page.getByRole('dialog', { name: 'Add a meal', exact: true });
  await meal.getByLabel('Meal name', { exact: true }).fill('After training');
  await meal.getByLabel('Food 1', { exact: true }).fill('Oats');
  await visibleViewport(page, 500);
  await expect.poll(() => meal.evaluate(element => Math.round(element.getBoundingClientRect().bottom))).toBe(450);
  await expect.poll(() => meal.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(63);
  await meal.getByLabel('Calories · kcal', { exact: true }).fill('300');
  await meal.getByLabel('Protein · g', { exact: true }).fill('12');
  await clearAction(meal.getByRole('button', { name: 'Close', exact: true }), 500);
  const save = meal.getByRole('button', { name: 'Save meal', exact: true });
  await clearAction(save, 500);
  await save.tap();
  await expect(meal).not.toBeVisible();
  await expect(page.locator('.nutrition-meals')).toContainText('After training');
});

test('sheets follow visual viewport panning without losing the close control or focused input', async ({ page }) => {
  await page.goto('/');
  await safeAreas(page);
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  await settings.getByLabel('Body weight · kg', { exact: true }).focus();
  await visibleViewport(page, 350, 75, 'scroll');
  await expect.poll(() => settings.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(138);
  await expect.poll(() => settings.evaluate(element => Math.round(element.getBoundingClientRect().bottom))).toBe(375);
  const weight = settings.getByLabel('Body weight · kg', { exact: true });
  await expect.poll(() => weight.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 138 && rect.bottom <= 375;
  })).toBe(true);
  const close = settings.getByRole('button', { name: 'Close', exact: true });
  await clearAction(close, 425);
  await close.tap();
  await expect(settings).not.toBeVisible();
});

test('short-phone and landscape sheets resize without the Visual Viewport API', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await safeAreas(page);
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  for (const viewport of [{ width: 320, height: 568 }, { width: 320, height: 390 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => settings.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 63 && rect.bottom <= innerHeight - 50;
    })).toBe(true);
    await clearAction(settings.getByRole('button', { name: 'Close', exact: true }), viewport.height - 34);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
