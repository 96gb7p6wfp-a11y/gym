/** Every mutation names the session, movement and set it was created for. */
export interface SetCompletionTarget {
  sessionId: string;
  exerciseKey: string;
  setId: string;
}

export interface CompletionIntent extends SetCompletionTarget {
  intentId: string;
}

let fallbackSequence = 0;
function intentId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `set-${Date.now().toString(36)}-${++fallbackSequence}-${Math.random().toString(36).slice(2)}`;
}

function sameTarget(first: SetCompletionTarget, second: SetCompletionTarget): boolean {
  return first.sessionId === second.sessionId && first.exerciseKey === second.exerciseKey && first.setId === second.setId;
}

/**
 * A deliberate user action arms one immutable target. Claiming consumes it
 * synchronously, before React can render or a second activation can arrive.
 * Rerenders, auto-advance and elapsed time never arm the next set.
 */
export class CompletionIntentGate {
  private armed: CompletionIntent | null = null;

  constructor(target?: SetCompletionTarget) {
    if (target) this.arm(target);
  }

  arm(target: SetCompletionTarget): void {
    this.armed = { ...target, intentId: intentId() };
  }

  reset(target?: SetCompletionTarget): void {
    this.armed = null;
    if (target) this.arm(target);
  }

  isArmed(target: SetCompletionTarget): boolean {
    return this.armed != null && sameTarget(this.armed, target);
  }

  claim(target: SetCompletionTarget): CompletionIntent | null {
    if (!this.armed || !sameTarget(this.armed, target)) return null;
    const intent = this.armed;
    this.armed = null;
    return intent;
  }
}

interface CompletionSession {
  id: string;
  exercises: { key: string; logs: { id: string; done: boolean }[] }[];
}

/**
 * Pure authoritative state transition. The original reference means no change:
 * callers must not persist, start a timer or create a receipt for that result.
 * Undo changes only completion status; recorded values remain intact.
 */
export function targetSetTransition<Session extends CompletionSession>(
  session: Session, target: SetCompletionTarget, done: boolean,
  patch: Record<string, unknown> = {},
): Session {
  if (session.id !== target.sessionId) return session;
  const exercise = session.exercises.find(entry => entry.key === target.exerciseKey);
  const log = exercise?.logs.find(entry => entry.id === target.setId);
  if (!exercise || !log || log.done === done) return session;
  return {
    ...session,
    exercises: session.exercises.map(entry => entry.key !== target.exerciseKey ? entry : {
      ...entry,
      logs: entry.logs.map(set => set.id !== target.setId ? set : { ...set, ...patch, id: set.id, done }),
    }),
  } as Session;
}
