/** A short optional primer is training load, but not another gym-day obligation. */
export function isGymTraining(session: { kind: string; name: string; programRevision?: string } | undefined): boolean {
  return session?.kind === 'strength'
    && !(session.programRevision === '8.1' && /primer|technique/i.test(session.name));
}
