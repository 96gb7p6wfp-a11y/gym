export type ReactionDirection = 'Left' | 'Right';
interface ReactionCueClock {
  schedule: (callback: () => void, milliseconds: number) => unknown;
  cancel: (timer: unknown) => void;
}

/** A bounded practice aid. It measures nothing and owns no workout records. */
export class ReactionCueSequence {
  private pending: unknown = null;
  private generation = 0;
  private active = false;
  private count = 0;
  private readonly clock: ReactionCueClock;
  private readonly onCue: (direction: ReactionDirection, count: number) => void;
  private readonly onFinish: () => void;
  private readonly random: () => number;

  constructor(clock: ReactionCueClock,
    onCue: (direction: ReactionDirection, count: number) => void,
    onFinish: () => void,
    random: () => number = Math.random) {
    this.clock = clock; this.onCue = onCue; this.onFinish = onFinish; this.random = random;
  }

  start(): boolean {
    if (this.active) return false;
    this.active = true;
    this.count = 0;
    this.generation += 1;
    this.next(this.generation);
    return true;
  }

  stop(): boolean {
    const wasActive = this.active;
    this.active = false;
    this.generation += 1;
    if (this.pending !== null) this.clock.cancel(this.pending);
    this.pending = null;
    return wasActive;
  }

  private sample(): number {
    const value = this.random();
    return Number.isFinite(value) && value >= 0 && value < 1 ? value : .5;
  }

  private next(generation: number): void {
    if (!this.active || this.generation !== generation) return;
    const delay = 2000 + Math.floor(this.sample() * 2000);
    this.pending = this.clock.schedule(() => {
      if (!this.active || this.generation !== generation) return;
      this.pending = null;
      this.count += 1;
      this.onCue(this.sample() < .5 ? 'Left' : 'Right', this.count);
      if (!this.active || this.generation !== generation) return;
      if (this.count === 4) {
        this.active = false;
        this.onFinish();
      } else this.next(generation);
    }, delay);
  }
}
