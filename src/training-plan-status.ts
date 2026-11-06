import { DEFAULT_PROFILE, ProfileSchema } from './domain.js';
import { getMasterProgramPhase, getMasterProgramWeek, type MasterProgramSettings } from './volleyball-master-plan.ts';
import { effectiveTrainingGuidance } from './training-guidance.ts';
import type { z } from 'zod';

type Profile = z.infer<typeof ProfileSchema>;
type StatusProfile = Pick<Profile, 'plan' | 'masterProgram' | 'masterProgramBackup' | 'trainingGuidance'>;
const originalPlan = JSON.stringify(ProfileSchema.parse(DEFAULT_PROFILE).plan);

/** A saved program revision is independent of the installed app version. */
export function trainingPlanVersion(settings?: MasterProgramSettings): string {
  return settings?.revision ? `V${settings.revision}` : settings ? 'Original master plan' : 'Saved weekly plan';
}

export function trainingBlockStatus(settings: MasterProgramSettings, date: string): string {
  if (settings.revision === '9') return 'Weekly training · readiness-led';
  if (date < settings.startDate) return `Upcoming · starts ${settings.startDate}`;
  const week = getMasterProgramWeek(settings.startDate, date);
  return week ? `Week ${week} of 8 · ${getMasterProgramPhase(week)}` : 'Block complete · saved weekly plan continues';
}

export function getTrainingPlanStatus(profile: StatusProfile, today: string, selectedDate = today) {
  const settings = profile.masterProgram;
  const guidance = effectiveTrainingGuidance(profile);
  const guidanceLabel = (value: 'unknown' | 'cleared' | 'restricted') => value === 'cleared' ? 'reported cleared'
    : value === 'restricted' ? 'restricted' : 'unconfirmed';
  const planVersion = settings ? trainingPlanVersion(settings)
    : JSON.stringify(ProfileSchema.shape.plan.parse(profile.plan)) === originalPlan ? 'Original weekly plan' : 'Custom weekly plan';
  return {
    appVersion: 'Setline V18',
    planVersion,
    cycle: settings ? trainingBlockStatus(settings, today) : 'No eight-week block active',
    selected: selectedDate !== today
      ? `${selectedDate} preview · ${settings ? trainingBlockStatus(settings, selectedDate) : 'saved weekly plan'}` : null,
    previous: profile.masterProgramBackup ? trainingPlanVersion(profile.masterProgramBackup.masterProgram) : null,
    guidance: guidance ? `Lifting ${guidanceLabel(guidance.heavyLifting)} · Impact ${guidanceLabel(guidance.impact)}` : null,
  };
}
