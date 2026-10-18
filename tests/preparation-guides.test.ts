import assert from 'node:assert/strict';
import test from 'node:test';
import { getExerciseGuide, getExerciseLoadingGuidance } from '../src/exercise-guides.ts';

const preparation = [
  'Easy Walk + Arm Swing', 'Arm Circles', 'Wall Slide', 'Thoracic Rotation',
  'Ankle Knee-to-Wall', '90/90 Hip Switch', 'Bodyweight Squat', 'Unloaded Hip Hinge',
  'Light Rehearsal Sets', 'Short-Foot', 'Jump Ramp-Up',
];
const recovery = [
  'Easy Walk + Breathing', 'Cross-Body Shoulder Stretch', 'Pec Stretch', 'Lat Stretch',
  'Biceps Stretch', 'Triceps Stretch', 'Standing Quad Stretch', 'Hamstring Stretch',
  'Glute Stretch', 'Gastrocnemius Stretch', 'Hip Flexor Stretch', 'Adductor Stretch', '90/90 Breathing',
];

test('all muscle-specific preparation and cool-down links have concise movement-specific technique', () => {
  for (const name of [...preparation, ...recovery]) {
    const guide = getExerciseGuide({ name });
    assert.equal(guide.isGeneric, false, name);
    assert.ok(guide.steps.length >= 2 && guide.steps.length <= 3, name);
    for (const step of guide.steps) assert.ok(step.length <= 160, `${name}: keep cues concise`);
    assert.ok(guide.feel.length > 20, name);
    assert.equal(guide.mistakes.length, 2, name);
    assert.ok(guide.caution.length > 20, name);
    assert.doesNotMatch([...guide.steps, guide.feel, ...guide.mistakes, guide.caution].join(' '),
      /prevent(?:s)? injur|guarantee|speed(?:s)? recovery|remove(?:s)? soreness|flush(?:es)? lactic acid/i, name);
  }
});

test('preparation and recovery keep saved targets without strength progression or RIR prescriptions', () => {
  for (const [names, expected] of [[preparation, 'preparation'], [recovery, 'recovery']] as const) {
    for (const name of names) {
      for (const mode of [undefined, 'bodyweight', 'timed']) {
        const loading = getExerciseLoadingGuidance({ name, mode, target: '20–30 sec / side' });
        assert.equal(loading.category, expected, name);
        assert.equal(loading.target, '20–30 sec / side', name);
        assert.equal(loading.progression, undefined, name);
        assert.doesNotMatch(loading.advice, /reps (?:left|in reserve)|RIR|RPE|weight increment|harder variation|top of your rep range/i, name);
      }
    }
  }
});

test('new shoulder and arm stretches protect comfortable joint range and flag nerve symptoms', () => {
  const shoulder = getExerciseGuide({ name: 'Cross-Body Shoulder Stretch' });
  assert.match(shoulder.feel, /behind the shoulder/);
  assert.match(shoulder.caution, /pinches|painful/);
  const biceps = getExerciseGuide({ name: 'Biceps Stretch' });
  assert.match(biceps.feel, /front of the upper arm/);
  assert.match(biceps.caution, /tingling or numbness/);
  const triceps = getExerciseGuide({ name: 'Triceps Stretch' });
  assert.match(triceps.feel, /back of the upper arm/);
  assert.match(triceps.mistakes.join(' '), /Pulling hard on the elbow/);
});

test('quad and adductor stretches offer support without forceful knee or groin loading', () => {
  const quad = getExerciseGuide({ name: 'Standing Quad Stretch' });
  assert.match(quad.steps[0], /support/);
  assert.match(quad.caution, /knee pain/);
  const adductor = getExerciseGuide({ name: 'Adductor Stretch' });
  assert.match(adductor.feel, /inner-thigh/);
  assert.match(adductor.caution, /shallow and supported/);
  assert.match(adductor.caution, /groin or knee pain/);
});

test('rehearsal is lift-specific practice and unloaded hinges are not loaded RDL instructions', () => {
  const rehearsal = getExerciseGuide({ name: 'Light Rehearsal Sets' });
  assert.match(rehearsal.steps[0], /next strength exercise/);
  assert.match(rehearsal.caution, /Do not take warm-up sets to failure/);
  const hinge = getExerciseGuide({ name: 'Unloaded Hip Hinge' });
  assert.match(hinge.caution, /no added load/);
  assert.match(hinge.mistakes.join(' '), /Rounding the back/);
  assert.notEqual(hinge.steps[0], getExerciseGuide({ name: 'Romanian Deadlift' }).steps[0]);
});

test('breathing and foot practice remain gentle rather than maximal-effort core or calf work', () => {
  const breathing = getExerciseGuide({ name: '90/90 Breathing' });
  assert.match(breathing.steps.join(' '), /Exhale gently/);
  assert.match(breathing.caution, /light-headed/);
  const foot = getExerciseGuide({ name: 'Short-Foot' });
  assert.match(foot.steps.join(' '), /toes long and relaxed/);
  assert.match(foot.mistakes.join(' '), /Curling the toes/);
  assert.equal(getExerciseGuide({ name: '  CROSS–BODY   shoulder stretch ' }).isGeneric, false);
  assert.equal(getExerciseLoadingGuidance({ name: 'Jump Ramp–Up' }).category, 'preparation');
});
