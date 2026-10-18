import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { openDisclosure } from './helpers/navigation';

const STORE = 'setline.gym.v1';

async function seed(page: Page, appearance: 'light' | 'dark') {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await page.addInitScript(({ key, profile, appearance }) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({
        schemaVersion: 1,
        profileVersion: 1,
        profile: { ...profile, appearance },
        sessions: [], nutrition: [], activities: [],
      }));
    }
  }, { key: STORE, profile: DEFAULT_PROFILE, appearance });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
}

// Resolve all ancestor backgrounds: inherited dark text on a legacy white
// container must fail even if the page itself uses the correct theme tokens.
async function expectReadable(text: Locator) {
  const samples = await text.evaluateAll(elements => {
    const context = document.createElement('canvas').getContext('2d')!;
    context.canvas.width = context.canvas.height = 1;
    const rgba = (value: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      return [pixel[0], pixel[1], pixel[2], pixel[3] / 255];
    };
    const composite = (front: number[], back: number[]) =>
      [0, 1, 2].map(channel => front[channel] * front[3] + back[channel] * (1 - front[3]));
    const luminance = (color: number[]) => color.slice(0, 3).reduce((sum, channel, index) => {
      const value = channel / 255;
      return sum + (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index];
    }, 0);
    return elements.filter(element => element.getClientRects().length).map(element => {
      const ancestors: Element[] = [];
      for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
      let background = [255, 255, 255];
      for (const ancestor of ancestors) background = composite(rgba(getComputedStyle(ancestor).backgroundColor), background);
      const foreground = composite(rgba(getComputedStyle(element).color), background);
      const light = luminance(foreground), dark = luminance(background);
      return {
        text: element.textContent?.trim() || element.getAttribute('aria-label'),
        foreground, background,
        contrast: (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05),
      };
    });
  });
  expect(samples.length, 'The section must contain visible text to check').toBeGreaterThan(0);
  for (const sample of samples) {
    expect(sample.contrast, `${sample.text}: ${JSON.stringify(sample)}`).toBeGreaterThanOrEqual(4.5);
  }
}

test('dark controls keep contrast on hover and while movement and rest timers run', async ({ page }) => {
  await seed(page, 'dark');
  const calendar = page.getByRole('button', { name: 'Choose training day', exact: true });
  await calendar.hover();
  await expectReadable(calendar);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await openDisclosure(page, 'Workout options');
  const choose = page.getByRole('button', { name: 'Choose workout', exact: true });
  await choose.hover();
  await expectReadable(choose);

  await page.getByRole('button', { name: /^Sun / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.locator('summary').filter({ hasText: /^Movements/ }).click();
  await page.getByRole('button', { name: 'Train Pogo Jump', exact: true }).click();
  await page.getByRole('button', { name: 'All sets', exact: true }).click();
  const start = page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true });
  await expectReadable(start);
  await start.click();
  const stop = page.getByRole('button', { name: 'Stop timer for Pogo Jump', exact: true });
  await expectReadable(stop);
  await stop.click();
  await page.getByRole('spinbutton', { name: 'Pogo Jump set 1 seconds', exact: true }).fill('15');
  await page.getByRole('checkbox', { name: 'Complete Pogo Jump set 1', exact: true }).check();
  await openDisclosure(page, 'Session tools');
  await page.locator('summary').filter({ hasText: /^Rest timer$/ }).click();
  const rest = page.getByRole('timer', { name: 'Rest time remaining', exact: true });
  await expect(rest).toHaveClass(/counting/);
  await expectReadable(rest);
});

async function readSession(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions[0]?.session, STORE);
}

async function readStoredData(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

const phoneSizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

for (const appearance of ['light', 'dark'] as const) {
  for (const size of phoneSizes) {
    test(`exercise previews stay compact, readable and read-only at ${size.width}px in ${appearance}`, async ({ page }) => {
      await page.setViewportSize(size);
      await seed(page, appearance);
      await page.getByRole('tab', { name: 'Train', exact: true }).click();
      const storedBeforeBrowsing = await readStoredData(page);

      // Cover an upper-body day and the jump day from the user's screenshot.
      for (const day of ['Mon', 'Sun']) {
        await page.getByRole('button', { name: new RegExp(`^${day} `) }).click();
        const disclosure = page.locator('.planned-preview');
        const summary = disclosure.locator('summary');
        if (!(await disclosure.evaluate(element => element.hasAttribute('open')))) await summary.click();
        const sequence = page.getByRole('list', { name: 'Planned exercises', exact: true });
        await expect(sequence).toBeVisible();
        const rows = sequence.locator('.workout-preview__item');
        expect(await rows.count()).toBeGreaterThan(1);

        // Test the actual background chain rather than just the page theme:
        // the original bug was a white list containing inherited white text.
        await expectReadable(sequence.locator('.workout-preview__index, .workout-preview__copy > strong, .workout-preview__copy > span, .workout-preview__dose > strong, .workout-preview__dose > span'));
        for (const element of [sequence, rows.first()]) {
          const surface = await element.evaluate(node => {
            const style = getComputedStyle(node);
            return { background: style.backgroundColor, radius: style.borderRadius };
          });
          expect(surface.background).toBe('rgba(0, 0, 0, 0)');
          expect(surface.radius).toBe('0px');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await sequence.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);

        const first = rows.first().getByRole('button');
        const bounds = (await first.boundingBox())!;
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        // A single full-width action replaces the oversized exercise cards.
        expect(bounds.height).toBeLessThanOrEqual(132);
        const name = await rows.first().locator('.workout-preview__copy > strong').innerText();
        if (day === 'Sun') expect(name).toBe('Approach Jump');
        await expect(first).toHaveAccessibleName(`Exercise details for ${name}`);
        await first.click();
        const guide = page.locator('.exercise-guide-sheet');
        await expect(guide.getByRole('heading', { name, exact: true })).toBeVisible();
        await expectReadable(guide.locator('.exercise-guide__title, .exercise-guide__category'));
        await guide.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(guide).not.toBeVisible();
        await expect(first).toBeFocused();
      }

      // Browsing and opening guides must never start a workout or edit a plan.
      expect(await readStoredData(page)).toEqual(storedBeforeBrowsing);
    });
  }
}

for (const appearance of ['light', 'dark'] as const) {
  test(`preparation stays readable and its large checklist controls persist in ${appearance}`, async ({ page }) => {
    await seed(page, appearance);
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await openDisclosure(page, 'Session tools');
    const panels = page.locator('.routine-panel');
    await expect(panels).toHaveCount(2);

    for (const panel of await panels.all()) {
      const trigger = panel.locator('[data-slot="accordion-trigger"]');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expectReadable(trigger.locator('strong, .routine-meta'));
      await trigger.click();
      await expect(panel.locator('.routine-note')).toBeVisible();
      await expectReadable(panel.locator('.routine-note, .routine-steps strong, .routine-target, .routine-steps li > div > p'));
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
    await openDisclosure(page, 'Session tools');
    for (const panel of await panels.all()) {
      await panel.locator('[data-slot="accordion-trigger"]').click();
      const checkbox = panel.getByRole('checkbox').first();
      await checkbox.scrollIntoViewIfNeeded();
      const bounds = (await checkbox.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await checkbox.check();
      await expect(checkbox).toBeChecked();
      await expectReadable(panel.locator('.routine-steps li').first().locator('strong, .routine-target, p'));
    }
    await expect.poll(async () => {
      const session = await readSession(page);
      return !!session?.warmup[0].done && !!session?.cooldown[0].done;
    }).toBe(true);
    const saved = await readSession(page);
    await page.reload();
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await openDisclosure(page, 'Session tools');
    for (const panel of await panels.all()) {
      const trigger = panel.locator('[data-slot="accordion-trigger"]');
      await expectReadable(trigger.locator('strong, .routine-meta'));
      await trigger.click();
      await expect(panel.getByRole('checkbox').first()).toBeChecked();
      await expectReadable(panel.locator('.routine-steps li').first().locator('strong, .routine-target, p'));
    }
    expect(await readSession(page)).toEqual(saved);
  });

  test(`empty workout history has readable copy and a usable action in ${appearance}`, async ({ page }) => {
    await seed(page, appearance);
    await page.getByRole('tab', { name: 'Progress', exact: true }).click();
    await page.getByRole('button', { name: 'View history', exact: true }).click();
    const empty = page.locator('.empty-state.large');
    await expect(empty.getByRole('heading', { name: 'Your first workout starts the story.', exact: true })).toBeVisible();
    await expectReadable(empty.locator('h2, p, button'));
    await empty.getByRole('button', { name: 'Open workout', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Train', exact: true })).toHaveAttribute('data-state', 'active');
    await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
    expect(await readSession(page)).toBeUndefined();
  });
}
