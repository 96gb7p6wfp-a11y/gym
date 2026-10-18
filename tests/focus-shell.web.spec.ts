import { openSection } from './helpers/navigation';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const TODAY = '2026-10-15';

async function safeAreas(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
}
async function viewportKeyboard(page: Page, height: number) {
  await page.evaluate(height => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: height });
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 0 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  }, height);
}
async function tappable(control: Locator, bottom: number) {
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate((element, bottom) => {
    const box = element.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44 && box.bottom <= bottom && box.top >= 0
      && [box.top + 2, box.y + box.height / 2, box.bottom - 2].every(y => {
        const hit = document.elementFromPoint(box.x + box.width / 2, y);
        return hit != null && element.contains(hit);
      });
  }, bottom)).toBe(true);
}
async function seedProgress(page: Page) {
  const completed = (day: number, date: string, primer = false) => {
    const plan = primer ? DEFAULT_PROFILE.plan[1].extraSession! : DEFAULT_PROFILE.plan[day];
    const session = SessionSchema.parse(stopSessionTimers(createSession(plan, day, date, DEFAULT_PROFILE, []), 'completed'));
    const exercise = session.exercises[0], log = exercise.logs[0];
    Object.assign(log, { done: true, kg: exercise.mode === 'weight' ? 6 : null, reps: exercise.mode === 'timed' ? null : 4, seconds: exercise.mode === 'timed' ? 20 : null });
    return { session: SessionSchema.parse(session), version: 1 };
  };
  const sessions = [completed(0, '2026-10-12'), completed(2, '2026-10-14'), completed(1, '2026-10-13', true)];
  await page.evaluate(({ key, profile, sessions }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions, nutrition: [], activities: [],
    performance: { jumps: [
      { id: crypto.randomUUID(), date: '2026-10-08', type: 'approach', measurement: 'height', cm: 65, notes: '' },
      { id: crypto.randomUUID(), date: '2026-10-15', type: 'approach', measurement: 'height', cm: 67.5, notes: '' },
      { id: crypto.randomUUID(), date: '2026-10-15', type: 'approach', measurement: 'touch', cm: 305, notes: '' },
    ], readiness: [] }, performanceVersion: 1,
  })), { key: STORE, profile: DEFAULT_PROFILE, sessions });
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00Z`) });
  await page.goto('/');
});

for (const width of [320, 390]) {
  test(`Today exposes the workout, purpose and real weekly progress above navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await seedProgress(page);
    await safeAreas(page);
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
    const hero = page.getByRole('region', { name: 'Your day', exact: true });
    await expect(hero).toContainText('Upper Power');
    await expect(hero).toContainText('Hitting power + upper-body strength');
    const start = page.getByRole('button', { name: 'Start workout', exact: true });
    const progress = page.getByRole('button', { name: 'View training progress: 2 of 4 planned gym days recorded', exact: true });
    const nav = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
    for (const action of [start, progress]) {
      const bounds = (await action.boundingBox())!;
      expect(bounds.y).toBeGreaterThanOrEqual(47);
      expect(bounds.y + bounds.height).toBeLessThan(nav.y);
      await tappable(action, nav.y);
    }
    // The cover keeps one action and one real weekly-progress row; nutrition is
    // reachable without restoring the rejected home metric grid.
    const fuel = page.getByRole('button', { name: 'View today’s nutrition', exact: true });
    await expect(fuel).toContainText('Fuel');
    await tappable(fuel, nav.y);
    await fuel.click();
    await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'You', exact: true })).toHaveAttribute('data-state', 'active');
    await openSection(page, 'Today');
    await progress.click();
    await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toHaveAttribute('data-state', 'active');
    const progressViews = (await page.getByRole('group', { name: 'Chart metric', exact: true }).boundingBox())!;
    expect(progressViews.height).toBeLessThanOrEqual(56);
    await expect(page.getByRole('img', { name: /^Approach jump trend:/ })).toHaveAttribute('aria-label', /65 to 67\.5 centimetres/);
    await expect(page.getByRole('region', { name: 'Jump performance', exact: true })).not.toContainText('305');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('a workout keyboard keeps the current inputs and completion reachable without changing a set implicitly', async ({ page }) => {
  await safeAreas(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const focused = page.getByRole('region', { name: 'Current exercise', exact: true });
  const weight = focused.getByRole('textbox', { name: 'Medicine Ball Spike Slam set 1 weight in kilograms', exact: true });
  const reps = focused.getByRole('spinbutton', { name: 'Medicine Ball Spike Slam set 1 reps', exact: true });
  await weight.fill('12.5'); await reps.fill('4'); await weight.focus();
  await viewportKeyboard(page, 500);
  await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'true');
  const complete = focused.getByRole('button', { name: 'Complete Medicine Ball Spike Slam set 1', exact: true });
  await expect.poll(async () => {
    const input = (await weight.boundingBox())!, button = (await complete.boundingBox())!;
    return input.y >= 47 && input.y + input.height <= 484 && button.y + button.height <= 484;
  }).toBe(true);
  await expect(page.getByRole('tablist', { name: 'Main navigation', exact: true })).toBeHidden();
  await weight.press('Enter');
  await expect(weight).not.toBeFocused();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions[0].session.exercises[0].logs[0].done, STORE)).toBe(false);
  await viewportKeyboard(page, 844); await weight.focus(); await viewportKeyboard(page, 500);
  await tappable(complete, 500); await complete.tap(); await viewportKeyboard(page, 844);
  await expect(focused.getByRole('textbox', { name: 'Medicine Ball Spike Slam set 2 weight in kilograms', exact: true })).toHaveValue('12.5');
  await expect(page.getByRole('tablist', { name: 'Main navigation', exact: true })).toBeVisible();
  await expect(page.locator('.rest-floating')).toBeVisible();
});

test('touch navigation stays quiet while keyboard navigation retains a visible focus ring', async ({ page }) => {
  const today = page.getByRole('tab', { name: 'Today', exact: true });
  await today.tap();
  await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'pointer');
  expect(await today.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('none');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'keyboard');
  const focused = page.locator('.app-nav [role="tab"]:focus');
  await expect(focused).toHaveCount(1);
  expect(await focused.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
});

test('all-set controls fit a small phone for loaded, timed and measured exercises without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await safeAreas(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sun / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const focused = page.getByRole('region', { name: 'Current exercise', exact: true });
  for (const name of ['Approach Jump', 'Pogo Jump', 'Hack Squat']) {
    const movements = page.locator('.focused-movements');
    if (!await movements.evaluate(element => (element as HTMLDetailsElement).open)) await movements.locator(':scope > summary').click();
    await movements.getByRole('button', { name: `Train ${name}`, exact: true }).click();
    await focused.getByRole('button', { name: 'All sets', exact: true }).click();
    const checkbox = focused.getByRole('checkbox', { name: `Complete ${name} set 1`, exact: true });
    await tappable(checkbox, 568 - 100);
    expect(await focused.locator('.log-table').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await focused.getByRole('button', { name: 'Current set', exact: true }).click();
  }
});
