import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-17';
const NAME = 'Machine Chest Press';

async function seed(page: Page, appearance: 'light' | 'dark') {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance, presentationMode: 'athlete' });
  const movement = profile.plan.flatMap(day => day.exercises).find(exercise => exercise.name === NAME)!;
  const plan = { name: 'Benchmark active workout', kind: 'strength' as const, minutes: 75, note: '',
    warmup: [], cooldown: [], exercises: [{ ...movement, key: 'compact-press', exerciseId: 'chest-press', sets: 4, target: '8 reps' }] };
  const previous = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-11-16', profile, []), 'completed'));
  previous.exercises[0].logs.forEach(log => Object.assign(log, { kg: 50, reps: 8, done: true }));
  const active = SessionSchema.parse(createSession(plan, 1, DATE, profile, [previous]));
  active.startedAt = Date.parse(`${DATE}T10:00:00Z`); active.runningSince = null;
  const state = { schemaVersion: 1, profile, profileVersion: 1, sessions: [
    { session: previous, version: 1 }, { session: active, version: 1 },
  ], nutrition: [], activities: [] };
  await page.evaluate(state => {
    localStorage.setItem('setline.gym.v1', JSON.stringify(state));
    sessionStorage.clear();
  }, state);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
  return page.evaluate(key => localStorage.getItem(key), STORE);
}

async function assertUnobscuredCompletion(page: Page) {
  const button = page.getByRole('button', { name: `Complete ${NAME} set 1`, exact: true });
  const rect = (await button.boundingBox())!;
  const nav = (await page.locator('.native-tabbar').boundingBox())!;
  expect(rect.width).toBeGreaterThanOrEqual(44);
  expect(rect.height).toBeGreaterThanOrEqual(44);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(nav.y);
  expect(await button.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return [0.15, 0.5, 0.85].every(horizontal => {
      const target = document.elementFromPoint(bounds.x + bounds.width * horizontal, bounds.y + bounds.height / 2);
      return target === element || (target !== null && element.contains(target));
    });
  })).toBe(true);
}

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  for (const appearance of ['light', 'dark'] as const) {
    test(`Focus controls fit ${viewport.width}×${viewport.height} ${appearance} without a floating action covering inputs`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
      await page.goto('/');
      const before = await seed(page, appearance);
      const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
      await page.evaluate(() => scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await assertUnobscuredCompletion(page);
      await expect(focus.getByRole('textbox', { name: `${NAME} set 1 weight in kilograms`, exact: true })).toHaveAttribute('inputmode', 'decimal');
      for (const button of await focus.locator('.focused-number-stepper__actions > button').all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: testInfo.outputPath(`focus-${viewport.width}-${appearance}.png`) });

      // Explicitly enlarge the exercise heading and labels to stress wrapping.
      // This is browser layout testing, not an assertion about iOS Dynamic Type.
      await page.addStyleTag({ content: '.focused-exercise__name{font-size:40px!important}.focused-set-field>span{font-size:22px!important}' });
      await page.getByRole('button', { name: `Complete ${NAME} set 1`, exact: true }).scrollIntoViewIfNeeded();
      await assertUnobscuredCompletion(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`focus-large-text-${viewport.width}-${appearance}.png`) });
      expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
    });
  }
}
