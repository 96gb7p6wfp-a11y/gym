import { expect, test, type Page } from '@playwright/test';
import { createIpadFixture, IPAD_STORE, IPAD_TODAY } from './helpers/ipad-fixture';

const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), IPAD_STORE);
async function seed(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.clock.install({ time: new Date(`${IPAD_TODAY}T10:00:00Z`) });
  await page.goto('/');
  await page.evaluate(state => localStorage.setItem('setline.gym.v1', JSON.stringify(state)), createIpadFixture(theme));
  await page.reload();
}
async function library(page: Page) {
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Exercise library', exact: true }).click();
  const sheet = page.locator('.exercise-library-sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}
async function movement(page: Page, name: string) {
  const sheet = await library(page);
  await sheet.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill(name);
  const row = sheet.getByRole('button', { name: `View ${name}`, exact: true });
  await expect(row).toBeVisible();
  await row.click();
  const detail = await sheet.locator('.exercise-library__detail-pane').isVisible()
    ? sheet.locator('.exercise-library__detail-pane') : sheet;
  return { sheet, detail };
}
const picture = (page: Page) => page.locator('.exercise-media:not(.exercise-media--thumbnail) > img:visible').first();
async function loaded(page: Page) {
  const image = picture(page);
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(element => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)).toBe(true);
  expect(await image.evaluate(element => getComputedStyle(element).objectFit)).toBe('contain');
  return image;
}

for (const [width, height, theme] of [[390, 844, 'dark'], [820, 1180, 'light'], [1194, 834, 'dark'], [1366, 1024, 'light']] as const) {
  test(`approved exact machine illustrations and separate research actions fit ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await seed(page, theme); const before = await raw(page);
    const { sheet, detail } = await movement(page, 'Leg Extension');
    const image = await loaded(page);
    await expect(image).toHaveAttribute('src', '/exercise-media/licensed/everkinetic/leg-extension-start.webp');
    await expect(image).toHaveAttribute('loading', 'lazy');
    await expect(image).toHaveAttribute('alt', /knees bent.*roller.*Example apparatus/i);
    await expect(detail).toContainText('CC BY-SA 4.0');
    await expect(detail).toContainText('example apparatus');
    await expect(detail.getByRole('link', { name: 'Source', exact: true }).first()).toHaveAttribute('href', /github\.com\/everkinetic\/data\/blob\/446bb9a/);
    const google = detail.getByRole('link', { name: 'Search Google', exact: true });
    const youtube = detail.getByRole('link', { name: 'YouTube Demonstration', exact: true });
    expect(new URL((await google.getAttribute('href'))!).searchParams.get('q')).toBe('Leg Extension correct form demonstration');
    await expect(youtube).toHaveAttribute('href', 'https://www.youtube.com/results?search_query=Leg%20Extension%20exercise%20technique');
    for (const link of [google, youtube]) { await expect(link).toHaveAttribute('target', '_blank'); await expect(link).toHaveAttribute('rel', 'noopener noreferrer'); }
    await detail.locator('summary').filter({ hasText: /^More demonstration views$/ }).click();
    const finish = detail.locator('img[src$="leg-extension-extended.webp"]');
    await finish.scrollIntoViewIfNeeded();
    await expect.poll(() => finish.evaluate(element => element instanceof HTMLImageElement && element.naturalWidth > 0)).toBe(true);
    expect(await finish.evaluate(element => getComputedStyle(element).objectFit)).toBe('contain');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await image.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`licensed-leg-extension-${width}-${theme}.png`), animations: 'disabled' });
    if (width >= 1024) {
      await page.setViewportSize({ width: 540, height: 900 });
      await expect(sheet.getByRole('heading', { name: 'Leg Extension', exact: true })).toBeVisible();
      await sheet.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(sheet.getByRole('searchbox', { name: 'Search exercises', exact: true })).toHaveValue('Leg Extension');
    }
    expect(await raw(page)).toBe(before);
  });
}

test('wide library filters and canonical Google queries keep slams, forward throws and unsupported rows distinct', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 }); await seed(page);
  const before = await raw(page), sheet = await library(page);
  for (const [name, include, exclude] of [
    ['Two-Hand Medicine Ball Overhead Slam', 'overhead floor slam', 'forward throw'],
    ['Medicine Ball Overhead Forward Throw', 'overhead forward throw', 'floor slam'],
    ['Chest-Supported Row', 'chest supported row machine chest pad', 'unsupported'],
  ]) {
    await sheet.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill(name);
    await sheet.getByRole('button', { name: `View ${name}`, exact: true }).click();
    const pane = sheet.getByRole('complementary', { name: 'Exercise detail workspace', exact: true });
    const query = new URL((await pane.getByRole('link', { name: 'Search Google', exact: true }).getAttribute('href'))!).searchParams.get('q')!.toLowerCase();
    expect(query).toContain(include); expect(query).not.toContain(exclude);
    await expect(pane.getByRole('link', { name: 'YouTube Demonstration', exact: true })).toBeVisible();
    if (name === 'Chest-Supported Row') await expect(pane.locator('img')).toHaveCount(0);
  }
  await sheet.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill('');
  await sheet.getByRole('button', { name: 'Filters', exact: true }).click();
  await sheet.locator('summary').filter({ hasText: /^EquipmentAll$/ }).click();
  await sheet.getByRole('group', { name: 'Filter by equipment', exact: true }).getByRole('button', { name: 'Machine', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'View Leg Extension', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'View Two-Hand Medicine Ball Overhead Slam', exact: true })).toHaveCount(0);
  expect(await raw(page)).toBe(before);
});

test('an actually visited approved image remains available after an offline app reload', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seed(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const before = await raw(page);
  await movement(page, 'Leg Extension'); await loaded(page);
  await expect.poll(() => page.evaluate(async () => {
    const name = (await caches.keys()).find(name => name.startsWith('setline-pwa-') && name.endsWith('-media'));
    return name ? !!(await (await caches.open(name)).match('/exercise-media/licensed/everkinetic/leg-extension-start.webp')) : false;
  })).toBe(true);
  await context.setOffline(true);
  const response = await page.reload({ waitUntil: 'domcontentloaded' });
  expect(response?.fromServiceWorker()).toBe(true);
  const mediaResponse = page.waitForResponse(response => response.url().endsWith('/exercise-media/licensed/everkinetic/leg-extension-start.webp'));
  await movement(page, 'Leg Extension'); await loaded(page);
  expect((await mediaResponse).fromServiceWorker()).toBe(true);
  expect(await raw(page)).toBe(before);
});

test.describe('optional image failure', () => {
  test.use({ serviceWorkers: 'block' });
  test('failed images disappear without broken boxes, missing photos keep exact instructions and both links', async ({ page }) => {
    await page.route('**/exercise-media/**', route => route.abort());
    await page.setViewportSize({ width: 1194, height: 834 }); await seed(page);
    const before = await raw(page);
    const { detail, sheet } = await movement(page, 'Leg Extension');
    await expect(detail.getByText('Image unavailable. Follow the written technique below.', { exact: true }).first()).toBeVisible();
    await expect(detail.locator('img:visible')).toHaveCount(0);
    await expect(detail.getByRole('heading', { name: 'Equipment', exact: true })).toBeVisible();
    await expect(detail.getByRole('link', { name: 'Search Google', exact: true })).toBeVisible();
    await expect(detail.getByRole('link', { name: 'YouTube Demonstration', exact: true })).toBeVisible();
    await sheet.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill('Romanian Deadlift');
    await sheet.getByRole('button', { name: 'View Romanian Deadlift', exact: true }).click();
    await expect(detail.locator('img')).toHaveCount(0);
    await expect(detail.locator('.exercise-guide__steps')).toContainText(/hip|hinge/i);
    expect(await raw(page)).toBe(before);
  });
});

test('planned training selects one adjacent guide without changing the complete prescription or historical data', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 }); await seed(page);
  const before = await raw(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const pane = page.getByRole('complementary', { name: 'Selected exercise details', exact: true });
  const rows = page.getByRole('list', { name: 'Planned exercises', exact: true }).getByRole('button');
  await expect(rows).toHaveCount(12);
  await page.getByRole('button', { name: 'Exercise details for Hack Squat', exact: true }).click();
  await expect(pane.getByRole('heading', { name: 'Hack Squat', exact: true })).toBeVisible();
  await expect(pane.getByRole('region', { name: 'Saved session details', exact: true })).toContainText('3 × 4–6');
  await pane.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.getByRole('button', { name: 'Exercise details for Romanian Deadlift', exact: true }).click();
  await expect(pane.getByRole('heading', { name: 'Romanian Deadlift', exact: true })).toBeVisible();
  await expect.poll(() => pane.evaluate(element => element.scrollTop)).toBe(0);
  await page.setViewportSize({ width: 700, height: 900 });
  await expect(pane).toHaveCount(0);
  await page.locator('.planned-preview > summary').click();
  await page.getByRole('button', { name: 'Exercise details for Romanian Deadlift', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Romanian Deadlift', exact: true })).toBeVisible();
  expect(await raw(page)).toBe(before);
});
