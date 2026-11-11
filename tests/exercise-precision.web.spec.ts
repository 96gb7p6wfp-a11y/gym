import { expect, test, type Page } from '@playwright/test';

async function library(page: Page) {
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Exercise library', exact: true }).click();
  const sheet = page.locator('.exercise-library-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}

for (const [name, movement, diagram] of [
  ['Two-Hand Medicine Ball Overhead Slam', /down in front/i, /overhead slam.*downward floor release/i],
  ['Medicine Ball Overhead Forward Throw', /forwards.*target/i, /overhead forward throw.*forward target release/i],
  ['Drop Jump', /step off without jumping upward/i, /drop jump.*step off.*rebound/i],
] as const) {
  test(`${name} has exact structured technique and an original optional direction diagram offline`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    const guide = await library(page);
    const before = await page.evaluate(() => localStorage.getItem('setline.gym.v1'));
    await guide.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill(name);
    await guide.getByRole('button', { name: `View ${name}`, exact: true }).click();
    await expect(guide.getByRole('heading', { name: 'Equipment', exact: true })).toBeVisible();
    await expect(guide.locator('.exercise-guide__steps')).toContainText('Setup');
    await expect(guide.locator('.exercise-guide__steps')).toContainText(movement);
    await expect(guide.getByRole('heading', { name: 'Avoid', exact: true }).first()).toBeVisible();
    await expect(guide.getByRole('heading', { name: 'Purpose', exact: true })).toBeVisible();
    await guide.getByText('Movement diagram', { exact: true }).click();
    await expect(guide.locator('svg').and(guide.getByRole('img', { name: diagram }))).toBeVisible();
    // Approved local images augment the original inline diagram. Neither may
    // produce a broken-image box, including when the media cache is unavailable.
    const broken = await guide.locator('img').evaluateAll(images => images.some(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0));
    expect(broken).toBe(false);
    await expect(guide.getByRole('link', { name: 'YouTube Demonstration', exact: true })).toHaveAttribute('href', /youtube\.com\/results\?search_query=/);
    await expect(guide).toContainText('results have not been reviewed');
    await page.context().setOffline(true);
    await expect(guide.locator('svg').and(guide.getByRole('img', { name: diagram }))).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('setline.gym.v1'))).toBe(before);
    await page.screenshot({ path: testInfo.outputPath(`guide-${name.replace(/\W+/g, '-')}-320.png`) });
  });
}
