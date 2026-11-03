import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { getTrainingJourney, journeyChange } from '../src/training-journey.ts';
import { getPerformanceSummary } from '../src/performance-insights.ts';
import type { ReportSession } from '../src/weekly-report.ts';
const TODAY='2026-11-03';
function workout(date:string, kg=50, reps=8):ReportSession {
 const base=SessionSchema.parse(stopSessionTimers(createSession(DEFAULT_PROFILE.plan[0],0,date,DEFAULT_PROFILE,[]),'completed'));
 const e=base.exercises[0];
 base.name='Upper';base.kind='strength';base.startedAt=Date.parse(`${date}T12:00:00Z`);
 base.exercises=[{...e,key:'press',name:'Machine Press',mode:'weight',measurement:undefined,quantityUnit:undefined,perSide:false,exerciseId:'press',preparationOnly:undefined,
 logs:e.logs.slice(0,2).map((l,i)=>({...l,id:`${base.id}:${i}`,done:true,kg,reps,rir:2,measurementCm:undefined}))}];
 return SessionSchema.parse(base);
}
const input=(sessions:ReportSession[],range:28|84|'all'=84)=>({sessions,today:TODAY,range});

test('periods use actual dated completed records and all history does not change storage inputs',()=>{
 const old=workout('2026-01-01',40), before=workout('2026-09-01',45), now=workout('2026-10-31',50);
 const sessions=[old,before,now,now,{...now,id:'active',status:'active' as const},{...now,id:'removed',deletedAt:1},{...now,id:'future',date:'2026-11-04'}];
 const copy=JSON.stringify(sessions);
 assert.equal(getTrainingJourney(input(sessions,28)).gymWorkouts,1);
 assert.equal(getTrainingJourney(input(sessions)).gymWorkouts,2);
 assert.equal(getTrainingJourney(input(sessions,'all')).gymWorkouts,3);
 assert.equal(JSON.stringify(sessions),copy);
 assert.equal(getTrainingJourney(input([now,{...now,id:'twice'}])).gymDays,1);
});

test('matched-rep load decline stays negative and different reps, setup, names and preparation stay separate',()=>{
 const a=workout('2026-10-01',60),b=workout('2026-10-20',55),c=workout('2026-10-24',90,1);
 const renamed=workout('2026-10-25',100);renamed.exercises[0].name='Different Press';
 const side=workout('2026-10-26',100);side.exercises[0].perSide=true;
 const prep=workout('2026-10-27',500);prep.exercises[0].preparationOnly=true;
 const result=getTrainingJourney(input([a,b,c,renamed,side,prep]));
 const series=result.series.find(s=>s.name==='Machine Press · 8 reps'&&s.points.length===2)!;
 assert.equal(journeyChange(series)?.delta,-5);
 assert.equal(journeyChange(series)?.percent,-8.33);
 assert.equal(result.series.filter(s=>s.metric==='strength').length,4);
 assert.ok(result.series.every(s=>s.points.every(p=>p.value<500)));
 assert.equal(journeyChange(result.series.find(s=>s.name.includes('1 reps'))!),null);
});

test('zero is a recorded load, missing is unknown and bodyweight/assistance/carry are not invented load trends',()=>{
 const a=workout('2026-10-01',0),b=workout('2026-10-08',2.5);
 const result=getTrainingJourney(input([a,b]));
 assert.equal(result.series[0].points[0].value,0);
 assert.deepEqual(journeyChange(result.series[0])?.percent,null);
 for(const variant of ['bodyweight','assisted','carry','missing']){
  const s=workout('2026-10-15');
  if(variant==='bodyweight')s.exercises[0].mode='bodyweight';
  if(variant==='assisted')s.exercises[0].name='Assisted Pull-Up';
  if(variant==='carry')s.exercises[0].quantityUnit='m';
  if(variant==='missing')s.exercises[0].logs.forEach(l=>l.kg=null);
  assert.equal(getTrainingJourney(input([s])).series.length,0,variant);
 }
});

test('body weight requires adequate in-period weekly samples; profile and out-of-window weights cannot imply gains',()=>{
 const weight=(date:string,kg:number)=>({date,payload:{kind:'weight',kg,notes:''}});
 const records=[weight('2026-10-12',64),weight('2026-10-14',64.5),weight('2026-10-16',65),weight('2026-10-19',65),weight('2026-10-21',65),weight('2026-10-23',65)];
 const result=getTrainingJourney({...input([]),nutritionRecords:records});
 const series=result.series.find(s=>s.metric==='weight')!;
 assert.equal(series.points.length,2);assert.equal(journeyChange(series)?.delta,0.5);
 assert.equal(getTrainingJourney({...input([]),nutritionRecords:records.slice(0,1)}).series.length,0);
 assert.equal(getTrainingJourney({...input([],28),nutritionRecords:[weight('2026-10-05',100),weight('2026-10-07',64),weight('2026-10-09',64)]}).series.length,0);
});

test('jump height, absolute touch and type stay separate; estimates and future readings never enter results',()=>{
 const jump=(date:string,cm:number)=>({id:crypto.randomUUID(),date,type:'approach' as const,measurement:'height' as const,cm,notes:''});
 const result=getTrainingJourney({...input([]),performance:{jumps:[jump('2026-10-01',60),jump('2026-10-20',62),{...jump('2026-10-21',95),source:'video-estimate'},
 {...jump('2026-10-22',305),measurement:'touch'},{...jump('2026-10-22',50),type:'standing'},jump('2026-11-04',99)],readiness:[]}});
 assert.equal(result.series.length,3);
 assert.deepEqual(result.series.find(s=>s.name==='Approach jump height')!.points.map(p=>p.value),[60,62]);
});

test('summary never infers old adherence or picks a rare large gain over the most-observed rep comparison',()=>{
 const a=workout('2026-10-06',60),b=workout('2026-10-20',55);
 a.exercises[0].logs.push({...a.exercises[0].logs[0],id:'one-a',kg:10,reps:1});
 b.exercises[0].logs.push({...b.exercises[0].logs[0],id:'one-b',kg:50,reps:1});
 const summary=getPerformanceSummary({sessions:[a,b],today:TODAY,plan:DEFAULT_PROFILE.plan});
 assert.equal(summary.consistencyPercent,null);assert.equal(summary.gymDays,2);
 assert.equal(summary.strengthChanges[0].reps,8);assert.equal(summary.strengthChanges[0].current,55);
});
