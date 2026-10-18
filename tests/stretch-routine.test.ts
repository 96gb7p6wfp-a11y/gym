import test from 'node:test';
import assert from 'node:assert/strict';
import { getStretchRoutine } from '../src/stretch-routine.ts';
import { DEFAULT_PROFILE, createSession, SessionSchema } from '../src/domain.js';
import { getTrainingCadence } from '../src/training-cadence.ts';

test('empty recovery can save real checked stretches without pretending to complete gym sets', () => {
 const plan = { name:'Recovery', kind:'recovery', minutes:20, note:'Easy movement', exercises:[], cooldown:getStretchRoutine() };
 const session = SessionSchema.parse(createSession(plan,6,'2026-10-25',DEFAULT_PROFILE,[]));
 assert.ok(session.cooldown);
 session.cooldown[1].done=true;
 assert.equal(SessionSchema.safeParse(session).success,true);
 assert.equal(session.kind,'recovery'); assert.deepEqual(session.exercises,[]);
 assert.equal(session.cooldown[1].name,'Hip Flexor Stretch');
 session.status='completed'; session.runningSince=null; session.finishedAt=session.startedAt+600000;
 const cadence=getTrainingCadence({sessions:[session],plan:DEFAULT_PROFILE.plan,today:'2026-10-25'});
 assert.equal(cadence.completedGymDays,0); assert.equal(cadence.recordedActivityDays,1);
});
test('legacy walk-only cooldown gets real stretches without mutating the old record', () => {
 const items=[{key:'walk',name:'Easy Walk + Breathing',target:'3–5 min',cue:'Easy pace',done:true}];
 const before=structuredClone(items), result=getStretchRoutine(items);
 assert.equal(result[0].done,true); assert.ok(result.some(item=>item.name==='Hip Flexor Stretch'));
 assert.deepEqual(items,before); assert.deepEqual(getStretchRoutine(result),result);
});
test('custom cooldown is preserved exactly; an empty guide is fresh on every call', () => {
 const items=[{key:'custom',name:'My shoulder stretch',target:'20 sec',cue:'As advised',done:true}];
 assert.deepEqual(getStretchRoutine(items),items);
 const first=getStretchRoutine(); first[0].done=true;
 assert.equal(getStretchRoutine()[0].done,false);
});
test('supplementing a long legacy routine stays within the saved preparation limit', () => {
 for (const count of [17, 20]) {
  const items=Array.from({length:count},(_,index)=>({key:`walk-${index}`,name:'Easy Walk + Breathing',target:'3 min',cue:'Easy pace',done:index===0}));
  const result=getStretchRoutine(items);
  assert.equal(result.length,20);
  assert.deepEqual(result.slice(0,count),items);
  assert.equal(SessionSchema.safeParse(createSession({...DEFAULT_PROFILE.plan[0],cooldown:result},0,'2026-10-19',DEFAULT_PROFILE,[])).success,true);
 }
});
