/** A short optional primer is training load, but not another gym-day obligation. */
export function isGymTraining(session: { kind: string; name: string; programRevision?: string; programSessionId?: string } | undefined): boolean {
  return session?.kind === 'strength'
    && !(session.programRevision === '9' && ['v9-match-primer', 'v9-approach-technique'].includes(session.programSessionId ?? ''))
    && !(['8.1', '13.1'].includes(session.programRevision ?? '') && /primer|technique|pre-match preparation/i.test(session.name));
}
