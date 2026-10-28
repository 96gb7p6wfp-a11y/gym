/** Local, searchable movement catalogue. Canonical IDs never replace saved log keys. */
export type ExerciseCategory = 'Strength' | 'Hypertrophy' | 'Power' | 'Plyometric' | 'Speed' | 'Mobility' | 'Core' | 'Stability' | 'Recovery' | 'Sport';
export type ExerciseMode = 'weight' | 'bodyweight' | 'timed';
export interface LibraryExercise {
  id: string;
  name: string;
  muscles: string[];
  category: ExerciseCategory;
  primaryBenefit: string;
  secondaryBenefit: string;
  equipment: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  recommendedSets: number;
  recommendedReps: string;
  rest: number;
  mode: ExerciseMode;
  movement: string;
  goals: string[];
  cues: string[];
  mistakes: string[];
  substitutions: string[];
  perSide: boolean;
  measurement?: 'touch' | 'height' | 'distance';
  quantityUnit?: 'm';
  jumpContactsPerRep?: number;
  aliases?: string[];
  legacyKeys?: string[];
}
export interface ExerciseReference { exerciseId?: string; key?: string; name?: string }
export interface LibraryFilters { muscle?: string; goal?: string; equipment?: string; movement?: string; type?: string }
type Entry = [id: string, name: string, muscles: string, equipment: string, options?: Partial<LibraryExercise>];

const catalogue: LibraryExercise[] = [];
function family(category: ExerciseCategory, movement: string, primaryBenefit: string, secondaryBenefit: string, entries: Entry[], options: Partial<LibraryExercise> = {}) {
  for (const [id, name, muscles, equipment, entry = {}] of entries) {
    catalogue.push({
      id, name, muscles: muscles.split('|'), equipment: equipment.split('|'), category, movement, primaryBenefit, secondaryBenefit,
      difficulty: 'Beginner', recommendedSets: 3, recommendedReps: '8–12 reps', rest: 90, mode: 'weight', perSide: false,
      goals: category === 'Strength' ? ['Strength', 'Muscle'] : category === 'Hypertrophy' ? ['Muscle'] : [category],
      cues: ['Use a comfortable range.', 'Keep every rep controlled.'],
      mistakes: ['Rushing the return.', 'Using a load that changes your technique.'],
      substitutions: [], ...options, ...entry,
    });
  }
}

family('Strength', 'Squat', 'Leg strength for stronger takeoff', 'Quad and glute development', [
  ['back-squat', 'Barbell Back Squat', 'Quads|Glutes|Core', 'Barbell|Rack', { difficulty: 'Intermediate', substitutions: ['hack-squat', 'front-squat', 'leg-press', 'safety-bar-squat', 'bulgarian-split-squat'], cues: ['Brace before lowering.', 'Drive through the whole foot.'], mistakes: ['Losing your brace.', 'Letting the knees collapse inward.'] }],
  ['front-squat', 'Front Squat', 'Quads|Glutes|Core', 'Barbell|Rack', { difficulty: 'Intermediate', substitutions: ['back-squat', 'hack-squat', 'goblet-squat'] }],
  ['hack-squat', 'Hack Squat', 'Quads|Glutes', 'Machine', { legacyKeys: ['hack-squat'], substitutions: ['leg-press', 'front-squat', 'back-squat'], cues: ['Keep heels supported.', 'Lower only as far as you can control.'] }],
  ['safety-bar-squat', 'Safety Bar Squat', 'Quads|Glutes|Core', 'Safety bar|Rack', { difficulty: 'Intermediate', substitutions: ['back-squat', 'front-squat', 'hack-squat'] }],
  ['leg-press', 'Leg Press', 'Quads|Glutes', 'Machine', { substitutions: ['hack-squat', 'goblet-squat', 'bulgarian-split-squat', 'trap-bar-deadlift'], cues: ['Keep the pelvis supported.', 'Control the depth and return.'] }],
  ['goblet-squat', 'Goblet Squat', 'Quads|Glutes|Core', 'Dumbbell|Kettlebell', { substitutions: ['front-squat', 'bodyweight-squat', 'leg-press'] }],
  ['belt-squat', 'Belt Squat', 'Quads|Glutes', 'Machine', { substitutions: ['hack-squat', 'leg-press', 'goblet-squat'] }],
], { recommendedReps: '5–8 reps', rest: 150, cues: ['Keep the whole foot planted.', 'Lower with control; stand with intent.'], mistakes: ['Losing your brace.', 'Forcing a depth you cannot control.'] });

family('Strength', 'Single-leg squat', 'Single-leg strength and stability', 'Jumping and landing control', [
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'Quads|Glutes', 'Dumbbell|Bench', { legacyKeys: ['bulgarian'], substitutions: ['split-squat', 'reverse-lunge', 'step-up'], cues: ['Load the front leg.', 'Use a low rear-foot support.'], mistakes: ['Pushing off the back foot.', 'Losing balance to lift more weight.'] }],
  ['split-squat', 'Split Squat', 'Quads|Glutes', 'Dumbbell', { substitutions: ['bulgarian-split-squat', 'reverse-lunge', 'step-up'] }],
  ['reverse-lunge', 'Reverse Lunge', 'Quads|Glutes', 'Dumbbell', { substitutions: ['split-squat', 'step-up', 'bulgarian-split-squat'] }],
  ['walking-lunge', 'Walking Lunge', 'Quads|Glutes', 'Dumbbell', { substitutions: ['reverse-lunge', 'split-squat'] }],
  ['step-up', 'Step-up', 'Quads|Glutes', 'Dumbbell|Box', { substitutions: ['reverse-lunge', 'split-squat'], cues: ['Choose a controllable step height.', 'Drive through the top leg.'] }],
  ['lateral-lunge', 'Lateral Lunge', 'Quads|Glutes|Adductors', 'Dumbbell', { substitutions: ['cossack-squat', 'reverse-lunge'], primaryBenefit: 'Lateral leg strength', secondaryBenefit: 'Court movement and hip control' }],
], { perSide: true, recommendedReps: '6–10 reps', rest: 120 });

family('Strength', 'Hip hinge', 'Posterior-chain strength', 'Hip drive and takeoff force', [
  ['romanian-deadlift', 'Romanian Deadlift', 'Hamstrings|Glutes|Back', 'Barbell|Dumbbell', { aliases: ['RDL'], legacyKeys: ['rdl'], substitutions: ['dumbbell-rdl', 'single-leg-rdl', 'cable-pull-through'], cues: ['Push the hips back.', 'Keep weights close to the legs.'], mistakes: ['Rounding to reach the floor.', 'Letting weights drift forward.'] }],
  ['dumbbell-rdl', 'Dumbbell Romanian Deadlift', 'Hamstrings|Glutes|Back', 'Dumbbell', { substitutions: ['romanian-deadlift', 'single-leg-rdl', 'cable-pull-through'] }],
  ['trap-bar-deadlift', 'Trap Bar Deadlift', 'Glutes|Quads|Hamstrings|Back', 'Trap bar', { difficulty: 'Intermediate', recommendedSets: 3, recommendedReps: '4–6 reps', rest: 180, substitutions: ['leg-press', 'deadlift', 'romanian-deadlift'], primaryBenefit: 'Whole-body force production', cues: ['Learn the setup with an unloaded hinge, then the 20 kg empty bar.', 'Brace, push through the floor and finish tall without leaning back.'], mistakes: ['Adding load before technique is consistent.', 'Treating this alternative as extra work on top of Leg Press.'] }],
  ['deadlift', 'Barbell Deadlift', 'Glutes|Hamstrings|Back|Quads', 'Barbell', { difficulty: 'Intermediate', substitutions: ['trap-bar-deadlift', 'romanian-deadlift'] }],
  ['single-leg-rdl', 'Single-Leg Romanian Deadlift', 'Hamstrings|Glutes', 'Dumbbell', { perSide: true, substitutions: ['dumbbell-rdl', 'romanian-deadlift'], secondaryBenefit: 'Single-leg balance and hip control' }],
  ['cable-pull-through', 'Cable Pull-through', 'Glutes|Hamstrings', 'Cable', { substitutions: ['dumbbell-rdl', 'romanian-deadlift'] }],
  ['back-extension', 'Back Extension', 'Glutes|Hamstrings|Back', 'Bench', { substitutions: ['cable-pull-through', 'dumbbell-rdl'] }],
], { recommendedReps: '5–8 reps', rest: 150, cues: ['Brace before hinging.', 'Move at the hips with a steady trunk.'], mistakes: ['Overextending the low back.', 'Losing position to finish a rep.'] });

family('Hypertrophy', 'Hip extension', 'Glute strength and muscle', 'Hip stability and force production', [
  ['hip-thrust', 'Barbell Hip Thrust', 'Glutes|Hamstrings', 'Barbell|Bench', { substitutions: ['glute-bridge', 'cable-pull-through'], cues: ['Keep ribs down.', 'Finish with the hips, not the low back.'] }],
  ['glute-bridge', 'Glute Bridge', 'Glutes|Hamstrings', 'Bodyweight', { mode: 'bodyweight', substitutions: ['hip-thrust', 'single-leg-glute-bridge'] }],
  ['single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'Glutes|Hamstrings', 'Bodyweight', { mode: 'bodyweight', perSide: true, substitutions: ['glute-bridge', 'hip-thrust'] }],
  ['cable-kickback', 'Cable Glute Kickback', 'Glutes', 'Cable', { perSide: true, substitutions: ['hip-thrust', 'single-leg-glute-bridge'] }],
]);
family('Hypertrophy', 'Knee flexion', 'Hamstring strength and muscle', 'Knee control and posterior-chain balance', [
  ['leg-curl', 'Leg Curl', 'Hamstrings', 'Machine', { legacyKeys: ['leg-curl'], aliases: ['Seated Leg Curl', 'Lying Leg Curl'], substitutions: ['slider-leg-curl', 'nordic-curl'] }],
  ['slider-leg-curl', 'Slider Leg Curl', 'Hamstrings|Glutes', 'Sliders', { mode: 'bodyweight', substitutions: ['leg-curl', 'nordic-curl'] }],
  ['nordic-curl', 'Assisted Nordic Curl', 'Hamstrings', 'Band|Anchor', { mode: 'bodyweight', difficulty: 'Advanced', recommendedSets: 2, recommendedReps: '3–5 reps', rest: 120, substitutions: ['leg-curl', 'slider-leg-curl'], cues: ['Use enough assistance to control the descent.', 'Keep hips extended.'], mistakes: ['Dropping faster than you can control.', 'Adding too much new eccentric volume.'] }],
]);
family('Hypertrophy', 'Knee extension', 'Quad strength and muscle', 'Support for knee-dominant strength work', [
  ['leg-extension', 'Leg Extension', 'Quads', 'Machine', { substitutions: ['leg-press', 'hack-squat'], cues: ['Align the knee with the machine pivot.', 'Lift smoothly through a comfortable range.'] }],
]);
family('Strength', 'Ankle extension', 'Calf strength for takeoff', 'Ankle stiffness and controlled landings', [
  ['standing-calf-raise', 'Standing Calf Raise', 'Calves', 'Machine|Dumbbell', { legacyKeys: ['calf'], substitutions: ['single-leg-calf-raise', 'seated-calf-raise'] }],
  ['seated-calf-raise', 'Seated Calf Raise', 'Calves', 'Machine|Dumbbell', { substitutions: ['standing-calf-raise', 'single-leg-calf-raise'], secondaryBenefit: 'Bent-knee soleus strength' }],
  ['single-leg-calf-raise', 'Single-Leg Calf Raise', 'Calves', 'Dumbbell|Step', { perSide: true, substitutions: ['standing-calf-raise', 'seated-calf-raise'] }],
], { cues: ['Pause in a comfortable stretch.', 'Rise without rolling the ankle outward.'], mistakes: ['Bouncing through the bottom.', 'Shortening the range to lift more.'] });
family('Stability', 'Ankle flexion', 'Shin strength and ankle control', 'Lower-leg capacity for court movement', [
  ['tibialis-raise', 'Tibialis Raise', 'Tibialis', 'Wall', { mode: 'bodyweight', legacyKeys: ['tibialis'], recommendedReps: '15–20 reps', recommendedSets: 2, substitutions: ['band-dorsiflexion'], cues: ['Keep heels down.', 'Lift the toes without swinging.'] }],
  ['band-dorsiflexion', 'Band Ankle Dorsiflexion', 'Tibialis', 'Band', { perSide: true, substitutions: ['tibialis-raise'] }],
]);
family('Strength', 'Hip flexion', 'Hip-flexor strength', 'Knee drive and approach control', [
  ['standing-hip-flexion', 'Standing Cable Hip Flexion', 'Hip flexors|Core', 'Cable', { perSide: true, substitutions: ['band-hip-flexion', 'hanging-knee-raise'] }],
  ['band-hip-flexion', 'Band Hip Flexion', 'Hip flexors|Core', 'Band', { perSide: true, substitutions: ['standing-hip-flexion', 'dead-bug'] }],
]);

family('Strength', 'Horizontal push', 'Upper-body pushing strength', 'Chest and triceps development', [
  ['bench-press', 'Barbell Bench Press', 'Chest|Triceps|Shoulders', 'Barbell|Bench|Rack', { aliases: ['Bench Press'], substitutions: ['machine-chest-press', 'dumbbell-bench-press', 'push-up'], difficulty: 'Intermediate', cues: ['Set feet and upper back before unracking.', 'Use a spotter or rack safeties.'] }],
  ['machine-chest-press', 'Machine Chest Press', 'Chest|Triceps|Shoulders', 'Machine', { aliases: ['Machine Chest Press / Bench Press'], legacyKeys: ['chest-press'], substitutions: ['dumbbell-bench-press', 'bench-press', 'push-up'] }],
  ['dumbbell-bench-press', 'Dumbbell Bench Press', 'Chest|Triceps|Shoulders', 'Dumbbell|Bench', { substitutions: ['machine-chest-press', 'bench-press', 'push-up'] }],
  ['incline-dumbbell-press', 'Incline Dumbbell Press', 'Chest|Shoulders|Triceps', 'Dumbbell|Bench', { legacyKeys: ['incline-db'], substitutions: ['incline-bench-press', 'machine-chest-press'], primaryBenefit: 'Upper-chest strength and muscle' }],
  ['incline-bench-press', 'Incline Barbell Bench Press', 'Chest|Shoulders|Triceps', 'Barbell|Bench', { substitutions: ['incline-dumbbell-press', 'machine-chest-press'], primaryBenefit: 'Upper-chest strength and muscle' }],
  ['push-up', 'Push-up', 'Chest|Triceps|Core', 'Bodyweight', { mode: 'bodyweight', substitutions: ['incline-push-up', 'dumbbell-bench-press'], cues: ['Keep the trunk in a straight line.', 'Let the shoulder blades move naturally.'] }],
  ['incline-push-up', 'Incline Push-up', 'Chest|Triceps|Core', 'Bench', { mode: 'bodyweight', substitutions: ['push-up', 'machine-chest-press'] }],
], { rest: 120, recommendedReps: '6–10 reps', cues: ['Keep wrists aligned over forearms.', 'Lower with control; press strongly.'], mistakes: ['Bouncing out of the bottom.', 'Pressing through shoulder pain.'] });
family('Hypertrophy', 'Chest fly', 'Chest muscle development', 'Controlled horizontal arm strength', [
  ['cable-fly', 'Cable Chest Fly', 'Chest', 'Cable', { substitutions: ['pec-deck', 'dumbbell-fly'] }],
  ['pec-deck', 'Pec Deck', 'Chest', 'Machine', { substitutions: ['cable-fly', 'dumbbell-fly'] }],
  ['dumbbell-fly', 'Dumbbell Fly', 'Chest', 'Dumbbell|Bench', { substitutions: ['cable-fly', 'pec-deck'], cues: ['Keep a soft elbow bend.', 'Use a light load and comfortable stretch.'] }],
], { recommendedReps: '10–15 reps', cues: ['Keep a soft elbow bend.', 'Stop at a comfortable chest stretch.'] });
family('Strength', 'Vertical pull', 'Back strength and shoulder control', 'Upper-body development for hitting mechanics', [
  ['neutral-lat-pulldown', 'Neutral-Grip Lat Pulldown', 'Back|Biceps', 'Cable', { aliases: ['Neutral-Grip Lat Pulldown / Pull-up'], legacyKeys: ['lat-pulldown'], substitutions: ['lat-pulldown', 'assisted-pull-up', 'pull-up'] }],
  ['lat-pulldown', 'Lat Pulldown', 'Back|Biceps', 'Cable', { substitutions: ['neutral-lat-pulldown', 'assisted-pull-up', 'pull-up'] }],
  ['pull-up', 'Pull-up', 'Back|Biceps', 'Pull-up bar', { mode: 'bodyweight', difficulty: 'Intermediate', substitutions: ['assisted-pull-up', 'neutral-lat-pulldown'] }],
  ['assisted-pull-up', 'Assisted Pull-up', 'Back|Biceps', 'Machine|Band', { mode: 'bodyweight', substitutions: ['neutral-lat-pulldown', 'pull-up'], cues: ['Use enough assistance for clean reps.', 'Record the same assistance setup for comparisons.'] }],
  ['chin-up', 'Chin-up', 'Back|Biceps', 'Pull-up bar', { mode: 'bodyweight', difficulty: 'Intermediate', substitutions: ['pull-up', 'assisted-pull-up', 'neutral-lat-pulldown'] }],
], { rest: 120, recommendedReps: '6–10 reps', cues: ['Pull elbows toward the ribs.', 'Return overhead with control.'], mistakes: ['Swinging to finish reps.', 'Pulling behind the neck.'] });
family('Strength', 'Horizontal pull', 'Back strength and shoulder stability', 'Stronger hitting mechanics and upper-body development', [
  ['chest-supported-row', 'Chest-Supported Row', 'Back|Shoulders|Biceps', 'Machine|Bench|Dumbbell', { legacyKeys: ['chest-row'], substitutions: ['seal-row', 'cable-row', 'one-arm-dumbbell-row', 'barbell-row'] }],
  ['seal-row', 'Seal Row', 'Back|Shoulders|Biceps', 'Barbell|Bench', { substitutions: ['chest-supported-row', 'cable-row'] }],
  ['cable-row', 'Seated Cable Row', 'Back|Shoulders|Biceps', 'Cable', { aliases: ['Cable Row'], substitutions: ['chest-supported-row', 'one-arm-dumbbell-row', 'barbell-row'] }],
  ['one-arm-dumbbell-row', 'One-arm Dumbbell Row', 'Back|Shoulders|Biceps', 'Dumbbell|Bench', { perSide: true, aliases: ['One-arm DB Row'], substitutions: ['chest-supported-row', 'cable-row'] }],
  ['barbell-row', 'Barbell Row', 'Back|Shoulders|Biceps', 'Barbell', { difficulty: 'Intermediate', substitutions: ['chest-supported-row', 'cable-row', 'one-arm-dumbbell-row'] }],
  ['inverted-row', 'Inverted Row', 'Back|Shoulders|Biceps', 'Bar|Suspension trainer', { mode: 'bodyweight', substitutions: ['cable-row', 'chest-supported-row'] }],
], { rest: 120, cues: ['Pull without shrugging.', 'Keep the trunk steady.'], mistakes: ['Jerking the weight with the lower back.', 'Lifting the chest off a support pad.'] });
family('Strength', 'Vertical push', 'Shoulder and triceps strength', 'Upper-body force and overhead control', [
  ['landmine-press', 'Landmine Press', 'Shoulders|Triceps|Core', 'Barbell|Landmine', { aliases: ['Landmine Press / Machine Shoulder Press'], legacyKeys: ['landmine-press'], perSide: true, substitutions: ['machine-shoulder-press', 'dumbbell-shoulder-press'], primaryBenefit: 'Shoulder strength with an angled press' }],
  ['machine-shoulder-press', 'Machine Shoulder Press', 'Shoulders|Triceps', 'Machine', { substitutions: ['dumbbell-shoulder-press', 'landmine-press'] }],
  ['dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders|Triceps', 'Dumbbell|Bench', { substitutions: ['machine-shoulder-press', 'landmine-press'] }],
  ['overhead-press', 'Barbell Overhead Press', 'Shoulders|Triceps|Core', 'Barbell|Rack', { difficulty: 'Intermediate', substitutions: ['dumbbell-shoulder-press', 'landmine-press'] }],
], { rest: 120, cues: ['Keep ribs over the pelvis.', 'Press through a comfortable shoulder range.'], mistakes: ['Leaning backward to finish.', 'Forcing a painful overhead range.'] });
family('Hypertrophy', 'Shoulder abduction', 'Side-delt development', 'Upper-body shape and shoulder strength', [
  ['cable-lateral-raise', 'Cable Lateral Raise', 'Shoulders', 'Cable', { legacyKeys: ['lateral-raise'], substitutions: ['dumbbell-lateral-raise', 'machine-lateral-raise'] }],
  ['dumbbell-lateral-raise', 'Dumbbell Lateral Raise', 'Shoulders', 'Dumbbell', { substitutions: ['cable-lateral-raise', 'machine-lateral-raise'] }],
  ['machine-lateral-raise', 'Machine Lateral Raise', 'Shoulders', 'Machine', { substitutions: ['cable-lateral-raise', 'dumbbell-lateral-raise'] }],
], { recommendedReps: '12–20 reps', rest: 60, cues: ['Use a soft elbow bend.', 'Lift without shrugging or swinging.'] });
family('Hypertrophy', 'Rear-delt pull', 'Rear-shoulder and upper-back strength', 'Shoulder balance for hitting volume', [
  ['reverse-pec-deck', 'Reverse Pec Deck', 'Shoulders|Back', 'Machine', { legacyKeys: ['reverse-pec'], substitutions: ['reverse-fly', 'face-pull'] }],
  ['reverse-fly', 'Dumbbell Reverse Fly', 'Shoulders|Back', 'Dumbbell|Bench', { substitutions: ['reverse-pec-deck', 'face-pull'] }],
  ['face-pull', 'Face Pull', 'Shoulders|Back', 'Cable|Band', { legacyKeys: ['face-pull'], aliases: ['Light Face Pull'], substitutions: ['reverse-pec-deck', 'reverse-fly'] }],
], { recommendedReps: '12–20 reps', rest: 60, cues: ['Keep neck and ribs quiet.', 'Use light resistance and a smooth return.'] });
family('Stability', 'Shoulder rotation', 'Rotator-cuff strength and control', 'Shoulder capacity for volleyball', [
  ['external-rotation', 'Cable External Rotation', 'Shoulders', 'Cable|Band', { aliases: ['Band / Cable External Rotation'], legacyKeys: ['external-rotation', 'warm-external'], substitutions: ['side-lying-external-rotation'] }],
  ['side-lying-external-rotation', 'Side-lying External Rotation', 'Shoulders', 'Dumbbell|Mat', { substitutions: ['external-rotation'] }],
], { perSide: true, recommendedSets: 2, recommendedReps: '12–15 reps', rest: 60, cues: ['Keep the elbow gently supported at your side.', 'Rotate without turning the trunk.'], mistakes: ['Using a heavy load.', 'Forcing the end of the range.'] });
family('Hypertrophy', 'Elbow flexion', 'Biceps and arm development', 'Pulling strength', [
  ['biceps-curl', 'Biceps Curl', 'Biceps', 'Dumbbell|Cable', { legacyKeys: ['biceps-curl'], substitutions: ['cable-curl', 'incline-curl', 'hammer-curl'] }],
  ['hammer-curl', 'Hammer Curl', 'Biceps|Forearms', 'Dumbbell', { legacyKeys: ['hammer-curl'], substitutions: ['biceps-curl', 'cable-curl'] }],
  ['cable-curl', 'Cable Curl', 'Biceps', 'Cable', { substitutions: ['biceps-curl', 'incline-curl'] }],
  ['incline-curl', 'Incline Dumbbell Curl', 'Biceps', 'Dumbbell|Bench', { substitutions: ['biceps-curl', 'cable-curl'] }],
  ['preacher-curl', 'Preacher Curl', 'Biceps', 'Machine|Bench|Dumbbell', { substitutions: ['cable-curl', 'biceps-curl'] }],
], { recommendedSets: 2, recommendedReps: '10–15 reps', rest: 60, cues: ['Keep the upper arm steady.', 'Lower without swinging.'] });
family('Hypertrophy', 'Elbow extension', 'Triceps and arm development', 'Pushing strength', [
  ['triceps-pushdown', 'Triceps Pushdown', 'Triceps', 'Cable', { legacyKeys: ['triceps'], substitutions: ['overhead-triceps-extension', 'band-pushdown'] }],
  ['overhead-triceps-extension', 'Cable Overhead Triceps Extension', 'Triceps', 'Cable', { substitutions: ['triceps-pushdown', 'dumbbell-triceps-extension'] }],
  ['dumbbell-triceps-extension', 'Dumbbell Triceps Extension', 'Triceps', 'Dumbbell', { substitutions: ['overhead-triceps-extension', 'triceps-pushdown'] }],
  ['band-pushdown', 'Band Triceps Pushdown', 'Triceps', 'Band', { substitutions: ['triceps-pushdown', 'dumbbell-triceps-extension'] }],
], { recommendedSets: 2, recommendedReps: '10–15 reps', rest: 60, cues: ['Keep upper arms quiet.', 'Straighten the elbows without slamming the joint.'] });

family('Core', 'Anti-rotation', 'Trunk stability under rotation', 'Transfer force between hips and shoulders', [
  ['pallof-press', 'Pallof Press', 'Core', 'Cable|Band', { legacyKeys: ['pallof'], substitutions: ['dead-bug', 'bird-dog'], perSide: true }],
  ['bird-dog', 'Bird Dog', 'Core|Glutes', 'Mat', { mode: 'bodyweight', substitutions: ['dead-bug', 'pallof-press'], perSide: true }],
], { recommendedSets: 2, recommendedReps: '8–12 reps', rest: 60, cues: ['Keep ribs and pelvis aligned.', 'Breathe while resisting rotation.'] });
family('Core', 'Anti-extension', 'Trunk control and bracing', 'Stable force transfer during jumping', [
  ['dead-bug', 'Dead Bug', 'Core|Hip flexors', 'Mat', { mode: 'bodyweight', perSide: true, substitutions: ['bird-dog', 'plank'] }],
  ['plank', 'Plank', 'Core|Shoulders', 'Mat', { mode: 'timed', recommendedReps: '20–40 sec', substitutions: ['dead-bug', 'side-plank'] }],
  ['ab-wheel', 'Ab Wheel Rollout', 'Core|Shoulders', 'Ab wheel', { mode: 'bodyweight', difficulty: 'Advanced', recommendedReps: '5–8 reps', substitutions: ['dead-bug', 'plank'] }],
], { recommendedSets: 2, rest: 60, cues: ['Keep the ribs down.', 'Stop the range before the lower back arches.'] });
family('Core', 'Lateral stability', 'Lateral trunk strength', 'Hip and landing control', [
  ['side-plank', 'Side Plank', 'Core|Glutes', 'Mat', { legacyKeys: ['side-plank'], substitutions: ['suitcase-carry', 'copenhagen-plank'] }],
  ['copenhagen-plank', 'Copenhagen Plank', 'Adductors|Core', 'Bench', { legacyKeys: ['copenhagen'], difficulty: 'Intermediate', recommendedReps: '15–25 sec', substitutions: ['side-plank', 'adductor-squeeze'], cues: ['Start with the knee supported.', 'Keep a steady shoulder-to-hip line.'], mistakes: ['Starting with a long lever too soon.', 'Continuing through groin pain.'] }],
  ['suitcase-carry', 'Suitcase Carry', 'Core|Forearms|Glutes', 'Dumbbell|Kettlebell', { mode: 'weight', quantityUnit: 'm', perSide: true, recommendedReps: '20–30 m', substitutions: ['side-plank', 'farmer-carry'] }],
], { perSide: true, mode: 'timed', recommendedSets: 2, recommendedReps: '20–40 sec', rest: 60 });
family('Core', 'Trunk flexion', 'Abdominal strength', 'Trunk and hip control', [
  ['cable-crunch', 'Cable Crunch', 'Core', 'Cable', { substitutions: ['reverse-crunch', 'hanging-knee-raise'] }],
  ['reverse-crunch', 'Reverse Crunch', 'Core', 'Mat', { mode: 'bodyweight', substitutions: ['cable-crunch', 'dead-bug'] }],
  ['hanging-knee-raise', 'Hanging Knee Raise', 'Core|Hip flexors', 'Pull-up bar', { mode: 'bodyweight', difficulty: 'Intermediate', substitutions: ['reverse-crunch', 'dead-bug'] }],
], { recommendedSets: 2, rest: 60, cues: ['Move without momentum.', 'Keep the range controlled.'] });
family('Strength', 'Carry', 'Grip and whole-body strength', 'Trunk stability under load', [
  ['farmer-carry', 'Farmer Carry', 'Forearms|Core|Back', 'Dumbbell|Kettlebell', { mode: 'timed', recommendedReps: '20–30 sec', substitutions: ['suitcase-carry'], cues: ['Walk tall with short controlled steps.', 'Keep the shoulders relaxed.'] }],
]);

family('Power', 'Throw', 'Explosive upper-body power', 'Fast force transfer for hitting', [
  ['spike-slam', 'Medicine Ball Spike Slam', 'Shoulders|Core|Back', 'Medicine ball', { legacyKeys: ['spike-slam'], recommendedReps: '3 reps', substitutions: ['overhead-throw', 'rotational-throw'], primaryBenefit: 'Explosive overhead force', cues: ['Start with a 2–3 kg slam ball in an approved clear area.', 'Use both hands overhead, drive down fast and reset fully.'], mistakes: ['Using a ball or surface not approved for slams.', 'Forcing ballistic shoulder work when sore or fatigued.'] }],
  ['overhead-throw', 'Medicine Ball Overhead Throw / Slam', 'Shoulders|Core|Glutes', 'Medicine ball', { legacyKeys: ['overhead-throw'], substitutions: ['spike-slam', 'chest-pass'] }],
  ['rotational-throw', 'Medicine Ball Rotational Throw', 'Core|Shoulders|Glutes', 'Medicine ball', { legacyKeys: ['rotational-throw'], perSide: true, substitutions: ['scoop-toss', 'spike-slam'], primaryBenefit: 'Rotational power from hips to hands' }],
  ['chest-pass', 'Medicine Ball Chest Pass', 'Chest|Triceps|Core', 'Medicine ball', { substitutions: ['overhead-throw', 'explosive-push-up'] }],
  ['scoop-toss', 'Medicine Ball Scoop Toss', 'Core|Glutes|Shoulders', 'Medicine ball', { perSide: true, substitutions: ['rotational-throw', 'overhead-throw'] }],
], { recommendedSets: 3, recommendedReps: '3–5 reps', rest: 90, goals: ['Power', 'Volleyball'], cues: ['Use a light ball and an approved target.', 'Reset fully; make each rep fast.'], mistakes: ['Choosing a ball that slows the movement.', 'Turning power work into a fatigue circuit.'] });
family('Power', 'Explosive hinge', 'High-speed hip force production', 'Explosive takeoff power', [
  ['trap-bar-jump', 'Trap Bar Jump', 'Glutes|Quads|Calves', 'Trap bar', { difficulty: 'Advanced', substitutions: ['squat-jump', 'countermovement-jump'], cues: ['Use a light load and clear landing area.', 'Jump fast, land quietly and reset.'], mistakes: ['Loading so heavily that speed falls.', 'Rushing landings.'] }],
  ['kettlebell-swing', 'Kettlebell Swing', 'Glutes|Hamstrings|Core', 'Kettlebell', { difficulty: 'Intermediate', recommendedReps: '6–8 reps', substitutions: ['scoop-toss', 'trap-bar-jump'], cues: ['Hinge and snap the hips.', 'Let the arms guide the bell.'] }],
], { recommendedSets: 3, recommendedReps: '3–5 reps', rest: 120, goals: ['Power', 'Jump'] });
family('Plyometric', 'Vertical jump', 'Vertical takeoff power', 'Volleyball jumping quality', [
  ['countermovement-jump', 'Countermovement Jump', 'Quads|Glutes|Calves', 'Bodyweight', { legacyKeys: ['cmj'], aliases: ['Standing Jump'], measurement: 'height', substitutions: ['squat-jump', 'arm-swing-jump', 'box-jump'] }],
  ['approach-jump', 'Approach Jump', 'Quads|Glutes|Calves', 'Bodyweight', { legacyKeys: ['approach-jump'], measurement: 'touch', substitutions: ['arm-swing-jump', 'countermovement-jump'], primaryBenefit: 'Approach timing and volleyball takeoff' }],
  ['arm-swing-jump', 'Arm-Swing Jump', 'Quads|Glutes|Calves', 'Bodyweight', { legacyKeys: ['arm-swing-jump'], substitutions: ['countermovement-jump', 'approach-jump'], primaryBenefit: 'Arm-swing timing for a higher takeoff' }],
  ['block-jump', 'Block Jump', 'Quads|Glutes|Calves', 'Bodyweight', { measurement: 'height', substitutions: ['countermovement-jump', 'squat-jump'], primaryBenefit: 'Quick two-foot blocking takeoff' }],
  ['squat-jump', 'Squat Jump', 'Quads|Glutes|Calves', 'Bodyweight', { measurement: 'height', substitutions: ['countermovement-jump', 'box-jump'] }],
  ['box-jump', 'Box Jump', 'Quads|Glutes|Calves', 'Box', { substitutions: ['countermovement-jump', 'squat-jump'], cues: ['Choose a low, stable box.', 'Land quietly and step down.'], mistakes: ['Chasing box height by tucking the knees.', 'Jumping down repeatedly.'] }],
], { mode: 'bodyweight', recommendedSets: 3, recommendedReps: '2–3 reps', rest: 120, goals: ['Jump', 'Power', 'Volleyball'], cues: ['Jump with maximal intent.', 'Land under control and fully reset.'], mistakes: ['Adding reps after jump height drops.', 'Ignoring landing quality.'] });
family('Plyometric', 'Horizontal jump', 'Horizontal takeoff power', 'First-step and approach force', [
  ['broad-jump', 'Broad Jump', 'Glutes|Quads|Calves', 'Bodyweight', { legacyKeys: ['broad-jump'], measurement: 'distance', substitutions: ['lateral-bound', 'countermovement-jump'] }],
  ['lateral-bound', 'Lateral Bound', 'Glutes|Quads|Calves', 'Bodyweight', { perSide: true, difficulty: 'Intermediate', substitutions: ['broad-jump', 'lateral-hop'], primaryBenefit: 'Lateral push-off and landing control' }],
], { mode: 'bodyweight', recommendedSets: 3, recommendedReps: '2–3 reps', rest: 120, goals: ['Jump', 'Power'], cues: ['Drive fast, then stick the landing.', 'Reset before the next jump.'], mistakes: ['Falling forward on landing.', 'Chasing distance when control drops.'] });
family('Plyometric', 'Reactive ankle', 'Reactive ankle stiffness', 'Quick ground contact for court movement', [
  ['pogo-jump', 'Pogo Jump', 'Calves|Tibialis', 'Bodyweight', { legacyKeys: ['pogo'], aliases: ['Easy Pogo'], substitutions: ['jump-rope', 'low-hurdle-hop'] }],
  ['jump-rope', 'Jump Rope', 'Calves|Core', 'Jump rope', { recommendedReps: '15–20 sec', substitutions: ['pogo-jump'] }],
  ['low-hurdle-hop', 'Low Hurdle Hop', 'Calves|Quads', 'Hurdles', { difficulty: 'Intermediate', substitutions: ['pogo-jump', 'lateral-hop'] }],
  ['lateral-hop', 'Lateral Line Hop', 'Calves|Glutes', 'Bodyweight', { substitutions: ['pogo-jump', 'low-hurdle-hop'] }],
], { mode: 'timed', recommendedSets: 2, recommendedReps: '10–15 sec', rest: 60, goals: ['Jump', 'Power'], cues: ['Keep contacts quick and quiet.', 'Stop when the spring or rhythm fades.'], mistakes: ['Turning short contacts into deep squats.', 'Continuing through Achilles pain.'] });
family('Power', 'Horizontal push', 'Explosive pushing power', 'Fast upper-body force production', [
  ['explosive-push-up', 'Explosive Push-up', 'Chest|Triceps|Core', 'Bodyweight', { aliases: ['Plyometric Push-up'], mode: 'bodyweight', difficulty: 'Intermediate', recommendedSets: 2, substitutions: ['chest-pass', 'push-up'], recommendedReps: '3 reps', rest: 90, cues: ['Drive up as fast as possible; no clap is needed.', 'Land with soft elbows and reset.'] }],
]);
family('Speed', 'Acceleration', 'First-step speed and rhythm', 'Faster court movement', [
  ['acceleration-sprint', '10 m Acceleration', 'Glutes|Quads|Calves', 'Open space', { difficulty: 'Intermediate', recommendedReps: '3 sec', substitutions: ['sled-push', 'a-skip'], cues: ['Push the ground away.', 'Recover fully between fast efforts.'] }],
  ['lateral-shuffle', 'Lateral Shuffle', 'Glutes|Quads|Calves', 'Open space', { recommendedReps: '5–8 sec', substitutions: ['crossover-step', 'lateral-hop'], primaryBenefit: 'Quick lateral court positioning' }],
  ['crossover-step', 'Crossover Step Drill', 'Glutes|Quads|Calves', 'Open space', { recommendedReps: '5–8 sec', substitutions: ['lateral-shuffle'], primaryBenefit: 'Covering court distance efficiently' }],
  ['a-skip', 'A-Skip', 'Hip flexors|Calves|Core', 'Open space', { recommendedReps: '10 sec', substitutions: ['acceleration-sprint', 'band-hip-flexion'], primaryBenefit: 'Knee-drive rhythm and foot placement' }],
  ['sled-push', 'Light Sled Push', 'Glutes|Quads|Calves', 'Sled', { mode: 'weight', recommendedReps: '5–8 sec', substitutions: ['acceleration-sprint'], primaryBenefit: 'Acceleration force with a forward lean' }],
  ['penultimate-step', 'Penultimate Step Drill', 'Quads|Glutes|Calves', 'Bodyweight', { mode: 'bodyweight', recommendedReps: '3 reps', legacyKeys: ['penultimate-step'], substitutions: ['arm-swing-jump', 'approach-jump'], primaryBenefit: 'Efficient final steps into a volleyball jump' }],
], { mode: 'timed', recommendedSets: 3, rest: 90, goals: ['Speed', 'Volleyball'], cues: ['Move fast with clean foot placement.', 'Rest fully before speed drops.'], mistakes: ['Turning speed work into conditioning.', 'Rushing changes of direction.'] });

family('Mobility', 'Ankle mobility', 'Ankle range for controlled takeoff', 'Comfortable squat and landing positions', [
  ['ankle-knee-to-wall', 'Ankle Knee-to-Wall', 'Calves|Ankles', 'Wall', { legacyKeys: ['ankle-wall'], substitutions: ['soleus-stretch'], cues: ['Keep the heel down.', 'Track the knee over the toes.'] }],
]);
family('Mobility', 'Hip mobility', 'Comfortable hip movement', 'Controlled court and lower-body positions', [
  ['hip-switch', '90/90 Hip Switch', 'Glutes|Hips', 'Mat', { legacyKeys: ['hip-switch'], substitutions: ['cossack-squat', 'leg-swings'] }],
  ['leg-swings', 'Leg Swings', 'Hip flexors|Hamstrings|Glutes', 'Wall', { legacyKeys: ['leg-swings'], substitutions: ['hip-switch', 'walking-lunge-rotation'] }],
  ['walking-lunge-rotation', 'Walking Lunge + Rotation', 'Hip flexors|Glutes|Back', 'Bodyweight', { legacyKeys: ['lunge-rotation'], substitutions: ['worlds-greatest-stretch', 'hip-switch'] }],
  ['cossack-squat', 'Cossack Squat', 'Adductors|Glutes|Quads', 'Bodyweight', { substitutions: ['lateral-lunge', 'hip-switch'] }],
  ['worlds-greatest-stretch', 'World’s Greatest Stretch', 'Hip flexors|Hamstrings|Back', 'Mat', { substitutions: ['walking-lunge-rotation', 'thoracic-rotation'] }],
], { mode: 'bodyweight', perSide: true, recommendedSets: 2, recommendedReps: '6–8 reps', rest: 30, cues: ['Use a comfortable range.', 'Move slowly and breathe.'], mistakes: ['Forcing the end of the range.', 'Moving through joint pain.'] });
family('Mobility', 'Thoracic mobility', 'Upper-back movement', 'Comfortable overhead mechanics', [
  ['thoracic-rotation', 'Thoracic Rotation', 'Back|Core', 'Mat', { legacyKeys: ['thoracic-rotation'], perSide: true, substitutions: ['open-book', 'thoracic-extension'] }],
  ['open-book', 'Open Book Rotation', 'Back|Chest', 'Mat', { perSide: true, substitutions: ['thoracic-rotation'] }],
  ['thoracic-extension', 'Thoracic Extension on Roller', 'Back', 'Foam roller', { substitutions: ['thoracic-rotation', 'wall-slide'] }],
], { mode: 'bodyweight', recommendedSets: 2, recommendedReps: '6–8 reps', rest: 30, cues: ['Move through the upper back.', 'Keep the ribs controlled; breathe easily.'] });
family('Stability', 'Scapular control', 'Shoulder-blade control', 'Shoulder capacity for overhead work', [
  ['wall-slide', 'Wall Slide', 'Shoulders|Back', 'Wall', { legacyKeys: ['wall-slide'], substitutions: ['scapular-push-up', 'band-pull-apart'] }],
  ['scapular-push-up', 'Scapular Push-up', 'Shoulders|Core', 'Bodyweight', { substitutions: ['wall-slide', 'band-pull-apart'] }],
  ['band-pull-apart', 'Band Pull-apart', 'Shoulders|Back', 'Band', { substitutions: ['face-pull', 'wall-slide'] }],
], { mode: 'bodyweight', recommendedSets: 2, recommendedReps: '8–12 reps', rest: 45, cues: ['Let the shoulder blades move.', 'Avoid shrugging or flaring the ribs.'] });
family('Stability', 'Hip stability', 'Hip and knee control', 'Stable single-leg landings', [
  ['lateral-band-walk', 'Lateral Band Walk', 'Glutes', 'Band', { substitutions: ['clamshell', 'single-leg-balance'] }],
  ['clamshell', 'Clamshell', 'Glutes', 'Band|Mat', { perSide: true, substitutions: ['lateral-band-walk'] }],
  ['single-leg-balance', 'Single-Leg Balance', 'Glutes|Ankles|Core', 'Bodyweight', { mode: 'timed', perSide: true, recommendedReps: '20–30 sec', substitutions: ['single-leg-rdl', 'lateral-band-walk'] }],
  ['adductor-squeeze', 'Adductor Ball Squeeze', 'Adductors', 'Ball', { mode: 'timed', recommendedReps: '15–20 sec', substitutions: ['copenhagen-plank'] }],
], { mode: 'bodyweight', recommendedSets: 2, recommendedReps: '10–15 reps', rest: 45 });
family('Recovery', 'Stretch', 'Restore comfortable range', 'Easy recovery without added fatigue', [
  ['gastrocnemius-stretch', 'Gastrocnemius Stretch', 'Calves', 'Wall', { legacyKeys: ['stretch-gastroc'], substitutions: ['soleus-stretch'], cues: ['Keep the back knee straight and heel down.', 'Hold a gentle stretch.'] }],
  ['soleus-stretch', 'Soleus Stretch', 'Calves', 'Wall', { legacyKeys: ['stretch-soleus'], substitutions: ['gastrocnemius-stretch', 'ankle-knee-to-wall'], cues: ['Bend the back knee slightly.', 'Keep the heel down.'] }],
  ['hip-flexor-stretch', 'Hip Flexor Stretch', 'Hip flexors', 'Mat', { legacyKeys: ['stretch-hip-flexor'], substitutions: ['walking-lunge-rotation'] }],
  ['hamstring-stretch', 'Hamstring Stretch', 'Hamstrings', 'Mat', { legacyKeys: ['stretch-hamstring'], substitutions: ['leg-swings'] }],
  ['glute-stretch', 'Glute Stretch', 'Glutes', 'Mat', { legacyKeys: ['stretch-glute'], substitutions: ['hip-switch'] }],
  ['lat-stretch', 'Lat Stretch', 'Back', 'Bench', { legacyKeys: ['stretch-lat'], substitutions: ['thoracic-rotation'] }],
  ['pec-stretch', 'Pec Stretch', 'Chest|Shoulders', 'Doorway', { legacyKeys: ['stretch-pec'], substitutions: ['open-book'] }],
], { mode: 'timed', perSide: true, recommendedSets: 1, recommendedReps: '20–40 sec', rest: 15, goals: ['Recovery', 'Mobility'], cues: ['Use gentle tension.', 'Breathe without forcing the stretch.'], mistakes: ['Bouncing into the stretch.', 'Forcing range through pain.'] });
family('Recovery', 'Aerobic recovery', 'Easy movement for recovery', 'Maintain capacity with low fatigue', [
  ['easy-walk', 'Easy walk', 'Legs', 'Open space', { legacyKeys: ['walk'], substitutions: ['easy-cycle'], recommendedReps: '20–30 min' }],
  ['easy-cycle', 'Easy Cycling', 'Quads|Glutes', 'Bicycle', { substitutions: ['easy-walk'], recommendedReps: '15–25 min' }],
  ['recovery-mobility', 'Ankle, hip & thoracic mobility', 'Ankles|Hips|Back', 'Mat', { legacyKeys: ['mobility'], substitutions: ['hip-switch', 'thoracic-rotation'], recommendedReps: '10–15 min' }],
], { mode: 'timed', recommendedSets: 1, rest: 0, cues: ['Keep the effort conversational.', 'Finish feeling better, not drained.'], mistakes: ['Turning recovery into a hard workout.', 'Pushing through worsening pain.'] });
family('Mobility', 'Preparation', 'Prepare the next movement', 'Build range and confidence before loading', [
  ['bodyweight-squat', 'Bodyweight Squat', 'Quads|Glutes', 'Bodyweight', { legacyKeys: ['bw-squat'], substitutions: ['goblet-squat'], recommendedReps: '8 reps' }],
  ['progressive-jumps', 'Progressive Jumps', 'Quads|Glutes|Calves', 'Bodyweight', { legacyKeys: ['progressive-jumps'], substitutions: ['countermovement-jump'], recommendedReps: '3 reps', primaryBenefit: 'Build gradually toward fast takeoffs', secondaryBenefit: 'Prepare landing and jump coordination' }],
  ['light-squat-hinge', 'Light Squat / Hinge Warm-up', 'Quads|Glutes|Hamstrings', 'Bodyweight|Dumbbell', { legacyKeys: ['ramp-lower'], substitutions: ['bodyweight-squat', 'dumbbell-rdl'], recommendedReps: '6–8 reps' }],
  ['light-pulldown-press', 'Light Pulldown / Press', 'Back|Chest|Shoulders', 'Cable|Machine', { legacyKeys: ['ramp-upper'], mode: 'weight', substitutions: ['neutral-lat-pulldown', 'machine-chest-press'], recommendedReps: '8 reps' }],
], { mode: 'bodyweight', recommendedSets: 2, rest: 30, cues: ['Start light and build gradually.', 'Keep the warm-up easy.'] });
family('Sport', 'Volleyball', 'Sport-specific skill and performance', 'Practice movement, timing and court decisions', [
  ['volleyball', 'Volleyball practice', 'Legs|Shoulders|Core', 'Court|Volleyball', { legacyKeys: ['volleyball'], mode: 'timed', recommendedSets: 1, recommendedReps: '120 min', rest: 0, cues: ['Arrive warmed up and fuelled.', 'Adjust extra jump work to the practice load.'], mistakes: ['Adding hard leg work when already fatigued.', 'Ignoring a drop in landing control.'] }],
  ['volleyball-match', 'Volleyball match', 'Legs|Shoulders|Core', 'Court|Volleyball', { mode: 'timed', recommendedSets: 1, recommendedReps: 'Log actual min', rest: 0, cues: ['Competition takes priority; prepare and follow your team coach.', 'Record the actual duration once after playing.'], mistakes: ['Adding a heavy lower session or extra jumps after the match.', 'Counting the same match again as a separate activity.'] }],
]);

family('Strength', 'Horizontal pull', 'Back thickness and scapular control', 'Stable pulling for upper-body development', [
  ['high-row-machine', 'High Row Machine', 'Back|Biceps', 'Machine', { substitutions: ['chest-supported-row', 'cable-row'], cues: ['Keep the chest supported.', 'Drive elbows down and back without shrugging.'], mistakes: ['Rocking off the pad.', 'Shrugging to finish the pull.'] }],
  ['one-arm-cable-row', 'One-Arm Cable Row', 'Back|Biceps|Core', 'Cable', { perSide: true, substitutions: ['cable-row', 'chest-supported-row'], cues: ['Keep ribs and pelvis still.', 'Pull the elbow back; return slowly.'] }],
]);
family('Strength', 'Horizontal push', 'Upper-chest strength and muscle', 'Controlled pressing for upper-body development', [
  ['incline-machine-press', 'Incline Machine Press', 'Chest|Shoulders|Triceps', 'Machine', { aliases: ['Low-Incline Machine Press'], substitutions: ['incline-dumbbell-press', 'machine-chest-press'], cues: ['Set handles around the upper chest.', 'Keep the upper back supported and press smoothly.'], mistakes: ['Shrugging into the press.', 'Lifting the back to finish reps.'] }],
]);
family('Strength', 'Single-leg squat', 'Single-leg strength and stability', 'Takeoff and landing control', [
  ['smith-bulgarian', 'Smith Machine Bulgarian Split Squat', 'Quads|Glutes', 'Smith machine|Bench', { perSide: true, substitutions: ['bulgarian-split-squat', 'split-squat'], cues: ['Start with the left leg; match both sides.', 'Use a low rear-foot support; load the front leg.'], mistakes: ['Pushing off the back leg.', 'Adding extra reps only to the stronger side.'] }],
]);
family('Strength', 'Hip extension', 'Hip-extension force and glute strength', 'Supporting takeoff strength', [
  ['hip-thrust-machine', 'Hip Thrust Machine', 'Glutes|Hamstrings', 'Machine', { substitutions: ['hip-thrust', 'glute-bridge'], cues: ['Brace with ribs down.', 'Extend the hips without arching the low back.'], mistakes: ['Finishing with the lumbar spine.', 'Bouncing through the bottom.'] }],
]);
family('Plyometric', 'Reactive jump', 'Quick ground contact and vertical rebound', 'Reactive takeoff for volleyball', [
  ['drop-jump', 'Drop Jump', 'Calves|Quads|Glutes', 'Low box', { aliases: ['Low-box Drop Jump'], difficulty: 'Intermediate', recommendedSets: 2, rest: 120, primaryBenefit: 'Reactive strength and rapid rebound', substitutions: ['step-down-landing', 'pogo-jump', 'low-hurdle-hop'], cues: ['Begin around 15–20 cm; learn a step-down landing first if unfamiliar.', 'Step off, rebound vertically and stop if contact or landing control worsens.'], mistakes: ['Jumping up off the box.', 'Increasing box height automatically or chasing fatigue.'] }],
], { mode: 'bodyweight', recommendedSets: 3, recommendedReps: '2 reps', rest: 150 });
family('Core', 'Anti-extension', 'Trunk control without low-back sag', 'Force transfer with controlled ribs and pelvis', [
  ['body-saw', 'Body Saw', 'Core|Shoulders', 'Sliders|Mat', { substitutions: ['ab-wheel', 'plank'], cues: ['Start in a forearm plank.', 'Move only as far as the ribs and pelvis stay controlled.'], mistakes: ['Letting the low back sag.', 'Moving farther than you can brace.'] }],
], { mode: 'bodyweight', recommendedReps: '6–10 reps', rest: 60 });
family('Stability', 'Foot control', 'Foot intrinsic control', 'Stable tripod contact', [
  ['short-foot', 'Short-Foot', 'Feet', 'Bodyweight', { cues: ['Keep heel and both toe bases down.', 'Gently shorten the arch without curling toes.'], mistakes: ['Gripping with the toes.', 'Rolling to the outside edge of the foot.'], substitutions: ['single-leg-balance'] }],
], { mode: 'timed', recommendedSets: 2, recommendedReps: '20 sec', perSide: true, rest: 30 });
family('Mobility', 'Breathing', 'Rib and pelvis control', 'A calm start to lower-body training', [
  ['90-90-breathing', '90/90 Breathing', 'Core', 'Mat|Wall', { cues: ['Rest feet on a wall with hips and knees bent.', 'Exhale gently and let the ribs settle.'], mistakes: ['Forcing a maximal breath.', 'Arching the low back.'], substitutions: ['dead-bug'] }],
], { mode: 'bodyweight', recommendedSets: 1, recommendedReps: '4 breaths', rest: 0 });
family('Speed', 'Approach technique', 'Approach rhythm and acceleration', 'Convert run-up speed into a tall takeoff', [
  ['slow-approach-rhythm', 'Slow L-R-L Rhythm', 'Legs|Core', 'Court', { cues: ['Use your normal takeoff pattern; mirror the example if needed.', 'Build speed into a longer penultimate and quick plant.'], mistakes: ['Forcing the wrong foot pattern.', 'Rushing before the rhythm is controlled.'], substitutions: ['penultimate-step'] }],
], { mode: 'bodyweight', recommendedSets: 2, recommendedReps: '3 reps', rest: 45 });
family('Mobility', 'Lunge mobility', 'Hip mobility with trunk control', 'Prepare a stable approach and landing', [
  ['walking-lunge-reach', 'Walking Lunge + Reach', 'Hip flexors|Glutes|Core', 'Bodyweight', { cues: ['Take a comfortable lunge step.', 'Reach tall without arching the low back.'], mistakes: ['Forcing a deep stride.', 'Losing control of the ribs and pelvis.'], substitutions: ['walking-lunge-rotation', 'hip-switch'] }],
], { mode: 'bodyweight', perSide: true, recommendedReps: '5 reps', recommendedSets: 1, rest: 30 });
family('Strength', 'Hip adduction', 'Adductor strength and control', 'Supporting lateral court movement', [
  ['adductor-machine', 'Adductor Machine', 'Adductors', 'Machine', { cues: ['Keep the pelvis supported.', 'Close and reopen the legs slowly through a comfortable range.'], mistakes: ['Bouncing at end range.', 'Forcing a painful stretch.'], substitutions: ['copenhagen-plank'] }],
], { recommendedSets: 2, recommendedReps: '10–15 reps', rest: 60 });

// V8.1 movements are separate identities when their loading or intent differs.
family('Strength', 'Vertical push', 'Shoulder strength and unilateral stability', 'Controlled overhead force production', [
  ['single-arm-neutral-db-press', 'Single-arm Neutral-grip Dumbbell Shoulder Press', 'Shoulders|Triceps|Core', 'Dumbbell|Bench', { aliases: ['Single-Arm Neutral-Grip Dumbbell Shoulder Press'], perSide: true, recommendedSets: 2, recommendedReps: '6–8 reps', rest: 90, substitutions: ['dumbbell-shoulder-press', 'machine-shoulder-press', 'landmine-press'], cues: ['Hold one dumbbell with palm facing inward and ribs over the pelvis.', 'Press through a comfortable range; keep the other side quiet.'], mistakes: ['Leaning or rotating to finish the press.', 'Pushing through shoulder pain.'] }],
]);
family('Power', 'Vertical jump', 'Explosive upward force with a light load', 'Takeoff and landing quality', [
  ['light-dumbbell-squat-jump', 'Light Dumbbell Squat Jump', 'Quads|Glutes|Calves', 'Dumbbell', { difficulty: 'Intermediate', recommendedSets: 2, recommendedReps: '3 reps', rest: 120, substitutions: ['countermovement-jump', 'squat-jump'], cues: ['Use bodyweight first; 2–4 kg per hand only with consistent landings.', 'Jump upward fast, land softly and reset; log both dumbbells combined in kg.'], mistakes: ['Adding load when height or coordination falls.', 'Treating power work as a continuous fatigue circuit.'] }],
], { goals: ['Power', 'Jump', 'Volleyball'] });
family('Core', 'Anti-rotation', 'Anti-rotation trunk stability', 'Steady force transfer without twisting', [
  ['pallof-isometric-hold', 'Pallof Press Isometric Hold', 'Core', 'Cable|Band', { perSide: true, recommendedSets: 2, recommendedReps: '20 sec', rest: 60, mode: 'timed', substitutions: ['pallof-press', 'side-plank', 'bird-dog'], cues: ['Stand side-on, brace and hold the handle in front of the chest.', 'Breathe throughout the hold; keep hips and shoulders facing forward.'], mistakes: ['Twisting toward the anchor.', 'Holding your breath or arching the lower back.'] }],
]);
family('Plyometric', 'Single-leg jump', 'Single-leg takeoff and landing control', 'Low-volume unilateral explosive work', [
  ['split-squat-jump', 'Split-squat Jump', 'Quads|Glutes|Calves', 'Bodyweight', { mode: 'bodyweight', perSide: true, difficulty: 'Intermediate', recommendedSets: 2, recommendedReps: '2 reps', rest: 120, substitutions: ['split-squat', 'countermovement-jump'], cues: ['Start in a balanced split stance at bodyweight.', 'Jump up, land in the same stance under control and reset before each rep.'], mistakes: ['Adding load or repetitions before landing control is consistent.', 'Continuing after coordination or jump height falls.'] }],
], { goals: ['Jump', 'Power', 'Volleyball'] });
family('Stability', 'Scapular control', 'Serratus and scapular control', 'Controlled shoulder-blade movement', [
  ['push-up-plus', 'Push-up Plus', 'Shoulders|Chest|Core', 'Bodyweight', { mode: 'bodyweight', recommendedSets: 2, recommendedReps: '10–12 reps', rest: 60, substitutions: ['scapular-push-up', 'wall-slide'], cues: ['Keep a straight trunk and comfortable hand position.', 'At the top, push the floor away so shoulder blades move around the ribs.'], mistakes: ['Shrugging the shoulders toward the ears.', 'Sagging through the lower back.'] }],
]);
family('Stability', 'Landing', 'Controlled landing preparation', 'Stable hips, knees and ankles before jumping', [
  ['snap-down-landing', 'Snap-down Landing', 'Quads|Glutes|Calves', 'Bodyweight', { mode: 'bodyweight', recommendedSets: 1, recommendedReps: '3 reps', rest: 60, substitutions: ['step-down-landing', 'bodyweight-squat'], cues: ['Stand tall, then quickly lower into a shallow athletic stance.', 'Keep feet planted and knees tracking over toes; settle quietly.'], mistakes: ['Jumping into the drill before landing mechanics are consistent.', 'Letting knees collapse inward.'] }],
  ['step-down-landing', 'Step-down Landing', 'Quads|Glutes|Calves', 'Low box', { mode: 'bodyweight', recommendedSets: 2, recommendedReps: '2 reps', rest: 90, substitutions: ['snap-down-landing', 'bodyweight-squat'], cues: ['Use a low stable 15–20 cm step with a clear landing area.', 'Step off without jumping up, land softly and hold; do not rebound.'], mistakes: ['Using a high box before control is established.', 'Bouncing immediately instead of owning the landing.'] }],
]);
family('Mobility', 'Dynamic preparation', 'Comfortable full-body movement', 'Easy preparation without meaningful fatigue', [
  ['light-dynamic-mobility', 'Light Dynamic Mobility', 'Shoulders|Hips|Ankles', 'Bodyweight', { mode: 'timed', recommendedSets: 1, recommendedReps: '2–3 min', rest: 0, substitutions: ['walking-lunge-reach', 'wall-slide', 'ankle-knee-to-wall'], cues: ['Move shoulders, hips and ankles through a comfortable range.', 'Keep the effort easy and breathe normally.'], mistakes: ['Forcing end ranges or bouncing into discomfort.', 'Turning a short primer into a fatiguing workout.'] }],
]);
const masterAliases: Record<string, string[]> = {
  'pull-up': ['Pull-Up / Assisted Pull-Up'], 'arm-swing-jump': ['CMJ with Arm Swing'],
  'landmine-press': ['Half-Kneeling Landmine Press'], 'low-hurdle-hop': ['Hurdle Hops'],
  'ab-wheel': ['Ab Wheel'], 'lateral-band-walk': ['Mini-Band Lateral Walk'],
  'incline-machine-press': ['Incline Machine Chest Press', 'Low-incline Chest Press'],
  'biceps-curl': ['Dumbbell Biceps Curl'], 'slow-approach-rhythm': ['Slow L-R-L Approach Rhythm'],
  'short-foot': ['Short-Foot Hold'], 'pogo-jump': ['Light Pogos'],
  'spike-slam': ['Light Medicine Ball Spike Slam'],
};
for (const item of catalogue) if (masterAliases[item.id]) item.aliases = [...(item.aliases ?? []), ...masterAliases[item.id]];
for (const item of catalogue) {
  if (['approach-jump', 'countermovement-jump', 'arm-swing-jump', 'block-jump', 'squat-jump', 'box-jump', 'drop-jump', 'light-dumbbell-squat-jump', 'low-hurdle-hop'].includes(item.id)) item.jumpContactsPerRep = 1;
  if (item.id === 'split-squat-jump') item.jumpContactsPerRep = 2;
}
catalogue.find(item => item.id === 'ab-wheel')!.substitutions.unshift('body-saw');
catalogue.find(item => item.id === 'copenhagen-plank')!.substitutions.unshift('adductor-machine');

// Keep the original app's movement identity so new library entries can find old history.
// The generic pulldown gets a new ID; the existing neutral-grip movement owns lat-pulldown.
const canonicalIds = new Map(catalogue.map(item => [item.id, item.id === 'lat-pulldown' ? 'standard-lat-pulldown' : item.legacyKeys?.[0] ?? item.id]));
for (const item of catalogue) {
  item.id = canonicalIds.get(item.id)!;
  item.substitutions = item.substitutions.map(id => canonicalIds.get(id) ?? id);
  if (item.goals.includes('Muscle') && !item.goals.includes('Hypertrophy')) item.goals.push('Hypertrophy');
}

export const EXERCISE_CATALOGUE: readonly LibraryExercise[] = catalogue;
export const EXERCISE_CATEGORIES: readonly ExerciseCategory[] = ['Strength', 'Hypertrophy', 'Power', 'Plyometric', 'Speed', 'Mobility', 'Core', 'Stability', 'Recovery', 'Sport'];
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[–—−]/g, '-').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const idIndex = new Map(catalogue.map(item => [item.id, item]));
const nameIndex = new Map(catalogue.flatMap(item => [item.name, ...(item.aliases ?? [])].map(name => [normalize(name), item] as const)));

/** Exact names beat legacy keys; a renamed custom movement must not inherit unrelated advice. */
export function findLibraryExercise(exercise: ExerciseReference | string): LibraryExercise | undefined {
  if (typeof exercise === 'string') return idIndex.get(exercise) ?? nameIndex.get(normalize(exercise));
  const byName = exercise.name ? nameIndex.get(normalize(exercise.name)) : undefined;
  if (byName) return byName;
  if (exercise.exerciseId) return idIndex.get(exercise.exerciseId);
  if (exercise.name?.trim()) return undefined;
  return catalogue.find(item => item.id === exercise.key || item.legacyKeys?.includes(exercise.key ?? ''));
}

export function searchExercises(query = '', filters: LibraryFilters = {}): LibraryExercise[] {
  const words = normalize(query).split(' ').filter(Boolean);
  return catalogue.filter(item => {
    if (filters.muscle && !item.muscles.includes(filters.muscle)) return false;
    if (filters.goal && !item.goals.includes(filters.goal)) return false;
    if (filters.equipment && !item.equipment.includes(filters.equipment)) return false;
    if (filters.movement && item.movement !== filters.movement) return false;
    if (filters.type && item.category !== filters.type) return false;
    const text = normalize([item.name, ...(item.aliases ?? []), ...item.muscles, item.category, item.movement, ...item.goals, ...item.equipment, item.primaryBenefit].join(' '));
    return words.every(word => text.includes(word));
  }).sort((a, b) => {
    const exactA = normalize(a.name).startsWith(normalize(query)) ? 1 : 0;
    const exactB = normalize(b.name).startsWith(normalize(query)) ? 1 : 0;
    return exactB - exactA || a.name.localeCompare(b.name);
  });
}

export interface ExerciseAlternative { exercise: LibraryExercise; score: number; tradeoff: string }
function alternativeNote(source: LibraryExercise, candidate: LibraryExercise): string {
  if (source.id === 'leg-press' && candidate.id === 'trap-bar-deadlift') return 'More technique and trunk demand. Learn the 20 kg empty bar first; replace Leg Press rather than adding another lift.';
  if (source.id === 'drop-jump' && candidate.id === 'step-down-landing') return 'Landing preparation without a rebound; useful before unfamiliar drop jumps.';
  if (candidate.id === 'barbell-row') return 'Similar back work; more lower-back fatigue and trunk demand.';
  if (candidate.id === 'one-arm-dumbbell-row') return 'More unilateral demand; support the free hand for stability.';
  if (candidate.id === 'seal-row' && source.movement === 'Horizontal pull') return 'Very similar back stimulus with full chest support.';
  if (candidate.id === 'cable-row' && source.movement === 'Horizontal pull') return 'Similar back stimulus; brace the trunk without chest support.';
  if (candidate.id === 'leg-press') return 'Similar quad stimulus with support; less whole-body demand.';
  if (candidate.id === 'nordic-curl') return 'More eccentric demand; use assistance and introduce gradually.';
  if (candidate.id === 'assisted-pull-up') return 'Similar pulling pattern; assistance changes how load is recorded.';
  if (candidate.id === 'pull-up' || candidate.id === 'chin-up') return 'Similar back stimulus; bodyweight loading is less adjustable.';
  if (candidate.category === 'Plyometric' && source.category === 'Power') return 'Keeps fast takeoff intent with no external load.';
  if (candidate.movement !== source.movement) return 'Targets a similar benefit through a different movement pattern.';
  if (candidate.perSide !== source.perSide) return candidate.perSide ? 'Similar muscles with more single-side stability demand.' : 'Similar muscles with a more stable two-sided setup.';
  if (candidate.equipment.includes('Machine')) return 'Similar stimulus with machine support and less balance demand.';
  if (candidate.category === 'Power' || candidate.category === 'Plyometric') return 'Similar explosive intent; keep reps fast and recover fully.';
  if (candidate.mode !== source.mode) return 'Similar movement; the loading and logging method changes.';
  return 'Very similar movement and target muscles; use a comfortable setup.';
}
export function rankAlternatives(reference: ExerciseReference | string, limit = 6): ExerciseAlternative[] {
  const source = findLibraryExercise(reference);
  if (!source) return [];
  const listed = source.substitutions;
  const results = catalogue.filter(candidate => {
    if (candidate.id === source.id) return false;
    if (listed.includes(candidate.id)) return true;
    return candidate.movement === source.movement && candidate.category === source.category && candidate.muscles.some(muscle => source.muscles.includes(muscle));
  }).map(candidate => {
    const explicit = listed.indexOf(candidate.id);
    const score = (explicit >= 0 ? 120 - explicit * 8 : 0) + (candidate.movement === source.movement ? 30 : 0)
      + (candidate.category === source.category ? 15 : 0) + candidate.muscles.filter(muscle => source.muscles.includes(muscle)).length * 4;
    return { exercise: candidate, score, tradeoff: alternativeNote(source, candidate) };
  });
  return results.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name)).slice(0, Math.max(0, limit));
}

/** Every insertion gets a fresh key, including duplicate movements within one session. */
export function toPlanExercise(item: LibraryExercise) {
  return {
    key: `library-${crypto.randomUUID()}`, exerciseId: item.id, name: item.name, group: item.muscles[0],
    sets: item.recommendedSets, target: item.recommendedReps, mode: item.mode, rest: item.rest, perSide: item.perSide,
    cue: item.cues.join(' '), ...(item.measurement ? { measurement: item.measurement } : {}), ...(item.quantityUnit ? { quantityUnit: item.quantityUnit } : {}),
    ...(item.jumpContactsPerRep ? { jumpContactsPerRep: item.jumpContactsPerRep } : {}),
  };
}
