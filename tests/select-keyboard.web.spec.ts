import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
});

test('keeps movement dropdown keyboard navigation and restores focus after selection and escape', async ({ page }) => {
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Strength', exact: true }).click();
  const trigger = page.getByRole('combobox', { name: 'Movement', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  const options = list.getByRole('option');
  const first = options.first();
  const second = options.nth(1);
  const last = options.last();
  const firstName = (await first.textContent())!.trim();

  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(second).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(first).toBeFocused();
  await page.keyboard.press('End');
  await expect(last).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(list).not.toBeVisible();
  await expect(trigger).toContainText(firstName);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('heading', { name: firstName, exact: true })).toBeVisible();

  await page.keyboard.press('ArrowDown');
  await expect(list).toBeVisible();
  await page.keyboard.press('End');
  await expect(last).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(list).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText(firstName);
});

test('keeps native plan controls selectable and safely contained on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Monday', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Monday', exact: true });
  await dialog.getByRole('button', { name: 'Edit Medicine Ball Spike Slam', exact: true }).click();
  const row = dialog.locator('.builder-exercises > li').first();
  await row.locator('summary').filter({ hasText: /^More options$/ }).click();
  const control = row.getByRole('combobox', { name: 'Logging', exact: true });
  await control.scrollIntoViewIfNeeded();
  const bounds = (await control.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(await control.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return target === element || element.contains(target);
  })).toBe(true);
  await control.selectOption('timed');
  await expect(control).toHaveValue('timed');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Edit Monday', exact: true }).click();
  await dialog.getByRole('button', { name: 'Edit Medicine Ball Spike Slam', exact: true }).click();
  await dialog.locator('.builder-exercises > li').first().locator('summary').filter({ hasText: /^More options$/ }).click();
  await expect(dialog.locator('.builder-exercises > li').first().getByRole('combobox', { name: 'Logging', exact: true })).toHaveValue('timed');
});
