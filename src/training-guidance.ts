import type { MasterProgramSettings } from './volleyball-master-plan';

export type TrainingGuidance = NonNullable<MasterProgramSettings['clearance']>;
export interface TrainingGuidanceProfile {
  trainingGuidance?: TrainingGuidance;
  masterProgram?: MasterProgramSettings;
}

/** Legacy nested guidance stays readable; reading never writes a migration. */
export function effectiveTrainingGuidance(profile: TrainingGuidanceProfile): TrainingGuidance | undefined {
  return profile.trainingGuidance ?? profile.masterProgram?.clearance
    // V13.1 already treats absent guidance as unknown. Preserve that effective
    // status when the athlete explicitly changes programs, without introducing
    // medical settings to legacy or general-fitness installations.
    ?? (profile.masterProgram?.revision === '13.1' ? { impact: 'unknown', heavyLifting: 'unknown' } : undefined);
}

/** A program version uses the user's current guidance, not an old backup's flags. */
export function effectiveMasterProgram(profile: TrainingGuidanceProfile): MasterProgramSettings | undefined {
  if (!profile.masterProgram) return undefined;
  const guidance = effectiveTrainingGuidance(profile);
  return guidance ? { ...profile.masterProgram, clearance: { ...guidance } } : profile.masterProgram;
}
