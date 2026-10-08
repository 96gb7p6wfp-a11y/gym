import { expect, test, type Page } from '@playwright/test';

const MOVEMENT = 'Medicine Ball Spike Slam';
const STORE_KEY = 'setline.gym.v1';

async function startWorkout(page: Page, day = 'Mon') {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${day} `) }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
  await openAllSets(page);
}

async function openAllSets(page: Page) {
  const button = page.getByRole('button', { name: 'All sets', exact: true });
  if (await button.isVisible()) await button.click();
}

async function openHistory(page: Page) {
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
}

function weightInput(page: Page) {
  return page.getByRole('textbox', { name: `${MOVEMENT} set 1 weight in kilograms`, exact: true });
}

for (const separator of ['.', ',']) {
  test(`logs a typed 12${separator}5 kg set, preserves the decimal while typing, and saves its volume`, async ({ page }) => {
    await startWorkout(page);
    const weight = weightInput(page);
    await expect(weight).toHaveAttribute('inputmode', 'decimal');
    await weight.pressSequentially(`12${separator}`, { delay: 70 });
    await expect(weight).toHaveValue(`12${separator}`);
    // Cross a timer tick and the debounced write so re-renders cannot strip the separator.
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key)?.includes('"kg":12') ?? false, STORE_KEY)).toBe(true);
    await expect(weight).toHaveValue(`12${separator}`);
    await weight.pressSequentially('5');
    await expect(weight).toHaveValue(`12${separator}5`);
    await page.getByRole('spinbutton', { name: `${MOVEMENT} set 1 reps`, exact: true }).fill('8');
    await expect(weight).toHaveValue('12.5');
    const completed = page.getByRole('checkbox', { name: `Complete ${MOVEMENT} set 1`, exact: true });
    await completed.check();
    await expect(completed).toBeChecked();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key)?.includes('"kg":12.5') ?? false, STORE_KEY)).toBe(true);

    await page.reload();
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await openAllSets(page);
    await expect(weightInput(page)).toHaveValue('12.5');
    await expect(completed).toBeChecked();
    await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
    const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
    await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('60');
    await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
    const summary = page.getByRole('dialog');
    await expect(summary).toContainText(/100\s*kg volume/);
    await expect(summary.getByRole('cell', { name: '12.5 kg', exact: true })).toBeVisible();
    await summary.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await openHistory(page);
    await expect(page.getByRole('button', { name: /^Gym / })).toContainText('100 kg total volume');
  });
}

test('invalid and empty weight never complete a set using its old weight, while zero remains valid', async ({ page }) => {
  await startWorkout(page);
  const weight = weightInput(page);
  const completed = page.getByRole('checkbox', { name: `Complete ${MOVEMENT} set 1`, exact: true });
  await weight.pressSequentially('12.5');
  await page.getByRole('spinbutton', { name: `${MOVEMENT} set 1 reps`, exact: true }).fill('8');
  await completed.check();
  await expect(completed).toBeChecked();

  for (const invalid of ['2001', '-1', '12kg', '12,5.0']) {
    await weight.fill(invalid);
    await expect(weight).toHaveAttribute('aria-invalid', 'true');
    await expect(completed).not.toBeChecked();
    await completed.click();
    await expect(completed).not.toBeChecked();
  }
  await weight.fill('');
  await completed.click();
  await expect(completed).not.toBeChecked();
  await expect(page.getByText('Enter the weight you used. Use 0 for no added weight.', { exact: true })).toBeVisible();
  await weight.pressSequentially('0');
  await completed.check();
  await expect(completed).toBeChecked();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key)?.includes('"kg":0') ?? false, STORE_KEY)).toBe(true);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await openAllSets(page);
  await expect(weightInput(page)).toHaveValue('0');
  await expect(completed).toBeChecked();
});

test('bodyweight sets allow no added load but block an invalid optional load', async ({ page }) => {
  await startWorkout(page, 'Wed');
  const movement = 'Tibialis Raise';
  await page.locator('summary').filter({ hasText: /^Movements/ }).click();
  await page.getByRole('button', { name: `Train ${movement}`, exact: true }).click();
  await openAllSets(page);
  const weight = page.getByRole('textbox', { name: `${movement} set 1 weight in kilograms`, exact: true });
  const completed = page.getByRole('checkbox', { name: `Complete ${movement} set 1`, exact: true });
  await page.getByRole('spinbutton', { name: `${movement} set 1 reps`, exact: true }).fill('15');
  await completed.check();
  await expect(completed).toBeChecked();
  await weight.fill('12,5');
  await expect(completed).toBeChecked();
  await weight.fill('2001');
  await expect(weight).toHaveAttribute('aria-invalid', 'true');
  await expect(completed).not.toBeChecked();
  await completed.click();
  await expect(completed).not.toBeChecked();
  await weight.fill('');
  await completed.check();
  await expect(completed).toBeChecked();
});
