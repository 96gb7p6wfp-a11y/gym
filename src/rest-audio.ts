/** Local PCM audio: no download, media-element volume, or decoding dependency. */
export interface AudioDiagnostics {
  phase: 'idle' | 'ready' | 'playing' | 'blocked' | 'unavailable';
  contextState: string;
  sessionType: string;
  reason: string | null;
}

/** Two clear, rounded beeps, with smooth attack/release and a useful gym-frequency harmonic. */
export function createRestChimeSamples(sampleRate = 48_000): Float32Array {
  const rate = Math.max(8_000, Math.min(192_000, sampleRate));
  const samples = new Float32Array(Math.ceil(rate * 0.72));
  for (const [offset, frequency] of [[0.02, 880], [0.37, 1046.5]]) {
    const length = 0.25;
    for (let i = Math.floor(offset * rate); i < Math.min(samples.length, Math.ceil((offset + length) * rate)); i++) {
      const t = i / rate - offset;
      const attack = Math.min(1, Math.max(0, t / 0.012));
      const release = Math.min(1, Math.max(0, (length - t) / 0.075));
      const wave = Math.sin(2 * Math.PI * frequency * t) + 0.18 * Math.sin(4 * Math.PI * frequency * t);
      samples[i] = wave * 0.64 * attack * release;
    }
  }
  return samples;
}

const bounded = async (promise: Promise<unknown>, milliseconds = 750): Promise<boolean> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise.then(() => true, () => false), new Promise<boolean>(resolve => { timeout = setTimeout(() => resolve(false), milliseconds); })]); }
  finally { if (timeout !== undefined) clearTimeout(timeout); }
};

type AudioSessionPort = { type: string };
export class RestChime {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private volume = 0.85;
  private unlocked = false;
  private listeners = new Set<() => void>();
  private snapshot: AudioDiagnostics = { phase: 'idle', contextState: 'not initialized', sessionType: 'automatic', reason: null };
  private session: AudioSessionPort | null = null;
  private previousSessionType: string | null = null;
  private active = new Set<AudioBufferSourceNode>();

  getSnapshot = (): AudioDiagnostics => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  setVolume(value: number): void { this.volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.85; }
  private report(phase: AudioDiagnostics['phase'], reason: string | null = null): void {
    const next = { phase, reason, contextState: this.context ? String(this.context.state) : 'not initialized', sessionType: this.session?.type ?? 'automatic' };
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next; this.listeners.forEach(listener => listener());
  }
  private requestSession(): void {
    if (typeof navigator === 'undefined') return;
    let session: AudioSessionPort | undefined;
    try { session = (navigator as unknown as { audioSession?: AudioSessionPort }).audioSession; } catch { return; }
    if (!session) return;
    this.session = session;
    try {
      if (this.previousSessionType === null) this.previousSessionType = session.type;
      // Prefer a notification session that can duck music, rather than pausing
      // another player's playback for every rest. Older implementations may
      // only offer playback; this hint is restored when the short alert ends.
      for (const type of ['transient', 'playback']) {
        try { session.type = type; if (session.type === type) break; } catch { /* Try the older supported category. */ }
      }
    } catch { /* A platform routing hint cannot be required for the timer to work. */ }
  }
  private releaseSession(): void {
    if (!this.session || this.previousSessionType === null || this.active.size) return;
    try { this.session.type = this.previousSessionType; } catch { /* Optional routing support. */ }
    this.previousSessionType = null;
  }
  private getContext(): AudioContext | null {
    if (this.context && this.context.state !== 'closed') return this.context;
    if (typeof window === 'undefined') return null;
    const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) { this.report('unavailable', 'Web Audio is unavailable in this browser.'); return null; }
    try {
      this.context = new Constructor({ latencyHint: 'interactive' }); this.buffer = null;
      const observedContext = this.context;
      this.context.addEventListener?.('statechange', () => {
        if (this.context !== observedContext) return;
        if (this.context.state === 'running') { this.report(this.active.size ? 'playing' : 'ready'); return; }
        this.report('blocked', `Audio is ${String(this.context.state)}. Tap Test sound to reconnect it.`);
      });
    } catch { this.report('unavailable', 'The browser could not create an audio output.'); return null; }
    return this.context;
  }
  private prime(context: AudioContext): void {
    // Start an actual source synchronously INSIDE the gesture, before awaiting resume().
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate || 48_000);
    source.connect(context.destination);
    source.onended = () => source.disconnect();
    source.start(0);
  }
  private async ready(gesture: boolean, forPlayback = false): Promise<AudioContext | null> {
    if (gesture) this.unlocked = true;
    if (!this.unlocked) { this.report('blocked', 'Tap Start rest or Test sound to enable audio.'); return null; }
    const context = this.getContext();
    if (!context) return null;
    if (forPlayback) this.requestSession();
    try {
      // Calling resume() outside a fresh gesture is permitted after a previous unlock
      // on supported browsers. Safari may still refuse; a bounded failure stays visible.
      const resumed = context.state === 'running' ? null : context.resume();
      if (gesture) this.prime(context);
      if (resumed && !(await bounded(resumed))) {
        this.report('blocked', 'Audio did not resume. Keep Setline open and tap Test sound.'); this.releaseSession(); return null;
      }
      if (context.state !== 'running') {
        this.report('blocked', `Audio is ${String(context.state)}. Tap Test sound to reconnect it.`); this.releaseSession(); return null;
      }
      this.report('ready'); return context;
    } catch {
      this.report('blocked', 'The browser blocked audio. Tap Test sound while Setline is active.'); this.releaseSession(); return null;
    }
  }
  /** Must be called synchronously from a real tap. It does not play the alert. */
  async unlock(): Promise<boolean> {
    const ready = Boolean(await this.ready(true));
    this.releaseSession(); return ready;
  }
  async recover(): Promise<boolean> { if (!this.unlocked) return false; const ready = Boolean(await this.ready(false)); this.releaseSession(); return ready; }

  /** A true result means a nonzero audio graph started, never proof a speaker was heard. */
  async play(options: { gesture?: boolean; volume?: number; shouldPlay?: () => boolean } = {}): Promise<boolean> {
    const volume = options.volume === undefined ? this.volume : Math.min(1, Math.max(0, options.volume));
    if (!Number.isFinite(volume) || volume <= 0) { this.report('blocked', 'Timer volume is zero. Raise it before testing.'); return false; }
    if (options.shouldPlay && !options.shouldPlay()) return false;
    const context = await this.ready(options.gesture === true, true);
    if (!context) return false;
    // Cancellation/navigation/background can happen while resume is pending.
    if (options.shouldPlay && !options.shouldPlay()) { this.releaseSession(); return false; }
    let source: AudioBufferSourceNode | null = null;
    let gain: GainNode | null = null;
    try {
      if (!this.buffer) {
        const samples = createRestChimeSamples(context.sampleRate || 48_000);
        this.buffer = context.createBuffer(1, samples.length, context.sampleRate || 48_000);
        this.buffer.getChannelData(0).set(samples);
      }
      source = context.createBufferSource(); gain = context.createGain();
      const playingSource = source; const playingGain = gain;
      source.buffer = this.buffer; gain.gain.setValueAtTime(volume, context.currentTime);
      source.connect(gain); gain.connect(context.destination); this.active.add(source);
      source.onended = () => { this.active.delete(playingSource); playingSource.disconnect(); playingGain.disconnect(); this.releaseSession(); this.report(this.context?.state === 'running' ? 'ready' : 'blocked'); };
      source.start(context.currentTime); this.report('playing'); return true;
    } catch {
      if (source) { this.active.delete(source); try { source.disconnect(); } catch { /* Partial graph. */ } }
      try { gain?.disconnect(); } catch { /* Partial graph. */ }
      this.report('blocked', 'Audio could not start. Tap Test sound to reconnect it.'); this.releaseSession(); return false;
    }
  }
}

/** audible is retained for saved UI compatibility: it means graph started, not heard. */
export interface RestCompletion { audible: boolean; resumed: boolean }
interface TimerOptions {
  now: () => number;
  visible: () => boolean;
  schedule: (callback: () => void, delay: number) => unknown;
  cancel: (handle: unknown) => void;
  play: (shouldPlay?: () => boolean) => Promise<boolean>;
  onComplete: (result: RestCompletion) => void;
}

/** The deadline, not a decrementing interval, is the source of truth. */
export class RestAlertTimer {
  private options: TimerOptions;
  private deadline: number | null = null;
  private handle: unknown = null;
  private enabled = true;
  private completed = false;
  private generation = 0;
  constructor(options: TimerOptions) { this.options = options; }
  update(deadline: number | null, enabled: boolean): void {
    if (deadline === this.deadline && enabled === this.enabled) return;
    if (deadline !== this.deadline) { this.completed = false; this.generation += 1; }
    this.deadline = deadline; this.enabled = enabled; this.arm(false);
  }
  visibilityChanged(): void { this.arm(true); }
  private clear(): void { if (this.handle !== null) this.options.cancel(this.handle); this.handle = null; }
  private arm(resumed: boolean): void {
    this.clear();
    if (this.deadline === null || this.completed || !this.options.visible()) return;
    const remaining = this.deadline - this.options.now();
    if (remaining > 0) { this.handle = this.options.schedule(() => this.arm(false), Math.min(remaining, 2_147_483_647)); return; }
    this.completed = true;
    const generation = this.generation;
    const current = () => generation === this.generation && this.deadline !== null && this.enabled && this.options.visible();
    const sound = this.enabled && !resumed ? this.options.play(current) : Promise.resolve(false);
    void sound.then(played => {
      if (generation === this.generation && this.deadline !== null) this.options.onComplete({ audible: played, resumed });
    }).catch(() => {
      if (generation === this.generation && this.deadline !== null) this.options.onComplete({ audible: false, resumed });
    });
  }
  dispose(): void { this.clear(); this.deadline = null; this.generation += 1; }
}
