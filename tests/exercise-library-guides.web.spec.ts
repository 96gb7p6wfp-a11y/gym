import { openDisclosure } from './helpers/navigation';
import { expect, test } from '@playwright/test';

test('exercise details explain purpose and rank relevant alternatives without crowding the workout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.locator('.planned-preview > summary').click();
  const guide = page.locator('.exercise-guide-sheet');
  await expect(guide).not.toBeVisible();
  await page.getByRole('button', { name: 'Exercise details for Chest-Supported Row', exact: true }).click();
  await expect(guide.locator('.exercise-guide__overview')).toBeHidden();
  await expect(guide.getByRole('img', { name: 'Front target areas', exact: true })).toBeHidden();
  await openDisclosure(page, 'About this exercise');
  await expect(guide.locator('.exercise-guide__overview')).toBeVisible();
  await expect(guide.getByRole('img', { name: 'Front target areas', exact: true })).toBeVisible();
  await expect(guide.getByRole('img', { name: 'Back target areas', exact: true })).toBeVisible();
  await expect(guide.locator('figcaption')).toContainText('Broad muscle groups · schematic');
  await expect(guide.locator('.exercise-guide__overview')).toContainText('Targets');
  await expect(guide.locator('.exercise-guide__overview')).toContainText('Back');
  await expect(guide.locator('.exercise-guide__overview')).toContainText('Improves');
  await expect(guide.locator('ol > li')).toHaveCount(3);
  await expect(guide.locator('.exercise-guide__loading')).toBeHidden();
  await guide.getByRole('button', { name: 'Load & reps', exact: true }).click();
  await expect(guide.locator('.exercise-guide__loading')).toBeVisible();
  await expect(guide.locator('.exercise-guide__loading')).toContainText('Your target:');

  await guide.getByRole('button', { name: 'Alternatives', exact: true }).click();
  await expect(guide.locator('.exercise-guide__alternatives strong')).toHaveText([
    'Seal Row', 'Seated Cable Row', 'One-arm Dumbbell Row', 'Barbell Row',
  ]);
  await expect(guide.locator('.exercise-guide__alternatives > div').first()).toContainText('chest support');
  await expect(guide.locator('.exercise-guide__alternatives > div').last()).toContainText('lower-back fatigue');
  await expect(guide.getByRole('link', { name: /View technique/ })).toHaveCount(4);
  await guide.getByRole('button', { name: 'Technique', exact: true }).click();
  await expect(guide.locator('ol > li')).toHaveCount(3);
  await expect(guide.getByRole('link')).toHaveAttribute('target', '_blank');

  await page.setViewportSize({ width: 320, height: 568 });
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});
