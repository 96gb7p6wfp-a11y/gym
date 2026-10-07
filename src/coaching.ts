import type { ExtraActivity } from './activities';

export interface DailyGuidanceInput {
  date: string;
  bodyWeightKg: number;
  plannedKind: string;
  plannedName: string;
  extraActivities: ExtraActivity[];
  completedTrainingMinutes: number;
  plannedTrainingMinutes?: number;
}

export interface DailyGuidance {
  training: string[];
  nutrition: string[];
  sources: { label: string; url: string }[];
}

/** Two short, practical reminders shown before opening a training log. */
export function getShortRoutine(input: DailyGuidanceInput): { before: string; after: string } {
  const activities = input.extraActivities.filter(activity => activity.date === input.date && activity.deletedAt === null);
  const recovery = input.plannedKind === 'recovery' || /\brecovery\b/i.test(input.plannedName);
  const trainingToday = !recovery || input.completedTrainingMinutes > 0 || activities.some(activity => activity.durationMinutes >= 30 || activity.intensity === 'hard');
  if (!trainingToday) return {
    before: 'Keep regular balanced meals and drink to thirst. No special workout snack is needed today.',
    after: 'Optional easy walking or gentle mobility. Keep meals regular and aim for 7–9 hours of sleep.',
  };
  const longEndurance = activities.some(activity => ['run', 'cycle', 'swim'].includes(activity.type) && activity.durationMinutes > 60 && activity.intensity === 'hard');
  return {
    before: longEndurance
      ? '1–3 h before: oats or toast + yogurt. Bring water; for a hard session over 60 min, practice 30–60 g carbs/hour.'
      : '1–3 h before: oats or toast + yogurt or eggs. If starting soon, a banana is a light option. Drink to thirst.',
    after: 'Cool down gently for 5 min. Next meal: rice or potatoes + fish, tofu or eggs; aim for 20–40 g protein. Rehydrate and prioritize sleep.',
  };
}

const SOURCES = [
  {
    label: 'ISSN position stand: protein and exercise (2017)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/',
  },
  {
    label: 'ACSM: Nutrition and Athletic Performance (2016)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26920240/',
  },
  {
    label: 'CDC: exercise intensity and the talk test',
    url: 'https://www.cdc.gov/physical-activity-basics/measuring/index.html',
  },
  {
    label: 'Concurrent strength and aerobic training: systematic review (2022)',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8891239/',
  },
] satisfies DailyGuidance['sources'];

function dailyRange(weight: number, low: number, high: number): string | null {
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return `${Math.round(weight * low)}–${Math.round(weight * high)}`;
}

/**
 * General guidance for an adult training regularly, not a medical assessment or
 * an individualized prescription. Only this date's non-deleted logs count.
 * These suggestions never modify saved food, calorie or macro targets.
 */
export function getDailyGuidance(input: DailyGuidanceInput): DailyGuidance {
  const activities = input.extraActivities.filter(
    (activity) => activity.date === input.date && activity.deletedAt === null,
  );
  const extraMinutes = activities.reduce((sum, activity) => sum + activity.durationMinutes, 0);
  const completedMinutes = Number.isFinite(input.completedTrainingMinutes)
    ? Math.max(0, input.completedTrainingMinutes)
    : 0;
  const totalMinutes = completedMinutes + extraMinutes;
  const hasHardCardio = activities.some(
    (activity) => activity.intensity === 'hard' && ['run', 'cycle'].includes(activity.type),
  );
  const hasLongHardEndurance = activities.some(
    (activity) => activity.intensity === 'hard' && activity.durationMinutes > 60
      && ['run', 'cycle', 'swim'].includes(activity.type),
  );
  const isRecovery = input.plannedKind === 'recovery' || /\brecovery\b/i.test(input.plannedName);
  const isVolleyball = /volleyball/i.test(input.plannedName);
  const isLowerOrJump = /\blower\b|\bjump\b|\bsquat\b|\bdeadlift\b/i.test(input.plannedName);
  const plannedMinutes = typeof input.plannedTrainingMinutes === 'number'
    && Number.isFinite(input.plannedTrainingMinutes)
    ? Math.max(0, input.plannedTrainingMinutes)
    : 0;
  // Planned and recorded workout time describe the same session, so never add
  // them together. Recovery templates do not create an assumed training load.
  const fuelMinutes = (isRecovery ? completedMinutes : Math.max(completedMinutes, plannedMinutes))
    + extraMinutes;
  const includesPlannedTraining = !isRecovery && plannedMinutes > completedMinutes;

  let scheduleAdvice: string;
  if (isRecovery) {
    scheduleAdvice = hasHardCardio
      ? 'A hard run or ride adds training load to a recovery day. Keep the rest of today restful and avoid more intervals, heavy leg work or jumps.'
      : 'Preserve your recovery day. Rest is useful; an optional 20–30-minute easy walk or gentle mobility is enough, especially before the next jump session.';
  } else if (isLowerOrJump) {
    scheduleAdvice = hasHardCardio
      ? 'A hard run or ride competes with today’s lower-body or jump work. Avoid stacking hard cardio with heavy leg training; schedule it on a separate day when recovered, and reduce load if jump quality falls.'
      : 'Protect today’s lower-body or jump quality. Keep extra cardio easy; avoid a hard 5 km run, hills or intervals around heavy leg work. A short easy walk or ride is a gentler option.';
  } else if (isVolleyball) {
    scheduleAdvice = 'Volleyball already loads your legs. If adding cardio, prefer 20–30 minutes of easy cycling or walking, leave several hours between sessions when possible, and avoid another hard leg session.';
  } else {
    scheduleAdvice = 'On a well-recovered day, optional easy cardio for 20–40 minutes can fit alongside your plan. Keep hard running or cycling away from demanding lower-body and jump sessions.';
  }

  let loadAdvice: string;
  if (totalMinutes >= 90) {
    loadAdvice = `You have logged ${Math.round(totalMinutes)} minutes of combined activity today. Skip another hard session; prioritize recovery and sleep, and lighten the next session if fatigue carries over.`;
  } else if (isRecovery && activities.length === 0 && completedMinutes === 0) {
    loadAdvice = 'You do not need to add an activity today. Keeping a genuine rest day supports the next training session.';
  } else if (extraMinutes > 0) {
    loadAdvice = `Your extra ${Math.round(extraMinutes)} minutes count toward today’s training load. Increase time or distance gradually; avoid increasing both distance and intensity together.`;
  } else {
    loadAdvice = 'Extra cardio is optional. Add it only when you feel recovered, and build time or distance gradually instead of adding both volume and intensity at once.';
  }

  const proteinRange = dailyRange(input.bodyWeightKg, 1.4, 2);
  const proteinAdvice = `Protein: ${proteinRange ? `about ${proteinRange} g/day (1.4–2.0 g/kg)` : 'about 1.4–2.0 g/kg/day'}, spread across meals. After training, a meal or snack with 20–40 g protein from foods such as yogurt, eggs, beans or tofu is practical.`;
  const moderateWorkload = fuelMinutes >= 60;
  const carbohydrateRange = dailyRange(input.bodyWeightKg, moderateWorkload ? 5 : 3, moderateWorkload ? 7 : 5);
  const perKg = moderateWorkload ? '5–7' : '3–5';
  const workload = moderateWorkload
    ? `a ${includesPlannedTraining ? 'planned ' : ''}day with around an hour or more of training`
    : `a lighter ${includesPlannedTraining ? 'planned ' : ''}day`;
  const carbohydrateAdvice = `Carbs: ${carbohydrateRange ? `${carbohydrateRange} g/day (${perKg} g/kg)` : `${perKg} g/kg/day`} is a broad starting range for ${workload}. ${totalMinutes >= 90 ? 'With this combined load, prioritize a carbohydrate-rich recovery meal. ' : ''}Adjust to workload, appetite and goals; saved targets stay unchanged.`;
  const hydrationAdvice = hasLongHardEndurance
    ? 'For a hard endurance session over 60 minutes, practice taking 30–60 g carbohydrate/hour, using foods or a sports drink you tolerate. Drink to thirst; plan extra fluid and breaks in heat.'
    : 'Sessions up to 60 minutes usually need no gels. Drink to thirst; in heat, bring extra fluid and take breaks. A normal meal or snack afterward is usually enough.';

  return {
    training: [
      scheduleAdvice,
      loadAdvice,
      'Easy pace means you can speak in full sentences. Ease off if soreness changes your movement or your jump quality drops; keep the next demanding session fresh.',
    ],
    nutrition: [proteinAdvice, carbohydrateAdvice, hydrationAdvice],
    sources: SOURCES.map((source) => ({ ...source })),
  };
}
