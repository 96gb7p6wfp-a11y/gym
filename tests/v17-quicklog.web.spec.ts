import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ExerciseSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
const STORE='setline.gym.v1';
async function state(page:Page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),STORE);}
const row=(page:Page,name:string)=>page.getByRole('group',{name:`Quick log ${name} set 1`,exact:true});
async function seed(page:Page,theme='light'){
 const exercise=(key:string,name:string,extra={})=>ExerciseSchema.parse({key,name,group:'Training',sets:2,target:'8 reps',mode:'bodyweight',rest:60,perSide:false,...extra});
 const plan={...DEFAULT_PROFILE.plan[0],name:'Isolated mixed logging',warmup:[],cooldown:[],exercises:[
  exercise('bug','Dead Bug',{perSide:true}),exercise('pull','Weighted Pull-Up'),exercise('plank','Plank',{mode:'timed',target:'30 sec'}),
  exercise('hold','Isometric Hold',{mode:'timed',target:'20 sec'}),exercise('ball','Medicine Ball Spike Slam',{mode:'weight',target:'4 reps'}),
  exercise('jump','Approach Jump',{measurement:'touch',target:'1 rep'}),exercise('volley','Volleyball practice',{mode:'timed',target:'120 min'})]};
 const profile={...structuredClone(DEFAULT_PROFILE),appearance:theme,plan:DEFAULT_PROFILE.plan.map((day,index)=>index===0?plan:day)};
 const active=SessionSchema.parse(createSession(plan,0,'2026-11-02',profile,[]));active.runningSince=null;
 active.exercises.forEach((exercise,index)=>exercise.logs.forEach(log=>Object.assign(log,{kg:index===1?12.5:index===4?6:null,reps:exercise.mode==='timed'?null:index===5?1:8,seconds:exercise.mode==='timed'?(index===6?7200:30):null,measurementCm:index===5?315:null,rir:2})));
 const history=SessionSchema.parse(stopSessionTimers(createSession(plan,0,'2026-10-26',profile,[]),'completed'));
 history.exercises=structuredClone(active.exercises).map(exercise=>({...exercise,logs:exercise.logs.map(log=>({...log,id:crypto.randomUUID(),done:true}))}));
 await page.evaluate(({key,profile,active,history})=>{const previous=JSON.parse(localStorage.getItem(key)!);localStorage.setItem(key,JSON.stringify({...previous,profile,profileVersion:1,sessions:[{session:history,version:1},{session:active,version:1}]}));},{key:STORE,profile,active,history});
 await page.reload();await page.getByRole('tab',{name:'Train',exact:true}).click();return {active,history};
}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-02T10:00:00Z')});await page.goto('/');});
for(const width of [320,375,390,430])for(const theme of ['light','dark']){
 test(`Quick Log uses saved exercise types at ${width}px in ${theme}`,async({page})=>{
  await page.setViewportSize({width,height:844});await seed(page,theme);const before=await state(page);
  await page.getByRole('button',{name:'Quick Log',exact:true}).click();
  for(const name of ['Dead Bug','Plank','Isometric Hold','Approach Jump','Volleyball practice'])await expect(row(page,name).getByRole('textbox',{name:/weight in kilograms/})).toHaveCount(0);
  await expect(row(page,'Dead Bug').getByRole('spinbutton',{name:'Dead Bug set 1 reps',exact:true})).toHaveAttribute('inputmode','numeric');
  await expect(row(page,'Weighted Pull-Up').getByRole('textbox',{name:/weight in kilograms/})).toHaveValue('12.5');
  await expect(row(page,'Plank').getByRole('spinbutton',{name:'Plank set 1 seconds',exact:true})).toHaveValue('30');
  await expect(row(page,'Isometric Hold').getByRole('spinbutton',{name:'Isometric Hold set 1 seconds',exact:true})).toHaveValue('30');
  await expect(row(page,'Medicine Ball Spike Slam').getByRole('textbox',{name:/weight in kilograms/})).toHaveValue('6');
  await expect(row(page,'Approach Jump').getByRole('spinbutton',{name:/maximum touch in centimetres/})).toHaveValue('315');
  await expect(row(page,'Volleyball practice').getByRole('spinbutton',{name:'Volleyball practice set 1 minutes',exact:true})).toHaveValue('120');
  expect(await page.locator('.quick-workout .set-input').evaluateAll(elements=>elements.every(element=>parseFloat(getComputedStyle(element).fontSize)>=16))).toBe(true);
  expect(await page.locator('.quick-set__complete').evaluateAll(elements=>elements.every(element=>{const rect=element.getBoundingClientRect();return rect.height>=44&&rect.width>=44;}))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.quick-exercise').evaluateAll(elements=>elements.every(element=>element.scrollWidth<=element.clientWidth))).toBe(true);
  await page.getByRole('button',{name:'Focus',exact:true}).click();expect(await state(page)).toEqual(before);
 });
}
test('optional bodyweight load and repeated completion preserve the same records through view changes and refresh',async({page})=>{
 await page.setViewportSize({width:320,height:740});const initial=await seed(page);const before=await state(page);
 await page.getByRole('button',{name:'Quick Log',exact:true}).click();const exercise=page.getByRole('region',{name:'Quick log Dead Bug',exact:true});
 await exercise.locator('summary').filter({hasText:'Details'}).click();await exercise.getByRole('button',{name:'Add load for Dead Bug',exact:true}).click();
 expect(await state(page)).toEqual(before);const weight=row(page,'Dead Bug').getByRole('textbox',{name:'Dead Bug set 1 weight in kilograms',exact:true});await weight.fill('2,5');
 await row(page,'Dead Bug').getByRole('spinbutton',{name:'Dead Bug set 1 reps',exact:true}).fill('9');await page.clock.runFor(1000);
 const current=(await state(page)).sessions.find((record:any)=>record.session.status==='active');
 const complete=row(page,'Dead Bug').getByRole('button',{name:'Complete Dead Bug set 1',exact:true});
 await complete.evaluate(button=>{for(let i=0;i<10;i++)button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
 await expect.poll(async()=>{const saved=(await state(page)).sessions.find((record:any)=>record.session.status==='active');return saved.session.exercises[0].logs.map((log:any)=>log.done);}).toEqual([true,false]);
 const after=(await state(page)).sessions.find((record:any)=>record.session.status==='active');expect(after.version).toBe(current.version+1);expect(after.session.exercises[0].logs[0]).toMatchObject({kg:2.5,reps:9,rir:2,done:true});
 await page.getByRole('button',{name:'Undo last set',exact:true}).click();await page.getByRole('button',{name:'Focus',exact:true}).click();await expect(page.getByRole('textbox',{name:'Dead Bug set 1 weight in kilograms',exact:true})).toHaveValue('2.5');
 await page.clock.runFor(1000);const prior=await state(page);await page.reload();expect((await state(page)).sessions).toEqual(prior.sessions);expect((await state(page)).profile).toEqual(prior.profile);
 expect((await state(page)).sessions.find((record:any)=>record.session.id===initial.history.id).session).toEqual(initial.history);
});
