import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders';
import { startAlreadyWarmed, settingsGroup } from './helpers/navigation';
import { nativeOfflineServer } from './helpers/native-offline-server';

const STORE = 'setline.gym.v1', DATE = '2026-11-16', NAME = 'Barbell Bench Press';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const active = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active')?.session;
const focus = (page: Page) => page.getByRole('region', { name: 'Current exercise', exact: true });

async function installed(page: Page, origin: string) {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  const plan = structuredClone(DEFAULT_PROFILE.plan);
  plan[0] = { ...plan[0], name: 'Offline upper strength', minutes: 75, warmup: [], cooldown: [], exercises: [{
    key: 'native-offline-bench', exerciseId: 'bench-press', name: NAME, group: 'Chest', mode: 'weight',
    perSide: false, sets: 3, target: '6–10 reps', targetRir: 2, rest: 120, defaultKg: null, equipmentLabel: 'QA flat bench',
  }] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan, presentationMode: 'athlete',
    appearance: 'dark', timerSoundEnabled: false, restSeconds: 120,
    trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated test guidance; no actual medical claim.' } });
  const history = SessionSchema.parse(stopSessionTimers(createSession(plan[0], 0, '2026-11-09', profile, []), 'completed'));
  history.exercises[0].logs.forEach(log => Object.assign(log, { kg: 55, reps: 8, rir: 2, done: true }));
  const state = { schemaVersion: 1, profile, profileVersion: 4, sessions: [{ session: history, version: 2 }],
    nutrition: [], activities: [], reminders: defaultReminderState() };
  await page.addInitScript(({ origin, state }) => {
    if (location.origin === origin && !localStorage.getItem('setline.gym.v1')) localStorage.setItem('setline.gym.v1', JSON.stringify(state));
  }, { origin, state });
  await page.goto(origin);
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText(plan[0].name);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 20_000 }).toBe('activated');
  const shell = await page.evaluate(async () => {
    const names = await caches.keys(), name = names.find(name => name.startsWith('setline-pwa-') && !name.endsWith('-media'))!;
    return { name, paths: (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname) };
  });
  expect(shell.paths).toContain('/index.html');
  expect(shell.paths.filter(path => path.endsWith('.js')).length).toBeGreaterThan(1);
  return { state, shell };
}

async function coldPage(context: BrowserContext, origin: string) {
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${DATE}T10:01:00Z`) });
  const response = await page.goto(origin, { waitUntil: 'domcontentloaded' });
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return page;
}

test('an atomically installed cold app serves its shell before an actually hanging document request', async ({ page }) => {
  test.setTimeout(60_000);
  const server = await nativeOfflineServer();
  try {
    await installed(page, server.origin);
    const before = await read(page), baseline = server.requests.length;
    server.hang();
    const response = await page.goto(`${server.origin}/train`, { waitUntil: 'domcontentloaded', timeout: 5000 });
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.getByRole('tab', { name: 'Train', exact: true })).toBeVisible();
    expect(server.requests.slice(baseline).filter(path => ['/', '/train', '/index.html'].includes(path))).toEqual([]);
    expect(await read(page)).toEqual(before);
  } finally { await server.close(); }
});

test('offline cold launch supports all tabs, logging, Undo, refresh, finish and reconnect without changing the template', async ({ page, context }) => {
  test.setTimeout(90_000);
  const server = await nativeOfflineServer();
  let offlinePage: Page | undefined;
  try {
    const { state } = await installed(page, server.origin);
    await context.setOffline(true);
    await page.close();
    offlinePage = await coldPage(context, server.origin);
    const current = offlinePage;
    for (const name of ['Train', 'Progress', 'You', 'Today']) {
      await current.getByRole('tab', { name, exact: true }).click();
      await expect(current.getByRole('tab', { name, exact: true })).toHaveAttribute('data-state', 'active');
    }
    await current.getByRole('tab', { name: 'You', exact: true }).click();
    await current.getByRole('button', { name: 'Settings', exact: true }).click();
    const preferences = await settingsGroup(current, 'Training');
    await expect(preferences.getByLabel('Default rest · seconds', { exact: true })).toHaveValue('120');
    await current.getByRole('dialog', { name: 'Your preferences', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
    await current.getByRole('tab', { name: 'Today', exact: true }).click();
    await current.getByRole('region', { name: 'Your day', exact: true }).getByRole('button', { name: 'Start workout', exact: true }).click();
    await startAlreadyWarmed(current);
    await expect(focus(current)).toContainText('55 kg × 8');
    await focus(current).getByRole('textbox', { name: `${NAME} set 1 weight in kilograms`, exact: true }).fill('60');
    await focus(current).getByRole('button', { name: `Complete ${NAME} set 1`, exact: true }).click();
    await expect(focus(current).getByRole('textbox', { name: `${NAME} set 2 weight in kilograms`, exact: true })).toHaveValue('60');
    await current.getByRole('button', { name: 'Undo last set', exact: true }).click();
    await focus(current).getByRole('button', { name: `Complete ${NAME} set 1`, exact: true }).evaluate(button => {
      for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
    });
    const session = await active(current);
    expect(session.exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
    const deadline = await current.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'));
    await current.getByRole('tab', { name: 'Progress', exact: true }).click();
    await current.getByRole('tab', { name: 'Train', exact: true }).click();
    expect(await current.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBe(deadline);
    const response = await current.reload({ waitUntil: 'domcontentloaded' });
    expect(response?.fromServiceWorker()).toBe(true);
    await current.getByRole('tab', { name: 'Train', exact: true }).click();
    expect((await active(current)).id).toBe(session.id);
    await current.getByRole('button', { name: 'Quick Log', exact: true }).click();
    const second = current.getByRole('group', { name: `Quick log ${NAME} set 2`, exact: true });
    await second.getByRole('textbox', { name: `${NAME} set 2 weight in kilograms`, exact: true }).fill('62.5');
    await second.getByRole('spinbutton', { name: `${NAME} set 2 reps`, exact: true }).fill('7');
    await second.getByRole('button', { name: `Complete ${NAME} set 2`, exact: true }).click();
    const third = current.getByRole('group', { name: `Quick log ${NAME} set 3`, exact: true });
    await expect(third.getByRole('textbox', { name: `${NAME} set 3 weight in kilograms`, exact: true })).toHaveValue('62.5');
    await third.getByRole('button', { name: `Complete ${NAME} set 3`, exact: true }).click();
    await current.getByRole('button', { name: 'Finish workout', exact: true }).click();
    const finish = current.getByRole('dialog', { name: 'Finish your workout', exact: true });
    await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('75');
    await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
    await current.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
    const saved = await read(current);
    expect(saved.profile).toEqual(state.profile);
    expect(saved.sessions).toHaveLength(2);
    expect(saved.sessions.find((row: { session: { id: string } }) => row.session.id === state.sessions[0].session.id)).toEqual(state.sessions[0]);
    const completed = saved.sessions.find((row: { session: { id: string } }) => row.session.id === session.id).session;
    expect(completed.status).toBe('completed');
    expect(completed.exercises[0].logs.map((log: { kg: number; reps: number; done: boolean }) => [log.kg, log.reps, log.done]))
      .toEqual([[60, 8, true], [62.5, 7, true], [62.5, 7, true]]);
    await current.getByRole('tab', { name: 'Progress', exact: true }).click();
    await current.getByRole('button', { name: 'Strength history', exact: true }).click();
    await current.getByRole('combobox', { name: 'Movement', exact: true }).click();
    await current.getByRole('listbox').getByRole('option').filter({ hasText: /^Barbell Bench Press/ }).first().click();
    const history = current.locator('.movement-history');
    await expect(history.locator('button')).toHaveCount(2);
    await expect(history).toContainText('62.5 kg × 7');
    await expect(history).toContainText('55 kg × 8');
    await context.setOffline(false);
    await current.reload();
    expect(await read(current)).toEqual(saved);
    await expect(current.locator('html')).toHaveAttribute('data-theme', 'dark');
  } finally { await context.setOffline(false); await offlinePage?.close(); await server.close(); }
});

test('an interrupted replacement install preserves the active verified shell and offline records', async ({ page, context }) => {
  test.setTimeout(60_000);
  const server = await nativeOfflineServer();
  try {
    const { shell } = await installed(page, server.origin);
    const before = await read(page);
    server.breakInstall();
    await page.evaluate(() => navigator.serviceWorker.register('/service-worker.js?broken-install=1', { scope: '/', updateViaCache: 'none' }).then(() => undefined));
    await expect.poll(() => server.failures().failedAssets).toBeGreaterThan(0);
    await expect.poll(() => server.failures().brokenWorkerServed).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const names = await caches.keys();
      return !registration?.installing && !registration?.waiting && !names.some(name => name.includes('native-test-incomplete'));
    })).toBe(true);
    const actual = await page.evaluate(async () => ({ names: await caches.keys(), registrations: (await navigator.serviceWorker.getRegistrations()).length }));
    expect(actual.names).toContain(shell.name);
    expect(actual.registrations).toBe(1);
    server.repair();
    await context.setOffline(true);
    const response = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
    expect(await read(page)).toEqual(before);
  } finally { await context.setOffline(false); await server.close(); }
});
