/** Presentation guidance describes the scheduled intent, never a recovery score. */
export type SessionPurpose = {
  title: string;
  subtitle: string;
  focus: string;
  intensity: string;
  fatigue: string;
};

type PurposePlan = { name?: string; kind?: string; goal?: string; exercises?: { name?: string; group?: string }[] };
type IntentExercise = { name?: string; group?: string; category?: string; goal?: string; mode?: string };

export function getSessionPurpose(plan: PurposePlan, _dayIndex?: number): SessionPurpose {
  const name = plan.name ?? 'Workout';
  const normalized = name.toLowerCase();
  const goal = plan.goal;
  if (plan.kind === 'sport' || goal === 'sport' || /volleyball/.test(normalized)) return {
    title: name, subtitle: 'Sport skills + match performance', focus: 'Quality movement · fuel well', intensity: 'Sport session', fatigue: 'Manage extra leg work',
  };
  if (plan.kind === 'recovery' || goal === 'recovery' || /recovery/.test(normalized)) return {
    title: name, subtitle: 'Restore movement + prepare for tomorrow', focus: 'Easy pace · comfortable range', intensity: 'Easy', fatigue: 'Keep it light',
  };
  if (/primer/.test(normalized) && (!goal || goal === 'jump' || goal === 'power')) return {
    title: 'Jump primer', subtitle: 'Jump rhythm + takeoff technique', focus: 'Fresh legs · full recovery', intensity: 'Low volume', fatigue: 'Stop before fatigue',
  };
  if ((/main jump|complex lower|explosive lower/.test(normalized) && (!goal || goal === 'jump' || goal === 'power')) || goal === 'jump') return {
    title: /main jump|complex lower/.test(normalized) ? 'Explosive Lower' : name,
    subtitle: 'Jump height + lower-body power', focus: 'Fast intent · high-quality reps', intensity: 'Quality first', fatigue: 'Full recovery between efforts',
  };
  if (/lower strength/.test(normalized) && (!goal || goal === 'strength')) return {
    title: 'Lower Strength', subtitle: 'Force production + stronger takeoff', focus: 'Strong reps · controlled landings', intensity: 'Strength focus', fatigue: 'Keep 1–2 reps in reserve',
  };
  if (/upper power/.test(normalized) && (!goal || goal === 'power')) return {
    title: 'Upper Power', subtitle: 'Hitting power + upper-body strength', focus: 'Fast throws · controlled lifting', intensity: 'Power + strength', fatigue: 'Keep explosive reps crisp',
  };
  if (/upper strength/.test(normalized) && (!goal || goal === 'strength')) return {
    title: 'Upper Strength', subtitle: 'Strength + upper-body development', focus: 'Full range · strong reps', intensity: 'Strength focus', fatigue: 'Leave 1–2 reps in reserve',
  };
  if (goal === 'power') return {
    title: name, subtitle: 'Fast force production', focus: 'Explosive intent · full recovery', intensity: 'Quality first', fatigue: 'Stop when speed drops',
  };
  if (goal === 'hypertrophy') return {
    title: name, subtitle: 'Muscle development', focus: 'Controlled reps · full range', intensity: 'Controlled effort', fatigue: 'Keep 1–3 reps in reserve',
  };
  if (goal === 'mobility') return {
    title: name, subtitle: 'Movement range + control', focus: 'Comfortable range · smooth movement', intensity: 'Easy', fatigue: 'No forced positions',
  };
  if (goal === 'capacity') return {
    title: name, subtitle: 'Work capacity + movement quality', focus: 'Steady effort · clean technique', intensity: 'Steady', fatigue: 'Keep enough energy for volleyball',
  };
  return {
    title: name, subtitle: goal === 'strength' ? 'Strength + force production' : 'Your planned training',
    focus: 'Consistent technique · quality reps', intensity: 'Follow your targets', fatigue: 'Adjust to how you feel',
  };
}

export function getExerciseIntent(exercise: IntentExercise): string {
  const description = `${exercise.name ?? ''} ${exercise.group ?? ''} ${exercise.category ?? ''}`.toLowerCase();
  if (/pogo/.test(description)) return 'Quick contacts · quiet, springy landings';
  if (/jump|throw|slam|sprint|plyometric|power/.test(description) || exercise.goal === 'power' || exercise.goal === 'jump') return 'Explosive intent · reset before each rep';
  if (/mobility|stretch|recovery|walk/.test(description) || exercise.goal === 'mobility' || exercise.goal === 'recovery') return 'Easy pace · comfortable range';
  if (/plank|hold|isometric/.test(description)) return 'Steady breathing · hold a strong position';
  if (/curl|raise|fly|pec deck|pushdown|hypertrophy/.test(description) || exercise.goal === 'hypertrophy') return 'Controlled reps · full comfortable range';
  return 'Controlled lowering · strong lift';
}
