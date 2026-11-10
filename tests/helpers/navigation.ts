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

/** Take the actual pre-workout route into preparation without checking off any
 * drills or claiming to be already warmed up. The gentle primer may start
 * directly because that saved session is itself preparation. */
export async function openQuickWarmup(page: Page) {
  const check = page.getByRole('dialog', { name: 'Ready to Train?', exact: true });
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await expect(check.or(warmup)).toBeVisible();
  if (await check.isVisible()) {
    await check.getByRole('button', { name: 'Yes — fit to train', exact: true }).click();
    await check.getByRole('button', { name: 'Not yet', exact: true }).click();
    await check.getByRole('button', { name: /^(?:Quick warm-up|Recovery preparation)$/ }).click();
    await expect(check).not.toBeVisible();
  }
  await expect(warmup.or(page.getByRole('button', { name: 'Finish workout', exact: true }))).toBeVisible();
  return await warmup.isVisible();
}

/** Explicitly use the already-warm fast path. This records the athlete's
 * deliberate answer, without inventing completed preparation checkboxes. */
export async function startAlreadyWarmed(page: Page) {
  const check = page.getByRole('dialog', { name: 'Ready to Train?', exact: true });
  await expect(check).toBeVisible();
  await check.getByRole('button', { name: 'Yes — fit to train', exact: true }).click();
  await check.getByRole('button', { name: 'Yes — already warmed up', exact: true }).click();
  await check.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(check).not.toBeVisible();
}

/** Start optional preparation without inventing completed or elsewhere checks.
 * Dedicated warm-up tests cover individual completion, skipping and provenance. */
export async function finishWarmup(page: Page) {
  const opened = await openQuickWarmup(page);
  if (!opened) return;
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await expect(warmup).toBeVisible();
  await warmup.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(warmup).not.toBeVisible();
}

/** Navigate the actual Settings grouping without changing any saved values. */
export async function settingsGroup(page: Page, name: 'Training' | 'Appearance & Sound' | 'Data & Backup') {
  const sheet = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  const group = sheet.getByRole('region', { name, exact: true });
  if (!await group.isVisible()) {
    const all = sheet.getByRole('button', { name: 'All settings', exact: true });
    if (await all.isVisible()) await all.click();
    await sheet.getByRole('navigation', { name: 'Settings groups', exact: true }).getByRole('button', { name, exact: true }).click();
  }
  return group;
}

/** Upgrades with unmappable personal edits require the same explicit review as the app. */
export async function acknowledgeProgramUpgrade(page: Page) {
  const review = page.getByRole('dialog', { name: 'Upgrade to V13.1', exact: true });
  const choice = review.getByRole('checkbox', { name: 'Use V13.1 recommendations for unmapped edits', exact: true });
  if (await choice.isVisible()) await choice.check();
}
