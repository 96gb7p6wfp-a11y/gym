import type { z } from 'zod';
import { ProfileSchema } from './domain.js';
import { createVolleyballMasterPlan } from './volleyball-master-plan.ts';

type Profile = z.infer<typeof ProfileSchema>;
type Draft = NonNullable<Profile['sessionDrafts']>[number];

/** Temporary preparation belongs to its prescription; intentional day edits do not. */
function personalDrafts(drafts: Profile['sessionDrafts']): Draft[] {
  return (drafts ?? []).filter(draft => draft.customized !== false);
}

/**
 * Called only after the athlete reviews and accepts the new prescription.
 * This returns profile fields only: sessions and the rest of the store are never touched.
 */
export function upgradeMasterProgram(profile: Profile, now = Date.now()): Profile {
  const current = ProfileSchema.parse(structuredClone(profile));
  if (!current.masterProgram) throw new Error('Activate the master program before upgrading it.');
  if (current.masterProgram.revision === '8.1') return current;

  const backup: NonNullable<Profile['masterProgramBackup']> = {
    savedAt: now,
    plan: structuredClone(current.plan),
    masterProgram: structuredClone(current.masterProgram),
    ...(current.masterMatchWeekend ? { masterMatchWeekend: structuredClone(current.masterMatchWeekend) } : {}),
    ...(current.preMasterPlan ? { preMasterPlan: structuredClone(current.preMasterPlan) } : {}),
    ...(current.sessionDrafts ? { sessionDrafts: structuredClone(current.sessionDrafts) } : {}),
  };
  const { sessionDrafts: _drafts, ...remaining } = current;
  const preserved = personalDrafts(current.sessionDrafts);
  return ProfileSchema.parse({
    ...remaining,
    plan: createVolleyballMasterPlan(),
    masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    masterProgram: { ...current.masterProgram, revision: '8.1' },
    masterProgramBackup: backup,
    ...(current.sessionDrafts ? { sessionDrafts: preserved } : {}),
  });
}

/** Restore the prior weekly prescription while retaining newer deliberate day edits. */
export function restorePreviousMasterProgram(profile: Profile): Profile {
  const current = ProfileSchema.parse(structuredClone(profile));
  const backup = current.masterProgramBackup;
  if (!backup) throw new Error('There is no previous program to restore.');
  const drafts = new Map<string, Draft>();
  for (const draft of [...personalDrafts(backup.sessionDrafts), ...personalDrafts(current.sessionDrafts)]) {
    drafts.set(`${draft.date}:${draft.slot}`, draft);
  }
  const { masterProgramBackup: _backup, plan: _plan, masterProgram: _program,
    masterMatchWeekend: _weekend, preMasterPlan: _previous, sessionDrafts: _drafts, ...other } = current;
  return ProfileSchema.parse({
    ...other,
    plan: backup.plan,
    ...(backup.masterProgram ? { masterProgram: backup.masterProgram } : {}),
    ...(backup.masterMatchWeekend ? { masterMatchWeekend: backup.masterMatchWeekend } : {}),
    ...(backup.preMasterPlan ? { preMasterPlan: backup.preMasterPlan } : {}),
    ...(backup.sessionDrafts || current.sessionDrafts ? { sessionDrafts: [...drafts.values()] } : {}),
  });
}
