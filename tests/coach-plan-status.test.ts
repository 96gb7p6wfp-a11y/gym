import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { getTrainingPlanStatus, trainingBlockStatus } from '../src/training-plan-status.ts';

test('V9 status stays weekly and readiness-led instead of surfacing an old Week 4 reduction', () => {
  const settings = { version: 1 as const, revision: '9' as const, startDate: '2026-10-12', matchWeeks: [4] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), masterProgram: settings });
  const before = structuredClone(profile);
  const status = getTrainingPlanStatus(profile, '2026-11-06', '2026-11-07');
  assert.equal(status.planVersion, 'V9');
  assert.equal(status.cycle, 'Weekly training · readiness-led');
  assert.equal(status.selected, '2026-11-07 preview · Weekly training · readiness-led');
  assert.doesNotMatch(status.cycle + status.selected, /Week 4|Deload|Build|of 8/);
  assert.deepEqual(profile, before);
});

test('V9 historical cycle fields and guidance remain saved behind the weekly presentation', () => {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    masterProgram: { version: 1, revision: '9', startDate: '2026-10-12', matchWeeks: [4], periodizationMode: 'legacy-cycle',
      clearance: { impact: 'restricted', heavyLifting: 'unknown' } },
    masterProgramBackup: { savedAt: 1, plan: structuredClone(DEFAULT_PROFILE.plan),
      masterProgram: { version: 1, revision: '13.1', startDate: '2026-10-05', matchWeeks: [1, 3] } },
  });
  const before = structuredClone(profile);
  const status = getTrainingPlanStatus(profile, '2026-11-07');
  assert.equal(status.cycle, 'Weekly training · readiness-led');
  assert.equal(status.previous, 'V13.1');
  assert.match(status.guidance!, /Impact restricted/);
  assert.match(status.guidance!, /Lifting unconfirmed/);
  assert.deepEqual(profile, before);
});

test('legacy V13.1 cycle status remains available for historical interpretation', () => {
  assert.equal(trainingBlockStatus({ version: 1, revision: '13.1', startDate: '2026-10-12', matchWeeks: [] }, '2026-11-07'), 'Week 4 of 8 · Deload');
  assert.equal(trainingBlockStatus({ version: 1, revision: '9', startDate: '2026-10-12', matchWeeks: [] }, '2027-01-02'), 'Weekly training · readiness-led');
});
