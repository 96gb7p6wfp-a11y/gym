import { expect, type Page } from '@playwright/test';

/** Open a product destination through the four-item primary navigation. */
export async function openSection(page: Page, name: string) {
  if (name === 'Nutrition') {
    await page.getByRole('tab', { name: 'You', exact: true }).click();
    await page.getByRole('button', { name: 'Nutrition', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'You', exact: true })).toHaveAttribute('data-state', 'active');
    await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
    return;
  }
  const destination = name === 'More' ? 'You' : name === 'Workout' ? 'Train' : name;
  await page.getByRole('tab', { name: destination, exact: true }).click();
}

/** Use the same disclosure interaction as a person before accessing its tools. */
export async function openDisclosure(page: Page, name: string) {
  const summary = page.locator('summary').filter({ hasText: name });
  await expect(summary).toHaveText(name);
  await expect(summary).toBeVisible();
  if (!await summary.evaluate(element => element.closest('details')?.open ?? false)) await summary.click();
}
