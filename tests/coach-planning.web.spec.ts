import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { finishWarmup, openSection, settingsGroup } from './helpers/navigation';
import { COACH_SATURDAY, COACH_SUNDAY, COACH_TODAY, chooseFeeling, coachDay, coachPreview,
  coachRaw, coachRead, expectCoachFullSaturday, expectCoachPreserved, openCoachPreview, seedCoach } from './helpers/coach';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${COACH_TODAY}T10:00:00Z`) });
  await page.goto('/');
});

test('the older Return to saved plan route retains dated matches and readiness alongside untouched history', async ({ page }) => {
  const before = await seedCoach(page);
  const coachRecords = { calendarMatches: [{ date: COACH_SUNDAY, scheduled: true, opponent: 'QA visitor' }],
    dailyReadiness: [{ date: COACH_SATURDAY, feeling: 'normal' }] };
  const previousPlan = structuredClone(before.profile.plan);
  previousPlan[0].name = 'QA saved personal weekly workout';
  await page.evaluate(({ coachRecords, previousPlan }) => {
    const state = JSON.parse(localStorage.getItem('setline.gym.v1')!);
    state.profile.preMasterPlan = previousPlan;
    Object.assign(state.profile.masterProgram, coachRecords);
    localStorage.setItem('setline.gym.v1', JSON.stringify(state));
  }, { coachRecords, previousPlan });
  await page.reload();
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  await page.locator('.native-program-options > summary').click();
  await page.getByRole('button', { name: 'Return to saved plan', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Return to your saved plan?', exact: true })
    .getByRole('button', { name: 'Restore saved plan', exact: true }).click();
  await expect.poll(async () => (await coachRead(page)).profile.masterProgram).toBeUndefined();
  const after = await coachRead(page);
  expect(after.profile.coachRecords).toEqual(coachRecords);
  expect(after.profile.plan).toEqual(previousPlan);
  expect(after.profile.trainingGuidance).toEqual(before.profile.trainingGuidance);
  for (const key of ['sessions', 'nutrition', 'activities', 'reminders', 'performance']) {
    expect(after[key]).toEqual(before[key as keyof typeof before]);
  }
  await page.reload();
  expect((await coachRead(page)).profile.coachRecords).toEqual(coachRecords);
});

test('the reported Week 4 Easy Preparation state presents the complete planning reference and honest safe duration', async ({ page }) => {
  const before = await seedCoach(page, { guidance: 'unknown', legacyReadiness: true });
  const saved = await coachRaw(page);
  await coachDay(page, 'Sat');
  await expect(page.getByRole('heading', { name: 'Lower B — Full Strength', exact: true })).toBeVisible();
  await expect(page.locator('.native-session-overview')).toContainText('11 exercises');
  await expect(page.locator('.native-session-overview')).toContainText('29');
  await expect(page.locator('.native-session-overview')).not.toContainText('Week 4');
  await expect(page.getByRole('region', { name: 'Daily readiness', exact: true })).toContainText('Readiness unknown');
  const sheet = await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li')).toHaveCount(9);
  await expect(sheet.locator('.plan-preview__summary')).toContainText('18 sets');
  await expect(sheet.locator('.plan-preview__summary')).not.toContainText('85–105 min');
  await expect(sheet).toContainText(/guidance.*unconfirmed|unconfirmed.*guidance/i);
  expect(await coachRaw(page)).toBe(saved);
  await expectCoachPreserved(page, before);
});

test('Great and Normal retain the complete dose while Tired and Poor are specific date-only recommendations', async ({ page }) => {
  const before = await seedCoach(page, { legacyReadiness: true });
  await coachDay(page, 'Sat');
  for (const feeling of ['Great', 'Normal'] as const) {
    await chooseFeeling(page, feeling);
    await openCoachPreview(page);
    await expectCoachFullSaturday(page);
    const recommended = coachPreview(page).getByRole('button', { name: 'Recommended today', exact: true });
    if (await recommended.isVisible()) await recommended.click();
    await expectCoachFullSaturday(page);
    await coachPreview(page).getByRole('button', { name: 'Close', exact: true }).click();
  }
  await chooseFeeling(page, 'Tired');
  let sheet = await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  const rows = sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li');
  expect(await rows.count()).toBeLessThan(11);
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true })).not.toContainText('10 m Acceleration');
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true })).not.toContainText('Split-Squat Jump');
  const changes = sheet.getByRole('list', { name: 'Prescription changes', exact: true });
  if (!await changes.isVisible()) {
    const details = sheet.locator('.workout-prescription__details');
    if (!await details.evaluate(element => element.hasAttribute('open'))) await details.locator(':scope > summary').click();
    await sheet.locator('.workout-prescription__changes > summary').click();
  }
  await expect(changes).toContainText('Leg Press');
  await expect(changes).toContainText('10 m Acceleration');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await chooseFeeling(page, 'Poor');
  sheet = await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  await expect(sheet).toContainText(/Recovery/i);
  await expect(sheet.getByRole('button', { name: 'Exercise details for Leg Press', exact: true })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  const after = await coachRead(page);
  expect(after.profile.masterProgram.dailyReadiness).toEqual([{ date: COACH_SATURDAY, feeling: 'poor' }]);
  expect(after.profile.masterProgram.readiness).toEqual(before.profile.masterProgram!.readiness);
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText(/Volleyball/i);
  await coachDay(page, 'Sat');
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Daily readiness', exact: true })).toContainText('Readiness unknown');
  await expectCoachPreserved(page, before);
});

test('Great cannot bypass unconfirmed guidance when starting from the full reference', async ({ page }) => {
  const before = await seedCoach(page, { guidance: 'unknown' });
  await coachDay(page, 'Sat');
  await chooseFeeling(page, 'Great');
  const sheet = await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  const start = sheet.getByRole('button', { name: /^Start (?:adjusted|recommended) workout$/ });
  await start.click();
  await finishWarmup(page);
  await expect.poll(async () => (await coachRead(page)).sessions.filter((row: { session: { status: string } }) => row.session.status === 'active').length).toBe(1);
  const after = await coachRead(page);
  const active = after.sessions.find((row: { session: { status: string } }) => row.session.status === 'active').session;
  expect(active.name).toBe('Modified — Easy Preparation');
  expect(active.exercises).toHaveLength(9);
  for (const exercise of active.exercises) {
    expect(exercise.sets).toBeLessThanOrEqual(2);
    expect(exercise.preparationOnly).toBe(true);
    expect(exercise.targetRpe).toBe(5);
    expect(exercise.quantityUnit).toBeUndefined();
    expect(exercise.jumpContactsPerRep).toBeUndefined();
    expect(exercise.logs.every((log: { done: boolean }) => !log.done)).toBe(true);
  }
  expect(after.profile.trainingGuidance).toEqual(before.profile.trainingGuidance);
  expect(after.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
  expect(after.nutrition).toEqual(before.nutrition);
});

test('a real Sunday date toggles only its preceding Saturday and retains optional match details through refresh', async ({ page }) => {
  const before = await seedCoach(page);
  await coachDay(page, 'Sun');
  const match = page.getByRole('region', { name: 'Sunday match schedule', exact: true });
  const toggle = match.getByRole('switch', { name: 'Match scheduled', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await match.locator('summary', { hasText: 'Match details (optional)' }).click();
  await expect(match.getByLabel('Match start time', { exact: true })).toHaveValue('');
  await match.getByLabel('Opponent', { exact: true }).fill('QA visiting team');
  await match.getByLabel('Location', { exact: true }).fill('QA court');
  await match.getByLabel('Match notes', { exact: true }).fill('Explicit optional match details');
  await match.getByRole('button', { name: 'Save match details', exact: true }).click();
  await expect.poll(async () => (await coachRead(page)).profile.masterProgram.calendarMatches.find((entry: { date: string }) => entry.date === COACH_SUNDAY)?.opponent).toBe('QA visiting team');
  await coachDay(page, 'Sat');
  await expect(page.getByRole('heading', { name: 'Pre-Match Primer', exact: true })).toBeVisible();
  await openCoachPreview(page);
  await expect(coachPreview(page).getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li')).toHaveCount(4);
  await coachPreview(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await coachDay(page, 'Sun');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await match.locator('summary', { hasText: 'Match details (optional)' }).click();
  await expect(match.getByLabel('Opponent', { exact: true })).toHaveValue('QA visiting team');
  await expect(match.getByLabel('Location', { exact: true })).toHaveValue('QA court');
  await expect(match.getByLabel('Match start time', { exact: true })).toHaveValue('');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await coachDay(page, 'Sat');
  await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  await coachPreview(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  await coachPreview(page).getByRole('button', { name: 'Close', exact: true }).click();
  await coachDay(page, 'Sun');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  const stored = (await coachRead(page)).profile.masterProgram.calendarMatches;
  expect(stored).toEqual([{ date: COACH_SUNDAY, scheduled: false, opponent: 'QA visiting team', location: 'QA court', notes: 'Explicit optional match details' }]);
  await expectCoachPreserved(page, before);
});

test('editing a migrated Sunday retains historic week selections at their original dates without rolling another weekend forward', async ({ page }) => {
  const before = await seedCoach(page, { legacyMatches: true });
  const saved = await coachRaw(page);
  await coachDay(page, 'Sun');
  const toggle = page.getByRole('region', { name: 'Sunday match schedule', exact: true }).getByRole('switch', { name: 'Match scheduled', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(await coachRaw(page)).toBe(saved);
  await toggle.click();
  await expect.poll(async () => (await coachRead(page)).profile.masterProgram.calendarMatches?.length).toBe(2);
  const settings = (await coachRead(page)).profile.masterProgram;
  expect(settings.matchWeeks).toEqual([1, 4]);
  expect(settings.calendarMatches).toEqual([{ date: '2026-10-18', scheduled: true }, { date: COACH_SUNDAY, scheduled: false }]);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expectCoachPreserved(page, before);
});

test('an old V9 reduced date draft is preserved for explicit review and never silently becomes the full baseline', async ({ page }) => {
  const before = await seedCoach(page, { oldDraft: true });
  const saved = await coachRaw(page);
  await coachDay(page, 'Sat');
  const sheet = await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  await expect(sheet.getByRole('button', { name: 'Review saved date edit', exact: true })).toBeVisible();
  expect(await coachRaw(page)).toBe(saved);
  await sheet.getByRole('button', { name: 'Review saved date edit', exact: true }).click();
  const offer = page.getByRole('dialog', { name: 'Review V9 Upcoming Workouts', exact: true });
  await offer.getByRole('button', { name: 'Review Weekly Schedule', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review Weekly Schedule', exact: true });
  await review.getByRole('combobox', { name: `V9 choice for ${COACH_SATURDAY} main`, exact: true }).selectOption('keep');
  await review.getByRole('button', { name: 'Apply V9 to Future Workouts', exact: true }).click();
  await expect(review).not.toBeVisible();
  const after = await coachRead(page);
  const kept = after.profile.sessionDrafts.find((entry: { date: string }) => entry.date === COACH_SATURDAY);
  expect(kept.plan).toEqual(before.profile.sessionDrafts!.find(entry => entry.date === COACH_SATURDAY)!.plan);
  expect(kept.reviewedForCoach).toBe(1);
  expect(after.profile.sessionDrafts.filter((entry: { date: string }) => entry.date !== COACH_SATURDAY)).toEqual(before.profile.sessionDrafts!.filter(entry => entry.date !== COACH_SATURDAY));
  await expectCoachPreserved(page, before);
});

test('320px dark training keeps the complete reference and the primary action above navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seedCoach(page, { appearance: 'dark' });
  await coachDay(page, 'Sat');
  await expect(page.getByRole('heading', { name: 'Lower B — Full Strength', exact: true })).toBeVisible();
  const action = page.getByRole('button', { name: 'Start workout', exact: true });
  const nav = page.getByRole('tablist', { name: 'Main navigation', exact: true });
  await expect.poll(async () => {
    const button = await action.boundingBox(), tabs = await nav.boundingBox();
    return !!button && !!tabs && button.height >= 48 && button.y >= 0 && button.y + button.height <= tabs.y;
  }).toBe(true);
  expect(await action.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return hit !== null && element.contains(hit);
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('date matches and daily readiness roundtrip in a validated backup and remain editable offline', async ({ page, context }) => {
  const before = await seedCoach(page);
  await coachDay(page, 'Sat');
  await chooseFeeling(page, 'Normal');
  await coachDay(page, 'Sun');
  await page.getByRole('region', { name: 'Sunday match schedule', exact: true }).getByRole('switch', { name: 'Match scheduled', exact: true }).click();
  await expect.poll(async () => (await coachRead(page)).profile.masterProgram.calendarMatches[0]?.scheduled).toBe(true);
  const configured = await coachRead(page);
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const data = await settingsGroup(page, 'Data & Backup');
  const download = page.waitForEvent('download');
  await data.getByRole('button', { name: 'Export backup', exact: true }).click();
  const path = await (await download).path();
  if (!path) throw new Error('Isolated QA backup download was unavailable.');
  const text = await readFile(path, 'utf8');
  const exported = JSON.parse(text);
  expect(exported.version).toBe(1);
  expect(exported.data.profile.masterProgram.calendarMatches).toEqual(configured.profile.masterProgram.calendarMatches);
  expect(exported.data.profile.masterProgram.dailyReadiness).toEqual(configured.profile.masterProgram.dailyReadiness);
  expect(exported.data.performance).toEqual(before.performance);
  const invalid = structuredClone(exported);
  invalid.data.profile.masterProgram.calendarMatches[0].date = COACH_SATURDAY;
  const saved = await coachRaw(page);
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'invalid-saturday-match.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(data.getByRole('alert')).toBeVisible();
  expect(await coachRaw(page)).toBe(saved);
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'coach-qa-backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(data.getByRole('region', { name: 'Backup restore preview', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), data.getByRole('button', { name: 'Restore backup', exact: true }).click()]);
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  expect((await coachRead(page)).profile).toEqual(configured.profile);
  expect((await coachRead(page)).sessions).toEqual(before.sessions);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await coachDay(page, 'Sat');
  await expect(page.getByRole('heading', { name: 'Pre-Match Primer', exact: true })).toBeVisible();
  await coachDay(page, 'Sun');
  const toggle = page.getByRole('region', { name: 'Sunday match schedule', exact: true }).getByRole('switch', { name: 'Match scheduled', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await coachDay(page, 'Sat');
  await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  await expectCoachPreserved(page, before);
});

test('a lighter phase is an explicit dated choice that can be replaced without restarting a cycle', async ({ page }) => {
  const before = await seedCoach(page);
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  const options = page.locator('.native-program-options');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
  const advanced = options.locator('details').filter({ has: page.locator('summary', { hasText: /^Advanced training options/ }) }).first();
  if (!await advanced.evaluate(element => element.hasAttribute('open'))) await advanced.locator(':scope > summary').click();
  const phases = advanced.locator('details').filter({ has: page.locator('summary', { hasText: /^Optional training phases/ }) }).first();
  if (!await phases.evaluate(element => element.hasAttribute('open'))) await phases.locator(':scope > summary').click();
  await phases.getByRole('combobox', { name: 'Training phase', exact: true }).selectOption('deload');
  await phases.getByLabel('Phase start date', { exact: true }).fill(COACH_SATURDAY);
  await phases.getByLabel('Phase end date', { exact: true }).fill(COACH_SATURDAY);
  await phases.getByRole('button', { name: 'Apply phase to selected dates', exact: true }).click();
  await expect.poll(async () => (await coachRead(page)).profile.masterProgram.trainingPhases).toEqual([{ startDate: COACH_SATURDAY, endDate: COACH_SATURDAY, phase: 'deload' }]);
  await coachDay(page, 'Sat');
  let sheet = await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  await expect(sheet.locator('.plan-preview__summary')).toContainText('20 sets');
  await expect(sheet.locator('.plan-preview__summary')).not.toContainText('85–105 min');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
  if (!await advanced.evaluate(element => element.hasAttribute('open'))) await advanced.locator(':scope > summary').click();
  if (!await phases.evaluate(element => element.hasAttribute('open'))) await phases.locator(':scope > summary').click();
  await phases.getByRole('combobox', { name: 'Training phase', exact: true }).selectOption('normal');
  await phases.getByLabel('Phase start date', { exact: true }).fill(COACH_SATURDAY);
  await phases.getByLabel('Phase end date', { exact: true }).fill(COACH_SATURDAY);
  await phases.getByRole('button', { name: 'Apply phase to selected dates', exact: true }).click();
  await expect.poll(async () => (await coachRead(page)).profile.masterProgram.trainingPhases?.length).toBe(2);
  await coachDay(page, 'Sat');
  sheet = await openCoachPreview(page);
  await expectCoachFullSaturday(page);
  expect((await coachRead(page)).profile.masterProgram.startDate).toBe(before.profile.masterProgram!.startDate);
  await expectCoachPreserved(page, before);
});

test('optional recovery details open the actual current-date observation form without recording future conditions', async ({ page }) => {
  await seedCoach(page);
  await coachDay(page, 'Sat');
  const future = page.getByRole('region', { name: 'Daily readiness', exact: true });
  await future.locator('.daily-readiness__details > summary').click();
  await expect(future.getByRole('button', { name: 'Add optional recovery details', exact: true })).toHaveCount(0);
  await page.clock.setFixedTime(new Date(`${COACH_SATURDAY}T10:00:00Z`));
  await page.reload();
  await coachDay(page, 'Sat');
  const before = await coachRaw(page);
  const current = page.getByRole('region', { name: 'Daily readiness', exact: true });
  await current.locator('.daily-readiness__details > summary').click();
  await current.getByRole('button', { name: 'Add optional recovery details', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toHaveAttribute('data-state', 'active');
  const details = page.locator('.sprint-readiness');
  await expect(details).toHaveAttribute('open', '');
  await expect(details.getByLabel('Check-in date', { exact: true })).toHaveValue(COACH_SATURDAY);
  expect(await coachRaw(page)).toBe(before);
});

test('a match primer still offers the optional daily check-in and Poor recommends rest without changing the match', async ({ page }) => {
  const before = await seedCoach(page);
  before.profile.masterProgram!.calendarMatches = [{ date: COACH_SUNDAY, scheduled: true }];
  await page.evaluate(state => localStorage.setItem('setline.gym.v1', JSON.stringify(state)), before);
  await page.reload();
  await coachDay(page, 'Sat');
  await expect(page.locator('.session-card h2')).toHaveText('Pre-Match Primer');
  await chooseFeeling(page, 'Poor');
  const sheet = await openCoachPreview(page);
  await expect(sheet.getByRole('heading', { name: 'Pre-Match Primer', exact: true })).toBeVisible();
  const recommendation = sheet.getByRole('region', { name: 'Executable recommendation', exact: true });
  await expect(recommendation).toContainText('Recovery');
  await expect(recommendation).toContainText('0 sets');
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  await expect(sheet.getByRole('button', { name: /Exercise details for Leg Press/ })).toHaveCount(0);
  const after = await coachRead(page);
  expect(after.profile.masterProgram.calendarMatches).toEqual([{ date: COACH_SUNDAY, scheduled: true }]);
  await expectCoachPreserved(page, before);
});
