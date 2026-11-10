import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createV81VolleyballMasterPlan, createVolleyballMasterPlan } from '../src/volleyball-master-plan';
import { finishWarmup, openDisclosure } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seed(page: Page, match: boolean, editedDay: 'sat' | 'sun') {
  await page.clock.install({ time: new Date('2026-11-02T11:00:00Z') });
  await page.goto('/');
  const plan = createVolleyballMasterPlan();
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan,
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: match ? [1] : [],
      clearance: { impact: 'cleared', heavyLifting: 'cleared' } },
    masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    sessionDrafts: [{ date: editedDay === 'sat' ? '2026-11-07' : '2026-11-08', slot: 'main', customized: true,
      plan: { ...structuredClone(plan[5]), name: 'My saved lower variation' } }],
  });
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [],
  })), { key: STORE, profile });
  await page.reload();
}

test('a personal weekend draft prevents an automatic duplicate when moving Lower B', async ({ page }) => {
  await seed(page, false, 'sat');
  const before = await read(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await openDisclosure(page, 'Workout options');
  await openDisclosure(page, 'Weekend schedule');
  await page.getByRole('button', { name: 'Move Lower B to Sunday', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Move Lower B to Sunday?', exact: true });
  await confirmation.getByRole('button', { name: 'Move to Sunday', exact: true }).click();
  await expect(confirmation.getByRole('alert')).toContainText('could not move');
  expect(await read(page)).toEqual(before);
});

test('a Sunday match takes priority while a personal gym draft survives preview, warm-up and logging', async ({ page }) => {
  await seed(page, true, 'sun');
  const before = await read(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sun / }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Volleyball Match');
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview).toContainText('Volleyball match');
  await expect(preview).not.toContainText('My saved lower variation');
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await read(page)).toEqual(before);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  await expect(page.locator('.session-card h2')).toHaveText('Volleyball Match');
  const after = await read(page);
  expect(after.profile.sessionDrafts).toEqual(before.profile.sessionDrafts);
  expect(after.sessions).toHaveLength(1);
  expect(after.sessions[0].session.name).toBe('Volleyball Match');
  expect(after.sessions[0].session.status).toBe('active');
  await page.reload();
  expect((await read(page)).profile.sessionDrafts).toEqual(before.profile.sessionDrafts);
});

test('an older personal date edit follows V13.1 yellow readiness without rewriting the saved edit', async ({ page }) => {
  await seed(page, false, 'sat');
  const old = createV81VolleyballMasterPlan()[2];
  await page.evaluate(({ key, old }) => {
    const store = JSON.parse(localStorage.getItem(key)!);
    store.profile.sessionDrafts[0].plan = old;
    store.profile.sessionDrafts[0].readiness = 'yellow';
    store.profile.masterProgram.readiness = [{ date: '2026-11-07', status: 'yellow' }];
    localStorage.setItem(key, JSON.stringify(store));
  }, { key: STORE, old });
  await page.reload();
  const before = await read(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const exercises = page.getByRole('dialog', { name: 'Workout preview', exact: true }).getByRole('list', { name: 'Scheduled exercises', exact: true });
  await expect(exercises).toContainText('Hack Squat');
  await expect(exercises).not.toContainText('Approach Jump');
  await expect(exercises).not.toContainText('CMJ with Arm Swing');
  await expect(exercises).not.toContainText('Drop Jump');
  expect(await read(page)).toEqual(before);
});
