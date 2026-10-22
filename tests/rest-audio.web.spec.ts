import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { openDisclosure, openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';

async function setup(page: Page, instrument = true) {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-19T10:00:01Z'));
  await page.addInitScript(({ key, profile, instrument }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [],
    }));
    if (!instrument) return;
    const probe = { tones: 0, resumes: 0 };
    (window as any).__restAudioProbe = probe;
    class AudioProbe {
      state = 'suspended'; currentTime = 0; destination = {};
      async resume() { probe.resumes += 1; this.state = 'running'; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
      createOscillator() {
        let frequency = 0;
        return { type: '', frequency: { setValueAtTime(value: number) { frequency = value; } }, connect() {}, disconnect() {}, onended: null,
          start() { if (frequency > 0) probe.tones += 1; }, stop() {} };
      }
    }
    window.AudioContext = AudioProbe as unknown as typeof AudioContext;
  }, { key: STORE, profile: DEFAULT_PROFILE, instrument });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}

async function openTimer(page: Page) {
  await openSection(page, 'Train');
  await openDisclosure(page, 'Session tools');
  await openDisclosure(page, 'Rest timer');
}

async function tones(page: Page) { return page.evaluate(() => (window as any).__restAudioProbe.tones as number); }

test('plays one foreground chime at the real deadline and keeps ±15 second controls simple', async ({ page }) => {
  await setup(page);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  const rest = page.locator('.rest-floating');
  await expect(rest).toContainText('01:30');
  await rest.getByRole('button', { name: 'Add 15 seconds rest', exact: true }).click();
  await expect(rest).toContainText('01:45');
  await rest.getByRole('button', { name: 'Reduce rest by 15 seconds', exact: true }).click();
  await expect(rest).toContainText('01:30');
  await page.clock.fastForward(89_999);
  expect(await tones(page)).toBe(0);
  await page.clock.runFor(1);
  await page.clock.runFor(50);
  await expect(rest).toHaveCount(0);
  await expect(page.getByText('Rest finished', { exact: true })).toBeVisible();
  expect(await tones(page)).toBe(2); // One two-note chime; not two notifications.
  await page.clock.fastForward(30_000);
  expect(await tones(page)).toBe(2);
});

test('cancelling rest cancels its pending alert', async ({ page }) => {
  await setup(page);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.locator('.rest-floating').getByRole('button', { name: 'Skip rest', exact: true }).click();
  await page.clock.fastForward(120_000);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  expect(await tones(page)).toBe(0);
  await expect(page.getByText('Rest finished', { exact: true })).toHaveCount(0);
});

test('returning from a suspended view reflects elapsed rest without a stale alarm', async ({ page }) => {
  await setup(page);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(120_000);
  expect(await tones(page)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(50);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await expect(page.getByText('Rest finished', { exact: true })).toBeVisible();
  expect(await tones(page)).toBe(0);
});

test('sound preference persists, disabled alerts stay silent and Test sound works from a tap', async ({ page }) => {
  await setup(page);
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  const sound = settings.getByRole('switch', { name: 'Timer sounds', exact: true });
  await expect(sound).toBeChecked();
  await sound.uncheck();
  await expect.poll(async () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).profile.timerSoundEnabled, STORE)).toBe(false);
  await settings.getByRole('button', { name: 'Test sound', exact: true }).click();
  await expect(settings.getByRole('status')).toContainText('Sound played');
  expect(await tones(page)).toBe(2);
  await page.reload();
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(sound).not.toBeChecked();
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.clock.fastForward(90_000);
  await page.clock.runFor(50);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  expect(await tones(page)).toBe(0);
});

test('uses a real running AudioContext after a direct tap in a standalone iPhone viewport', async ({ page }) => {
  await setup(page, false);
  await page.evaluate(() => {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) { super(options); (window as any).__realRestContext = this; }
    };
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).tap();
  await expect.poll(async () => page.evaluate(() => (window as any).__realRestContext?.state)).toBe('running');
  const buttons = await page.locator('.rest-floating button').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height, right: rect.right };
  }));
  expect(buttons).toHaveLength(3);
  for (const button of buttons) {
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.right).toBeLessThanOrEqual(390);
  }
  await page.clock.fastForward(90_000);
  await page.clock.runFor(50);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await expect(page.getByText('Rest finished', { exact: true })).toBeVisible();
});
