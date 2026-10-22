import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';
import { openDisclosure, finishWarmup } from './helpers/navigation';

const STORE = 'setline.gym.v1';

async function startSunday(page: Page) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sun / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
}

async function movement(page: Page, name: string) {
  await page.locator('.focused-movements > summary').click();
  await page.getByRole('button', { name: `Train ${name}`, exact: true }).click();
}

function current(page: Page) {
  return page.getByRole('region', { name: 'Current exercise', exact: true });
}

async function complete(page: Page, name: string, set: number) {
  await current(page).getByRole('button', { name: `Complete ${name} set ${set}`, exact: true }).tap();
}

async function readExercise(page: Page, name: string) {
  return page.evaluate(({ key, name }) => JSON.parse(localStorage.getItem(key)!).sessions[0].session.exercises.find((e: any) => e.name === name), { key: STORE, name });
}

async function seedSunday(page: Page, pair = false) {
  const session = stopSessionTimers(createSession(DEFAULT_PROFILE.plan[6], 6, '2026-10-11', DEFAULT_PROFILE, []), 'active');
  for (const exercise of session.exercises) {
    if (exercise.key === 'approach-jump' || (pair && exercise.key === 'pogo')) {
      for (const log of exercise.logs) {
        log.done = true;
        if (exercise.mode === 'timed') log.seconds = 10;
        else log.reps = 2;
      }
    }
  }
  if (pair) Object.assign(session.exercises.find((e: any) => e.key === 'hack-squat').logs[0], { done: true, kg: 60, reps: 3 });
  await page.evaluate(({ key, session, profile }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session, version: 1 }], nutrition: [], activities: [],
  })), { key: STORE, session, profile: DEFAULT_PROFILE });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
}

async function contrast(button: Locator) {
  return button.evaluate(element => {
    const css = getComputedStyle(element);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => {
        const s = v / 255;
        return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const a = luminance(css.color), b = luminance(css.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-11T10:00:01Z'));
  await page.goto('/');
});

test('keeps both complex pair members together and alternates all rounds without the movement menu', async ({ page }) => {
  await startSunday(page);
  await movement(page, 'Hack Squat');
  const pair = page.getByRole('group', { name: 'Complex pair A', exact: true });
  await expect(pair).toContainText('Hack Squat');
  await expect(pair).toContainText('Countermovement Jump');
  await expect(pair).toContainText('3 min rest');
  for (let set = 1; set <= 3; set++) {
    await expect(pair).toContainText(`Round ${set} of 3`);
    await current(page).getByRole('textbox', { name: `Hack Squat set ${set} weight in kilograms`, exact: true }).fill('60');
    await current(page).getByRole('spinbutton', { name: `Hack Squat set ${set} reps`, exact: true }).fill('3');
    await complete(page, 'Hack Squat', set);
    await expect(current(page).getByRole('heading', { name: 'Countermovement Jump', exact: true })).toBeVisible();
    await expect(pair.getByRole('button', { name: 'View Countermovement Jump in pair A', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.rest-floating')).toContainText('03:00');
    await expect(current(page).getByRole('spinbutton', { name: `Countermovement Jump set ${set} Jump height · cm`, exact: true })).toHaveValue('');
    await current(page).getByRole('spinbutton', { name: `Countermovement Jump set ${set} reps`, exact: true }).fill('2');
    await complete(page, 'Countermovement Jump', set);
  }
  await expect(page.getByRole('group', { name: 'Complex pair B', exact: true })).toContainText('Round 1 of 2');
  await current(page).getByRole('textbox', { name: 'Bulgarian Split Squat set 1 weight in kilograms', exact: true }).fill('12.5');
  await current(page).getByRole('spinbutton', { name: 'Bulgarian Split Squat set 1 reps', exact: true }).fill('5');
  await complete(page, 'Bulgarian Split Squat', 1);
  await expect(current(page).getByRole('heading', { name: 'Broad Jump', exact: true })).toBeVisible();
  const squat = await readExercise(page, 'Hack Squat');
  const jump = await readExercise(page, 'Countermovement Jump');
  expect(squat.logs.map((l: any) => [l.kg, l.reps, l.done])).toEqual([[60, 3, true], [60, 3, true], [60, 3, true]]);
  expect(jump.logs.every((l: any) => l.kg === null && l.done)).toBe(true);
  expect([squat.rest, jump.rest]).toEqual([180, 180]);
});

test('resumes a legacy half-finished pair at its missing jump and keeps invalid strength sets current', async ({ page }) => {
  await seedSunday(page, true);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
  await expect(current(page).getByRole('heading', { name: 'Countermovement Jump', exact: true })).toBeVisible();
  await current(page).getByRole('spinbutton', { name: 'Countermovement Jump set 1 reps', exact: true }).fill('2');
  await complete(page, 'Countermovement Jump', 1);
  await expect(current(page).getByRole('textbox', { name: 'Hack Squat set 2 weight in kilograms', exact: true })).toBeVisible();
  await current(page).getByRole('textbox', { name: 'Hack Squat set 2 weight in kilograms', exact: true }).tap();
  await current(page).getByRole('textbox', { name: 'Hack Squat set 2 weight in kilograms', exact: true }).fill('');
  await current(page).getByRole('spinbutton', { name: 'Hack Squat set 2 reps', exact: true }).fill('3');
  await complete(page, 'Hack Squat', 2);
  await expect(current(page).getByRole('heading', { name: 'Hack Squat', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Complex pair A', exact: true })).toContainText('Round 2 of 3');
  await expect.poll(async () => (await readExercise(page, 'Hack Squat')).logs[1].done).toBe(false);
});

test('manual all-set edits and removing a timed set safely clear its running timer', async ({ page }) => {
  await seedSunday(page);
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(3000);
  await current(page).getByRole('button', { name: 'All sets', exact: true }).click();
  await current(page).getByRole('spinbutton', { name: 'Pogo Jump set 1 seconds', exact: true }).fill('12');
  await current(page).getByRole('checkbox', { name: 'Complete Pogo Jump set 1', exact: true }).check();
  await expect.poll(async () => (await readExercise(page, 'Pogo Jump')).logs[0].seconds).toBe(12);
  await expect.poll(async () => (await readExercise(page, 'Pogo Jump')).runningSince).toBeNull();
  await current(page).getByRole('button', { name: 'Current set', exact: true }).click();
  await current(page).getByRole('button', { name: 'View Pogo Jump set 3', exact: true }).click();
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).tap();
  await current(page).getByRole('button', { name: 'All sets', exact: true }).click();
  await current(page).getByRole('button', { name: 'Remove last set of Pogo Jump', exact: true }).click();
  await page.clock.runFor(500);
  await expect.poll(async () => {
    const exercise = await readExercise(page, 'Pogo Jump');
    return { sets: exercise.logs.length, owner: exercise.timerSetId, running: exercise.runningSince };
  }).toEqual({ sets: 2, owner: null, running: null });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(current(page).getByRole('spinbutton', { name: 'Pogo Jump set 2 seconds', exact: true })).toHaveValue('10');
});

test('the all-sets stopwatch switches ownership after a countdown and logs a blank-duration next set', async ({ page }) => {
  await seedSunday(page);
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(10000);
  await expect(page.getByRole('button', { name: 'Restart timer for Pogo Jump', exact: true })).toBeVisible();
  await complete(page, 'Pogo Jump', 1);
  await current(page).getByRole('button', { name: 'All sets', exact: true }).click();
  await current(page).getByRole('spinbutton', { name: 'Pogo Jump set 2 seconds', exact: true }).fill('');
  await current(page).getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(4000);
  await current(page).getByRole('checkbox', { name: 'Complete Pogo Jump set 2', exact: true }).check();
  await expect.poll(async () => (await readExercise(page, 'Pogo Jump')).logs.slice(0, 2).map((log: any) => [log.seconds, log.done])).toEqual([[10, true], [4, true]]);
});

test('runs, pauses, resumes and reloads a per-set countdown without automatically completing work', async ({ page }) => {
  await seedSunday(page);
  await expect(current(page).getByRole('spinbutton', { name: 'Pogo Jump set 1 seconds', exact: true })).toHaveValue('10');
  const clock = page.getByRole('timer', { name: 'Time remaining for Pogo Jump', exact: true });
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(4000);
  await expect(clock).toHaveText('00:06');
  await page.getByRole('button', { name: 'Pause timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(5000);
  await expect(clock).toHaveText('00:06');
  await expect(current(page).getByRole('spinbutton', { name: 'Pogo Jump set 1 seconds', exact: true })).toHaveValue('10');
  await expect.poll(async () => (await readExercise(page, 'Pogo Jump')).elapsedMs).toBe(4000);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(clock).toHaveText('00:06');
  await page.getByRole('button', { name: 'Resume timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(6000);
  await expect(clock).toHaveText('00:00');
  await expect(page.getByRole('button', { name: 'Restart timer for Pogo Jump', exact: true })).toBeVisible();
  expect((await readExercise(page, 'Pogo Jump')).logs[0].done).toBe(false);
  await complete(page, 'Pogo Jump', 1);
  await expect(current(page).getByRole('spinbutton', { name: 'Pogo Jump set 2 seconds', exact: true })).toHaveValue('10');
  await expect(clock).toHaveText('00:10');
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(5000);
  await page.getByRole('button', { name: 'Pause timer for Pogo Jump', exact: true }).tap();
  await complete(page, 'Pogo Jump', 2);
  await expect.poll(async () => (await readExercise(page, 'Pogo Jump')).logs.slice(0, 2).map((l: any) => [l.seconds, l.done])).toEqual([[10, true], [5, true]]);
});

test('adjusts and resets short timers with reachable touch controls on a small iPhone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seedSunday(page);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
  await page.getByRole('button', { name: 'Increase Pogo Jump duration by 5 seconds', exact: true }).tap();
  await expect(page.getByRole('timer', { name: 'Time remaining for Pogo Jump', exact: true })).toHaveText('00:15');
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(2000);
  await current(page).getByRole('button', { name: 'View Pogo Jump set 2', exact: true }).tap();
  await expect.poll(async () => (await readExercise(page, 'Pogo Jump')).runningSince).toBeNull();
  await expect(page.getByRole('timer', { name: 'Time remaining for Pogo Jump', exact: true })).toHaveText('00:10');
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).tap();
  await page.clock.runFor(3000);
  const reset = page.getByRole('button', { name: 'Reset timer for Pogo Jump', exact: true });
  await reset.tap();
  await expect(page.getByRole('timer', { name: 'Time remaining for Pogo Jump', exact: true })).toHaveText('00:10');
  for (const button of await page.locator('.timed-set-controls button').all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('keeps completion and undo readable after repeated iPhone taps and pointer hover', async ({ page }) => {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const name = 'Medicine Ball Spike Slam';
  await current(page).getByRole('textbox', { name: `${name} set 1 weight in kilograms`, exact: true }).fill('6');
  await current(page).getByRole('spinbutton', { name: `${name} set 1 reps`, exact: true }).fill('4');
  await complete(page, name, 1);
  const next = current(page).getByRole('button', { name: `Complete ${name} set 2`, exact: true });
  await expect(next).toBeVisible();
  await next.hover();
  expect(await contrast(next)).toBeGreaterThan(4.5);
  await next.tap();
  const third = current(page).getByRole('button', { name: `Complete ${name} set 3`, exact: true });
  expect(await contrast(third)).toBeGreaterThan(4.5);
  await current(page).getByRole('button', { name: `View ${name} set 1, complete`, exact: true }).click();
  expect(await contrast(current(page).getByRole('button', { name: `Undo ${name} set 1`, exact: true }))).toBeGreaterThan(4.5);
});

test('keeps volleyball minutes manual and permits correcting saved stopwatch durations', async ({ page }) => {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Tue / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  await openDisclosure(page, 'Training log');
  await expect(current(page).getByRole('spinbutton', { name: 'Volleyball practice set 1 minutes', exact: true })).toHaveValue('120');
  await expect(page.getByRole('timer', { name: 'Elapsed time for Volleyball practice', exact: true })).not.toBeVisible();
  await current(page).locator('.timed-set-stopwatch > summary').click();
  await page.getByRole('button', { name: 'Start timer for Volleyball practice', exact: true }).tap();
  await page.clock.runFor(7000);
  await page.getByRole('button', { name: 'Pause timer for Volleyball practice', exact: true }).tap();
  await complete(page, 'Volleyball practice', 1);
  await expect.poll(async () => (await readExercise(page, 'Volleyball practice')).logs[0].seconds).toBe(7);
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('dialog', { name: 'Finish your workout', exact: true }).getByLabel('Workout duration · minutes', { exact: true }).fill('120');
  await page.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit this log', exact: true }).click();
  await current(page).getByRole('spinbutton', { name: 'Volleyball practice set 1 minutes', exact: true }).fill('122');
  await current(page).getByRole('button', { name: 'Undo Volleyball practice set 1', exact: true }).click();
  await complete(page, 'Volleyball practice', 1);
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await expect.poll(async () => (await readExercise(page, 'Volleyball practice')).logs[0].seconds).toBe(7320);
});
