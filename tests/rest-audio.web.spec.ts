import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { openDisclosure, openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';

/** Probes the actual application's playback path; it cannot hear a phone speaker. */
async function setup(page: Page, instrument = true) {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-19T10:00:01Z'));
  await page.addInitScript(({ key, profile, instrument }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [],
    }));
    if (!instrument) return;
    const probe = { plays: 0, resumes: 0, contexts: [] as any[], gains: [] as number[], peaks: [] as number[], resumeMode: 'normal' };
    (window as any).__restAudioProbe = probe;
    Object.defineProperty(navigator, 'audioSession', { configurable: true, value: { type: 'auto' } });
    class AudioProbe extends EventTarget {
      private currentState = 'suspended';
      private startedAt = Date.now();
      destination = {};
      sampleRate = 48_000;
      constructor() { super(); probe.contexts.push(this); }
      get state() { return this.currentState; }
      set state(value: string) { this.currentState = value; this.startedAt = Date.now(); this.dispatchEvent(new Event('statechange')); }
      get currentTime() { return this.state === 'running' ? (Date.now() - this.startedAt) / 1000 : 0; }
      async resume() {
        probe.resumes += 1;
        if (probe.resumeMode === 'reject') throw new DOMException('Playback needs another tap.', 'NotAllowedError');
        if (probe.resumeMode === 'hang') return new Promise<void>(() => {});
        this.state = 'running';
      }
      async close() { this.state = 'closed'; }
      createBuffer(channels: number, length: number, rate: number) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return { length, sampleRate: rate, duration: length / rate, numberOfChannels: channels,
          getChannelData: (channel: number) => data[channel], copyToChannel: (samples: Float32Array, channel: number) => data[channel].set(samples) };
      }
      createGain() {
        const gain = { value: 1, setValueAtTime(value: number) { this.value = value; },
          exponentialRampToValueAtTime(value: number) { this.value = value; },
          linearRampToValueAtTime(value: number) { this.value = value; }, setTargetAtTime(value: number) { this.value = value; }, cancelScheduledValues() {} };
        return { gain, connect() {}, disconnect() {} };
      }
      createBufferSource() {
        let destination: any;
        const source = { buffer: null as any, onended: null as null | (() => void),
          connect(node: any) { destination = node; }, disconnect() {},
          start() {
            if (!source.buffer || source.buffer.duration < 0.1) return;
            const data = source.buffer.getChannelData(0) as Float32Array;
            let peak = 0;
            for (const sample of data) peak = Math.max(peak, Math.abs(sample));
            if (peak > 0) { probe.plays += 1; probe.peaks.push(peak); probe.gains.push(destination?.gain?.value ?? 1); }
          }, stop() {} };
        return source;
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
async function openSoundSettings(page: Page) {
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog', { name: 'Your preferences', exact: true });
}
async function plays(page: Page) { return page.evaluate(() => (window as any).__restAudioProbe.plays as number); }
async function finishRest(page: Page, milliseconds = 90_000) {
  await page.clock.fastForward(milliseconds);
  await page.clock.runFor(1200);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
}

test('plays one foreground double-beep at the deadline and keeps ±15 second controls accurate', async ({ page }) => {
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
  expect(await plays(page)).toBe(0);
  await finishRest(page, 1);
  await expect(page.getByRole('status', { name: 'Rest complete', exact: true })).toBeVisible();
  expect(await plays(page)).toBe(1);
  expect(await page.evaluate(() => (window as any).__restAudioProbe.peaks[0])).toBeGreaterThan(0.1);
  await page.clock.fastForward(30_000);
  expect(await plays(page)).toBe(1);
});

for (const state of ['interrupted', 'suspended']) {
  test(`recovers a ${state} foreground audio context at the deadline instead of silently giving up`, async ({ page }) => {
    await setup(page);
    await openTimer(page);
    await page.getByRole('button', { name: 'Start rest', exact: true }).click();
    await page.evaluate(value => { (window as any).__restAudioProbe.contexts.at(-1).state = value; }, state);
    await finishRest(page);
    expect(await plays(page)).toBe(1);
    expect(await page.evaluate(() => (window as any).__restAudioProbe.resumes)).toBeGreaterThanOrEqual(2);
    expect(['transient', 'playback']).toContain(await page.evaluate(() => (navigator as any).audioSession.type));
  });
}

test('repeated timers survive navigation without recreating the audio system or repeating an old alert', async ({ page }) => {
  await setup(page);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await openSection(page, 'Progress');
  await finishRest(page);
  expect(await plays(page)).toBe(1);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await openSection(page, 'Today');
  await finishRest(page);
  expect(await plays(page)).toBe(2);
  await page.clock.fastForward(120_000);
  expect(await plays(page)).toBe(2);
  expect(await page.evaluate(() => (window as any).__restAudioProbe.contexts.length)).toBe(1);
});

test('cancelling rest cancels its pending alert, including an interrupted context', async ({ page }) => {
  await setup(page);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.evaluate(() => { (window as any).__restAudioProbe.contexts.at(-1).state = 'interrupted'; });
  await page.locator('.rest-floating').getByRole('button', { name: 'Skip rest', exact: true }).click();
  await page.clock.fastForward(120_000);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  expect(await plays(page)).toBe(0);
  await expect(page.getByRole('status', { name: 'Rest complete', exact: true })).toHaveCount(0);
});

test('returning after background suspension reflects elapsed rest without a stale alarm', async ({ page }) => {
  await setup(page);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(120_000);
  expect(await plays(page)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(1200);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Rest complete', exact: true })).toBeVisible();
  expect(await plays(page)).toBe(0);
});

test('sound and volume preferences persist while Test sound uses the same actual alert path', async ({ page }) => {
  await setup(page);
  const settings = await openSoundSettings(page);
  const sound = settings.getByRole('switch', { name: 'Timer sounds', exact: true });
  const volume = settings.getByRole('slider', { name: 'Timer volume', exact: true });
  await expect(sound).toBeChecked();
  await volume.fill('0.35');
  await volume.blur();
  await expect.poll(async () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).profile.timerSoundVolume, STORE)).toBe(0.35);
  await settings.getByRole('button', { name: 'Test sound', exact: true }).click();
  await page.clock.runFor(1200);
  await expect(settings).toContainText('Did you hear both beeps?');
  await expect(settings).not.toContainText('Sound played.');
  expect(await plays(page)).toBe(1);
  expect(await page.evaluate(() => (window as any).__restAudioProbe.gains.at(-1))).toBeCloseTo(0.35);
  await settings.getByRole('button', { name: 'Heard it', exact: true }).click();
  await expect(settings).toContainText(/confirmed|ready|set/i);
  await sound.uncheck();
  await expect.poll(async () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).profile.timerSoundEnabled, STORE)).toBe(false);
  await page.reload();
  await openSoundSettings(page);
  await expect(sound).not.toBeChecked();
  await expect(volume).toHaveValue('0.35');
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await finishRest(page);
  expect(await plays(page)).toBe(0);
});

test('a denied resume completes the timer and exposes useful sound recovery without claiming audibility', async ({ page }) => {
  await setup(page);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.evaluate(() => {
    (window as any).__restAudioProbe.resumeMode = 'reject';
    (window as any).__restAudioProbe.contexts.at(-1).state = 'interrupted';
  });
  await finishRest(page);
  expect(await plays(page)).toBe(0);
  await page.getByRole('button', { name: 'Check sound', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  await expect(settings).toContainText(/tap|blocked|interrupted|resume/i);
  await settings.getByRole('button', { name: 'Test sound', exact: true }).click();
  await page.clock.runFor(1200);
  await expect(settings).not.toContainText('Sound played.');
  await expect(settings).toContainText(/volume|Silent|Bluetooth/i);
});

test('an unresponsive browser resume cannot leave rest stuck at zero or play a late alert', async ({ page }) => {
  await setup(page);
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.evaluate(() => {
    (window as any).__restAudioProbe.resumeMode = 'hang';
    (window as any).__restAudioProbe.contexts.at(-1).state = 'suspended';
  });
  await finishRest(page);
  expect(await plays(page)).toBe(0);
  await expect(page.getByRole('button', { name: 'Check sound', exact: true })).toBeVisible();
  await page.clock.fastForward(120_000);
  expect(await plays(page)).toBe(0);
  await page.getByRole('button', { name: 'Check sound', exact: true }).click();
  await page.evaluate(() => { (window as any).__restAudioProbe.resumeMode = 'normal'; });
  const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  await settings.getByRole('button', { name: 'Test sound', exact: true }).click();
  await page.clock.runFor(1200);
  expect(await plays(page)).toBe(1);
  await expect(settings).toContainText('Did you hear both beeps?');
});

test('No sound reveals practical iPhone diagnostics even when the browser accepted playback', async ({ page }) => {
  await setup(page);
  const settings = await openSoundSettings(page);
  await settings.getByRole('button', { name: 'Test sound', exact: true }).click();
  await page.clock.runFor(1200);
  expect(await plays(page)).toBe(1);
  await settings.getByRole('button', { name: 'No sound', exact: true }).click();
  await expect(settings).toContainText(/media volume|iPhone volume/i);
  await expect(settings).toContainText(/Bluetooth|AirPlay/i);
  await expect(settings).toContainText(/Silent mode|silent switch/i);
  await expect(settings).toContainText(/background|locked/i);
});

test('a real foreground AudioContext renders nonzero alert samples in standalone iPhone layout', async ({ page }) => {
  await setup(page, false);
  await page.evaluate(() => {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) { super(options); (window as any).__realRestContext = this; }
      createGain() {
        const node = super.createGain();
        const originalConnect = node.connect.bind(node);
        node.connect = ((destination: AudioNode | AudioParam, output?: number, input?: number) => {
          if (destination === this.destination) {
            const analyser = this.createAnalyser();
            analyser.fftSize = 512;
            (window as any).__restSignalAnalyser = analyser;
            originalConnect(analyser);
            analyser.connect(this.destination);
            return analyser;
          }
          return originalConnect(destination as AudioNode, output, input);
        }) as typeof node.connect;
        return node;
      }
    };
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
  const settings = await openSoundSettings(page);
  await settings.getByRole('button', { name: 'Test sound', exact: true }).tap();
  await expect.poll(async () => page.evaluate(() => (window as any).__realRestContext?.state)).toBe('running');
  // Samples demonstrate that the real production playback graph rendered an
  // alert. Hardware volume, mute and routing still require a physical iPhone.
  await expect.poll(async () => page.evaluate(() => {
    const analyser = (window as any).__restSignalAnalyser as AnalyserNode | undefined;
    if (!analyser) return 0;
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    return Math.max(...samples.map(Math.abs));
  }), { intervals: [25, 50, 75, 100], timeout: 4000 }).toBeGreaterThan(0.001);
  await page.clock.runFor(1200);
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await openTimer(page);
  await page.getByRole('button', { name: 'Start rest', exact: true }).tap();
  const buttons = await page.locator('.rest-floating button').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height, right: rect.right };
  }));
  expect(buttons).toHaveLength(3);
  for (const button of buttons) {
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.right).toBeLessThanOrEqual(390);
  }
  await finishRest(page);
  await expect(page.getByRole('status', { name: 'Rest complete', exact: true })).toBeVisible();
});
