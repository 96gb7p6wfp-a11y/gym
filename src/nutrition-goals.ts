/** Editable adult starting estimates, calibrated with weight trends rather than watch calories. */
export interface NutritionGoalSettings {
  age: number;
  heightCm: number;
  sex: 'male' | 'female' | 'unspecified';
  activityFactor: number;
  surplusKcal: number;
}

export interface NutritionGoalInput extends NutritionGoalSettings {
  bodyWeightKg: number;
}

export interface NutritionGoalEstimate {
  bmr: number;
  maintenanceKcal: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  proteinRange: [number, number];
}

export const PERSONAL_NUTRITION_START: NutritionGoalInput = {
  age: 18, heightCm: 180, bodyWeightKg: 64, sex: 'male',
  activityFactor: 1.65, surplusKcal: 200,
};

export const NUTRITION_GOAL_SOURCES = [
  { label: 'Mifflin–St Jeor resting energy equation', url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/' },
  { label: 'ISSN: protein and exercise', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/' },
  { label: 'Protein and resistance training: systematic review', url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/' },
  { label: 'AIS: performance nutrition', url: 'https://www.ausport.gov.au/ais/nutrition/performance-nutrition-hq-modules' },
];

export function validateNutritionGoalInput(input: NutritionGoalInput): void {
  const ranges: Array<[keyof NutritionGoalInput, number, number]> = [
    ['age', 18, 100], ['heightCm', 100, 250], ['bodyWeightKg', 20, 400],
    ['activityFactor', 1.2, 2.4], ['surplusKcal', 0, 500],
  ];
  for (const [key, min, max] of ranges) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error('Check your age, height, weight, activity level and calorie surplus.');
    }
  }
  if (!Number.isInteger(input.age) || !['male', 'female', 'unspecified'].includes(input.sex)) {
    throw new Error('Choose a valid adult age and energy equation option.');
  }
}

export function calculateNutritionGoal(input: NutritionGoalInput): NutritionGoalEstimate {
  validateNutritionGoalInput(input);
  if (input.sex === 'unspecified') throw new Error('Choose a male or female energy equation for an estimate, or set your targets manually.');
  const bmr = 10 * input.bodyWeightKg + 6.25 * input.heightCm - 5 * input.age + (input.sex === 'male' ? 5 : -161);
  const maintenanceKcal = bmr * input.activityFactor;
  const calories = Math.round((maintenanceKcal + input.surplusKcal) / 100) * 100;
  const protein = Math.round(input.bodyWeightKg * 2);
  // Roughly a quarter of energy from fat; the remainder fuels training as carbs.
  const fat = Math.round((calories * 0.24 / 9) / 5) * 5;
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  if (calories <= 0 || carbs < 0) throw new Error('These inputs cannot produce a balanced starting target.');
  return {
    bmr: Math.round(bmr), maintenanceKcal: Math.round(maintenanceKcal), calories, protein, fat, carbs,
    proteinRange: [Math.round(input.bodyWeightKg * 1.6), Math.round(input.bodyWeightKg * 2.2)],
  };
}

export interface VolleyballMealSchedule {
  days: number[];
  startTime: string;
  endTime: string;
  timeZone: string;
}

export function simpleFoodGuidance(date: string, schedule: VolleyballMealSchedule = {
  days: [1, 4], startTime: '20:00', endTime: '22:00', timeZone: 'Europe/Berlin',
}) {
  // The selected civil date is already in the user's calendar; UTC prevents device-zone shifts.
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid date for food guidance.');
  }
  const day = (parsed.getUTCDay() + 6) % 7;
  const volleyball = schedule.days.includes(day);
  const startHour = Number(schedule.startTime.split(':')[0]);
  const startMinute = Number(schedule.startTime.split(':')[1]);
  const timeBefore = (hours: number) => `${String((startHour - hours + 24) % 24).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
  return volleyball ? {
    before: `Volleyball ${schedule.startTime}–${schedule.endTime}: eat rice or pasta + chicken or tofu around ${timeBefore(2)}–${timeBefore(1)}. A banana is an easy snack if needed.`,
    after: `After ${schedule.endTime}: yogurt + fruit, or a small meal with 20–30 g protein and carbs. Rehydrate and keep bedtime comfortable.`,
  } : {
    before: 'For a gym day: 1–3 h before, oats or toast + yogurt or eggs. If starting soon, try a banana. On rest days, keep regular meals.',
    after: 'After training: rice or potatoes + chicken, beans or tofu. Aim for 20–30 g protein; spread your daily protein across 3–4 meals.',
  };
}
