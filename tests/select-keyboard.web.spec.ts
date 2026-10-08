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

test('keeps a plan dropdown visible and selectable inside a dialog on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Monday', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Monday', exact: true });
  const trigger = dialog.locator('.plan-exercise-editor').first().getByRole('combobox');
  await trigger.scrollIntoViewIfNeeded();
  const triggerBounds = await trigger.boundingBox();
  expect(triggerBounds).not.toBeNull();
  await page.touchscreen.tap(triggerBounds!.x + triggerBounds!.width / 2, triggerBounds!.y + triggerBounds!.height / 2);

  const list = page.getByRole('listbox');
  await expect(list).toBeVisible();
  const popupBounds = await list.boundingBox();
  expect(popupBounds).not.toBeNull();
  expect(popupBounds!.x).toBeGreaterThanOrEqual(0);
  expect(popupBounds!.y).toBeGreaterThanOrEqual(0);
  expect(popupBounds!.x + popupBounds!.width).toBeLessThanOrEqual(320);
  expect(popupBounds!.y + popupBounds!.height).toBeLessThanOrEqual(568);
  const timed = list.getByRole('option', { name: 'Time', exact: true });
  await expect(timed).toBeVisible();
  const optionBounds = await timed.boundingBox();
  expect(optionBounds).not.toBeNull();
  const point = { x: optionBounds!.x + optionBounds!.width / 2, y: optionBounds!.y + optionBounds!.height / 2 };
  expect(await timed.evaluate((element, point) => {
    const target = document.elementFromPoint(point.x, point.y);
    return target !== null && element.contains(target);
  }, point)).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
  await expect(list).not.toBeVisible();
  await expect(trigger).toContainText('Time');
  await expect(trigger).toBeFocused();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Edit Monday', exact: true }).click();
  await expect(dialog.locator('.plan-exercise-editor').first().getByRole('combobox')).toContainText('Time');
});
