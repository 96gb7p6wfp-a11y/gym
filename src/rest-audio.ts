/** A short, local-only chime. No media download or network connection is needed. */
export class RestChime {
  private context: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (this.context && this.context.state !== 'closed') return this.context;
    if (typeof window === 'undefined') return null;
    const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) return null;
    try { this.context = new Constructor(); } catch { return null; }
    return this.context;
  }

  /** Call directly from a tap, before awaiting storage or other asynchronous work. */
  async unlock(): Promise<boolean> {
    const context = this.getContext();
    if (!context) return false;
    try {
      if (context.state !== 'running') await context.resume();
      if (context.state !== 'running') return false;
      // iOS needs an actual source started from the user's interaction as well.
      const source = context.createOscillator();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      source.connect(gain); gain.connect(context.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(); source.stop(context.currentTime + 0.015);
      return true;
    } catch { return false; }
  }

  async play(): Promise<boolean> {
    const context = this.context;
    // Completion is deliberately not an autoplay-unlock attempt. An interrupted
    // iOS context may require another real tap; never claim a silent alert played.
    if (!context || context.state !== 'running') return false;
    try {
      const now = context.currentTime;
      for (const [frequency, offset] of [[660, 0], [880, 0.18]]) {
        const source = context.createOscillator();
        const gain = context.createGain();
        source.type = 'sine';
        source.frequency.setValueAtTime(frequency, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.48);
        source.connect(gain); gain.connect(context.destination);
        source.onended = () => { source.disconnect(); gain.disconnect(); };
        source.start(now + offset); source.stop(now + offset + 0.5);
      }
      return true;
    } catch { return false; }
  }
}

export interface RestCompletion { audible: boolean; resumed: boolean }
interface TimerOptions {
  now: () => number;
  visible: () => boolean;
  schedule: (callback: () => void, delay: number) => unknown;
  cancel: (handle: unknown) => void;
  play: () => Promise<boolean>;
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
    // A null transition is cancellation; changing a live deadline is adjustment.
    // Completion is consumed before notifying React, so re-renders cannot repeat it.
    if (deadline !== this.deadline) { this.completed = false; this.generation += 1; }
    this.deadline = deadline;
    this.enabled = enabled;
    this.arm(false);
  }

  visibilityChanged(): void { this.arm(true); }

  private clear(): void {
    if (this.handle !== null) this.options.cancel(this.handle);
    this.handle = null;
  }

  private arm(resumed: boolean): void {
    this.clear();
    if (this.deadline === null || this.completed || !this.options.visible()) return;
    const remaining = this.deadline - this.options.now();
    if (remaining > 0) {
      this.handle = this.options.schedule(() => this.arm(false), Math.min(remaining, 2_147_483_647));
      return;
    }
    this.completed = true;
    const generation = this.generation;
    const audible = this.enabled && !resumed;
    // Consume completion synchronously. Sound is started in this task, before
    // the callback can clear the timer or a subsequent set can start another one.
    const sound = audible ? this.options.play() : Promise.resolve(false);
    void sound.then(played => {
      if (generation === this.generation && this.deadline !== null) {
        this.options.onComplete({ audible: played, resumed });
      }
    }).catch(() => {
      if (generation === this.generation && this.deadline !== null) this.options.onComplete({ audible: false, resumed });
    });
  }

  dispose(): void { this.clear(); this.generation += 1; }
}
