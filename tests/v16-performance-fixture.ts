import { DEFAULT_PROFILE, ExerciseSchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders.ts';

/** Synthetic fixtures belong only in isolated test contexts, never real data. */
export function performanceFixture(completedSets: 1000 | 5000 | 10000, now = new Date()) {
  // Match the app's calendar, including the hour when Berlin is a day ahead of
  // UTC. Otherwise Today would show a previous-day session and invalidate the
  // startup observation without reflecting a performance regression.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  const movements = [
    ['chest-press','Machine Chest Press'], ['cable-row','Seated Cable Row'],
    ['leg-press','Leg Press'], ['leg-curl','Leg Curl'], ['calf-raise','Standing Calf Raise'],
  ].map(([key,name]) => ExerciseSchema.parse({ key, exerciseId:key, name, group:'Strength', mode:'weight',
    sets:4, target:'8 reps', rest:90, perSide:false, note:'', defaultKg:50 }));
  const plan = { name:'Benchmark Training', kind:'strength', minutes:45, note:'Test fixture only.', exercises:movements, warmup:[], cooldown:[] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan:Array.from({length:7},()=>structuredClone(plan)),
    masterProgram:undefined, preMasterPlan:undefined, masterMatchWeekend:undefined });
  const history = Array.from({length:completedSets/20},(_,index) => {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate()-(index+1)*3);
    const date = day.toISOString().slice(0,10);
    const session = SessionSchema.parse(stopSessionTimers(createSession(plan,0,date,profile,[]),'completed'));
    session.name = index === completedSets/20-1 ? 'Benchmark target oldest' : `Benchmark Training ${String(index+1).padStart(3,'0')}`;
    session.startedAt = Date.parse(`${date}T12:00:00Z`);
    session.finishedAt = session.startedAt+45*60_000;
    session.elapsedMs = 45*60_000;
    session.exercises.forEach((exercise,exerciseIndex) => exercise.logs.forEach(log => Object.assign(log,{ done:true, kg:50+exerciseIndex*5+(index%10)*.5, reps:8, rir:2 })));
    return { session:SessionSchema.parse(session), version:1 };
  });
  const activeDay = (new Date(`${today}T12:00:00Z`).getUTCDay()+6)%7;
  const active = SessionSchema.parse(createSession(plan,activeDay,today,profile,[]));
  active.name = 'Benchmark active workout';
  active.runningSince = null;
  active.startedAt = Date.parse(`${today}T12:00:00Z`);
  active.exercises.forEach(exercise => { exercise.runningSince=null; });
  const state = { schemaVersion:1, profile, profileVersion:1, sessions:[{session:active,version:1},...history], nutrition:[], activities:[], reminders:defaultReminderState() };
  return { state, completedSets, completedWorkouts:history.length, today, activeId:active.id, firstExerciseName:movements[0].name };
}
