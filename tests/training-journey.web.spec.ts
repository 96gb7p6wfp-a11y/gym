import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
const STORE='setline.gym.v1';
function history(date:string,kg:number){
 const s=SessionSchema.parse(stopSessionTimers(createSession(DEFAULT_PROFILE.plan[0],0,date,DEFAULT_PROFILE,[]),'completed'));
 s.startedAt=Date.parse(`${date}T12:00:00Z`);s.name='Upper';s.kind='strength';
 s.exercises=[{...s.exercises[0],key:'press',exerciseId:'press',name:'Machine Press',mode:'weight',measurement:undefined,quantityUnit:undefined,perSide:false,
 logs:s.exercises[0].logs.slice(0,2).map(l=>({...l,done:true,kg,reps:8,rir:2}))}];
 return SessionSchema.parse(s);
}
async function seed(page:Page,hasHistory=true){
 const sessions=hasHistory?[history('2026-01-05',40),history('2026-10-06',50),history('2026-10-20',55)]:[];
 await page.addInitScript(({key,profile,sessions})=>{
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({schemaVersion:1,profile,profileVersion:1,sessions:sessions.map(session=>({session,version:1})),nutrition:[],activities:[]}));
 },{key:STORE,profile:DEFAULT_PROFILE,sessions});
 await page.goto('/');
}
async function journey(page:Page){await page.getByRole('tab',{name:'Progress',exact:true}).click();await page.getByRole('button',{name:'Training journey',exact:true}).click();return page.getByRole('region',{name:'Training journey',exact:true});}

test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-03T12:00:00Z')});});
for(const theme of ['light','dark'])test(`dated results, filters and original workouts stay readable at 320px in ${theme}`,async({page})=>{
 await page.setViewportSize({width:320,height:740});await seed(page);
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
 const before=await page.evaluate(key=>localStorage.getItem(key),STORE);
 const region=await journey(page);
 await expect(region.getByRole('combobox',{name:'Journey result'})).toHaveValue(/strength:/);
 await expect(region.getByRole('img')).toHaveAttribute('aria-label',/2026-10-06, 50 kg; 2026-10-20, 55 kg/);
 await region.getByRole('button',{name:'All history',exact:true}).click();
 await expect(region.getByRole('img')).toHaveAttribute('aria-label',/2026-01-05, 40 kg/);
 await region.getByRole('combobox',{name:'Inspect journey record'}).selectOption('0');
 await expect(region.getByRole('status')).toContainText('2026-01-05 · 40 kg · RIR 2');
 await page.screenshot({path:`/tmp/setline-v15-journey-${theme}.png`,fullPage:true});
 await region.getByRole('button',{name:'View workout',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit this log',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(key=>localStorage.getItem(key),STORE)).toBe(before);
});

test('first-use results open offline and an empty profile never becomes invented progress',async({page,context})=>{
 await seed(page,false);await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller?.state),{timeout:15000}).toBe('activated');
 const before=await page.evaluate(key=>localStorage.getItem(key),STORE);await context.setOffline(true);
 const region=await journey(page);await expect(region).toContainText('Your results start with real records');
 await expect(region.getByRole('img')).toHaveCount(0);
 await region.getByRole('button',{name:'All history',exact:true}).click();
 expect(await page.evaluate(key=>localStorage.getItem(key),STORE)).toBe(before);
});

test('old and future-dated jump entries remain accessible for correction without altering history on read',async({page})=>{
 const jumps=Array.from({length:10},(_,i)=>({id:crypto.randomUUID(),date:`2026-10-${String(i+1).padStart(2,'0')}`,type:'approach',measurement:'height',cm:60+i,notes:''}));
 jumps.push({id:crypto.randomUUID(),date:'2099-01-01',type:'approach',measurement:'height',cm:90,notes:''});
 await seed(page);await page.evaluate(({key,jumps})=>{const state=JSON.parse(localStorage.getItem(key)!);state.performance={jumps,readiness:[]};state.performanceVersion=1;localStorage.setItem(key,JSON.stringify(state));},{key:STORE,jumps});await page.reload();
 const before=await page.evaluate(key=>localStorage.getItem(key),STORE);
 await page.getByRole('tab',{name:'Progress',exact:true}).click();await page.getByRole('button',{name:'Performance details',exact:true}).click();
 const details=page.getByRole('region',{name:'Performance details',exact:true});await details.locator('summary').filter({hasText:/^Recent jump entries$/}).click();
 await expect(details.getByRole('button',{name:'Remove approach jump on 2099-01-01',exact:true})).toBeVisible();
 await details.getByRole('button',{name:'Show older jump entries',exact:true}).click();
 await expect(details.getByRole('button',{name:'Remove approach jump on 2026-10-01',exact:true})).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),STORE)).toBe(before);
});

test('a waiting update is discoverable in You without automatically reloading or changing saved records',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator.serviceWorker,'getRegistration',{configurable:true,value:async()=>({waiting:{postMessage(){throw new Error('Must never activate from notice');}},installing:null,update:async()=>{}})}));
 await seed(page);const before=await page.evaluate(key=>localStorage.getItem(key),STORE);
 await page.getByRole('tab',{name:'You',exact:true}).click();await page.getByRole('button',{name:'Review available app update',exact:true}).click();
 await expect(page.getByRole('button',{name:'Update app',exact:true})).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),STORE)).toBe(before);
});
