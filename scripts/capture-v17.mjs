import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PROFILE, SessionSchema, createSession } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders.ts';

// Compare the V16 baseline and V17 build with the same isolated local fixtures.
// This script never starts a server, builds the app or accesses production.
const stage = process.argv[2];
if (!['before', 'after'].includes(stage) || process.argv.length !== 3) {
  console.error('Usage: node --experimental-strip-types scripts/capture-v17.mjs <before|after>');
  process.exit(1);
}

const origin = 'http://127.0.0.1:4173';
const output = fileURLToPath(new URL(`../artifacts/v17/${stage}/`, import.meta.url));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ executablePath });

async function openFixture(profile = DEFAULT_PROFILE, sessions = []) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(({ profile, sessions, reminders, origin }) => {
    // Restrict test-only storage writes to the one hardcoded local origin.
    if (location.origin !== origin || localStorage.getItem('setline.gym.v1')) return;
    localStorage.setItem('setline.gym.v1', JSON.stringify({
      schemaVersion: 1,
      profile,
      profileVersion: 1,
      sessions: sessions.map(session => ({ session, version: 1 })),
      nutrition: [],
      activities: [],
      reminders,
    }));
  }, { profile, sessions, reminders: defaultReminderState(), origin });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-11-02T10:00:00Z') });
  await page.goto(origin);
  await page.getByRole('region', { name: 'Your day', exact: true }).waitFor();
  return { page, context };
}

async function capture(page, filename) {
  // Match the original before/after capture conditions; do not alter app styles.
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, `${filename}.png`) });
}

try {
  let { page, context } = await openFixture();
  await capture(page, 'today');

  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await preview.waitFor();
  await capture(page, 'preview');
  await preview.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Strength', exact: true }).click();
  await capture(page, 'strength-empty');
  if (stage === 'before') {
    await page.getByRole('button', { name: 'Log weight', exact: true }).click();
    await page.getByRole('heading', { name: 'Nutrition', exact: true }).waitFor();
    await capture(page, 'strength-incorrect-destination');
    await page.getByRole('dialog', { name: 'Weight check-in', exact: true })
      .getByRole('button', { name: 'Close', exact: true }).click();
  }

  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await warmup.waitFor();
  await capture(page, 'warmup');
  await warmup.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('region', { name: 'Current exercise', exact: true }).waitFor();
  await capture(page, 'focus');

  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Your preferences', exact: true }).waitFor();
  await capture(page, 'settings');
  await context.close();

  const profile = structuredClone(DEFAULT_PROFILE);
  profile.plan[0] = {
    ...profile.plan[0],
    name: 'Mixed exercise logging',
    warmup: [],
    cooldown: [],
    exercises: [
      { key: 'qa-deadbug', exerciseId: 'dead-bug', name: 'Dead Bug', group: 'Core',
        sets: 2, target: '8 reps', mode: 'bodyweight', perSide: true, rest: 60 },
      { key: 'qa-plank', exerciseId: 'plank', name: 'Plank', group: 'Core',
        sets: 2, target: '30 sec', mode: 'timed', perSide: false, rest: 60 },
      { ...profile.plan[0].exercises[0], sets: 2 },
    ],
  };
  const active = SessionSchema.parse(createSession(profile.plan[0], 0, '2026-11-02', profile, []));
  active.runningSince = null;
  ({ page, context } = await openFixture(profile, [active]));
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  await capture(page, 'quick-log');
  await context.close();

  await writeFile(path.join(output, 'README.txt'),
    'Isolated localhost QA fixtures; no real user installation or records accessed.\n');
  console.log(output);
} finally {
  await browser.close();
}
