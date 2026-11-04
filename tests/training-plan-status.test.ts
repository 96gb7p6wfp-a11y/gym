import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { getTrainingPlanStatus, trainingBlockStatus, trainingPlanVersion } from '../src/training-plan-status.ts';

test('V14 app status never implies an upgrade of the saved training prescription', () => {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    masterProgram: { version: 1, revision: '8.1', startDate: '2026-10-05', matchWeeks: [] },
    masterProgramBackup: { savedAt: 1, plan: structuredClone(DEFAULT_PROFILE.plan),
      masterProgram: { version: 1, startDate: '2026-09-07', matchWeeks: [] } },
  });
  const before = structuredClone(profile);
  const status = getTrainingPlanStatus(profile, '2026-11-02', '2026-10-26');
  assert.equal(status.appVersion, 'Setline V16');
  assert.equal(status.planVersion, 'V8.1');
  assert.equal(status.cycle, 'Week 5 of 8 · Build 2');
  assert.equal(status.selected, '2026-10-26 preview · Week 4 of 8 · Deload');
  assert.equal(status.previous, 'Original master plan');
  assert.deepEqual(profile, before);
  assert.equal(trainingPlanVersion({ ...profile.masterProgram!, revision: '13.1' }), 'V13.1');
});

test('block status uses today, labels previews separately and respects both block boundaries', () => {
  const settings = { version: 1 as const, revision: '13.1' as const, startDate: '2026-10-05', matchWeeks: [] };
  assert.equal(trainingBlockStatus(settings, '2026-10-04'), 'Upcoming · starts 2026-10-05');
  assert.equal(trainingBlockStatus(settings, '2026-10-05'), 'Week 1 of 8 · Build 1');
  assert.equal(trainingBlockStatus(settings, '2026-11-29'), 'Week 8 of 8 · Peak / retest');
  assert.equal(trainingBlockStatus(settings, '2026-11-30'), 'Block complete · saved weekly plan continues');
  const profile = ProfileSchema.parse({ ...DEFAULT_PROFILE, masterProgram: settings });
  const status = getTrainingPlanStatus(profile, '2026-10-04', '2026-10-05');
  assert.equal(status.cycle, 'Upcoming · starts 2026-10-05');
  assert.equal(status.selected, '2026-10-05 preview · Week 1 of 8 · Build 1');
  assert.equal(getTrainingPlanStatus(profile, '2026-10-05').selected, null);
});

test('weekly plans without a master version remain honestly identifiable', () => {
  const profile = ProfileSchema.parse(structuredClone(DEFAULT_PROFILE));
  assert.equal(getTrainingPlanStatus(profile, '2026-11-02').planVersion, 'Original weekly plan');
  profile.plan[0].name = 'My personal upper workout';
  const status = getTrainingPlanStatus(profile, '2026-11-02');
  assert.equal(status.planVersion, 'Custom weekly plan');
  assert.equal(status.cycle, 'No eight-week block active');
  assert.equal(status.previous, null);
});
