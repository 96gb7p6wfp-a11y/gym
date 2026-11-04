import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performanceFixture } from './v16-performance-fixture.ts';

const STORE='setline.gym.v1';
const RESTORE_METRIC='setline.test.v16.restore-ms';
test.use({storageState:{cookies:[],origins:[]}});

declare global {
  interface Window { __setlineBenchmark: { metrics:Record<string,number>; phase?:string; started?:number }; }
}

async function measurePaint(page:Page, control:Locator, key:string, condition:{selector:string; count?:number; text?:string}, event='click') {
  await control.evaluate((element,{key,condition,event}) => {
    element.addEventListener(event,()=>{
      const start=performance.now();
      const painted=()=>{
        const elements=document.querySelectorAll(condition.selector);
        const ready=(condition.count === undefined || elements.length === condition.count)
          && (condition.text === undefined || Array.from(elements).some(element=>element.textContent?.includes(condition.text!)));
        if (ready) window.__setlineBenchmark.metrics[key]=performance.now()-start;
        else if (performance.now()-start<15_000) requestAnimationFrame(painted);
      };
      requestAnimationFrame(painted);
    },{once:true,capture:true});
  },{key,condition,event});
}

async function metric(page:Page,key:string) {
  await expect.poll(()=>page.evaluate(key=>window.__setlineBenchmark.metrics[key]??null,key),{timeout:20_000}).not.toBeNull();
  return page.evaluate(key=>window.__setlineBenchmark.metrics[key],key);
}

for (const completedSets of [1000,5000,10000] as const) {
  test(`V16 measured long-term workflow with ${completedSets.toLocaleString('en-GB')} completed sets`,async({page,browser},testInfo)=>{
    test.setTimeout(120_000);
    const fixture=performanceFixture(completedSets);
    await page.addInitScript(({key,state,restoreMetric})=>{
      if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(state));
      // Exclude test-only record provisioning from the app's initialization
      // duration. Keep the navigation-time observation separately for context.
      const fixtureReady=performance.now();
      window.__setlineBenchmark={metrics:{}};
      const ready=()=>{
        if (document.querySelector('[aria-label="Your day"] h2')?.textContent === 'Benchmark active workout') {
          requestAnimationFrame(()=>{
            const painted=performance.now();
            window.__setlineBenchmark.metrics.startup=painted-fixtureReady;
            window.__setlineBenchmark.metrics.navigationToReady=painted;
          });
          observer.disconnect();
        }
      };
      const observer=new MutationObserver(ready);
      observer.observe(document,{childList:true,subtree:true});
      const originalSet=Storage.prototype.setItem;
      Storage.prototype.setItem=function(storageKey,value) {
        const result=originalSet.call(this,storageKey,value);
        const bench=window.__setlineBenchmark;
        if(this===localStorage && storageKey===key && bench.started!==undefined) {
          if(bench.phase==='input') {bench.metrics.inputSave=performance.now()-bench.started;bench.phase=undefined;}
          if(bench.phase==='restore' && value.slice(0,200).includes('"restoreGeneration"')) {
            originalSet.call(sessionStorage,restoreMetric,String(performance.now()-bench.started));
            bench.phase=undefined;
          }
        }
        return result;
      };
    },{key:STORE,state:fixture.state,restoreMetric:RESTORE_METRIC});
    await page.goto('/');
    const startup=await metric(page,'startup');
    const navigationToReady=await metric(page,'navigationToReady');
    await page.getByRole('tab',{name:'Train',exact:true}).click();
    const weight=page.getByRole('textbox',{name:`${fixture.firstExerciseName} set 1 weight in kilograms`,exact:true});
    await weight.evaluate(element=>element.addEventListener('input',()=>{
      window.__setlineBenchmark.phase='input';window.__setlineBenchmark.started=performance.now();
      requestAnimationFrame(()=>window.__setlineBenchmark.metrics.inputPaint=performance.now()-window.__setlineBenchmark.started!);
    },{once:true,capture:true}));
    await weight.fill('57.5');
    const inputPaint=await metric(page,'inputPaint');
    const inputSave=await metric(page,'inputSave');
    await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).sessions.find((row:{session:{status:string}})=>row.session.status==='active').session.exercises[0].logs[0].kg,STORE)).toBe(57.5);

    await page.getByRole('tab',{name:'You',exact:true}).click();
    await page.getByRole('button',{name:'History',exact:true}).click();
    const search=page.getByRole('searchbox',{name:'Search workouts',exact:true});
    await expect(page.locator('.history-card')).toHaveCount(40);
    await measurePaint(page,search,'historySearch',{selector:'.history-card',count:1,text:'Benchmark target oldest'},'input');
    await search.fill('target oldest');
    await expect(page.locator('.history-card')).toHaveCount(1);
    const historySearch=await metric(page,'historySearch');

    // Return through History's back control before opening the journey.
    await page.getByRole('button',{name:'Progress',exact:true}).click();
    await page.getByRole('button',{name:'Training journey',exact:true}).click();
    const allHistory=page.getByRole('button',{name:'All history',exact:true});
    await measurePaint(page,allHistory,'chartRender',{selector:'.journey-chart circle',count:fixture.completedWorkouts});
    await allHistory.click();
    await expect(page.locator('.journey-chart circle')).toHaveCount(fixture.completedWorkouts);
    const chartRender=await metric(page,'chartRender');

    await page.getByRole('tab',{name:'You',exact:true}).click();
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    const settings=page.getByRole('dialog',{name:'Your preferences',exact:true});
    const exportButton=settings.getByRole('button',{name:'Export backup',exact:true});
    await exportButton.evaluate(element=>{
      element.addEventListener('click',()=>{window.__setlineBenchmark.started=performance.now();},{once:true,capture:true});
      const originalClick=HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click=function(){
        if(this.download && window.__setlineBenchmark.started!==undefined) window.__setlineBenchmark.metrics.exportRequest=performance.now()-window.__setlineBenchmark.started;
        return originalClick.call(this);
      };
    });
    const downloadPromise=page.waitForEvent('download');
    await exportButton.click();
    const download=await downloadPromise;
    const backupText=await readFile((await download.path())!,'utf8');
    const backup=JSON.parse(backupText);
    const exportedSets=backup.data.sessions.reduce((sum:number,row:{session:{status:string;exercises:{logs:{done:boolean}[]}[]}})=>sum+(row.session.status==='completed'?row.session.exercises.reduce((sets,exercise)=>sets+exercise.logs.filter(log=>log.done).length,0):0),0);
    expect(exportedSets).toBe(completedSets);
    const exportRequest=await metric(page,'exportRequest');
    const serialized=await page.evaluate(key=>{
      const value=localStorage.getItem(key)!;
      return {utf8Bytes:new TextEncoder().encode(value).length,utf16CodeUnits:value.length};
    },STORE);

    await settings.getByLabel('Restore Setline backup',{exact:true}).setInputFiles({name:'benchmark-backup.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
    await expect(settings.getByRole('region',{name:'Backup restore preview',exact:true})).toBeVisible();
    await page.evaluate(()=>{window.confirm=()=>true;});
    const restoreButton=settings.getByRole('button',{name:'Restore backup',exact:true});
    await restoreButton.evaluate(element=>element.addEventListener('click',()=>{
      window.__setlineBenchmark.phase='restore';window.__setlineBenchmark.started=performance.now();
    },{once:true,capture:true}));
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),restoreButton.click()]);
    await expect(page.getByRole('region',{name:'Your day',exact:true})).toContainText('Benchmark active workout');
    const restore=await page.evaluate(key=>Number(sessionStorage.getItem(key)),RESTORE_METRIC);
    expect(restore).toBeGreaterThan(0);
    const restored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),STORE);
    expect(restored.sessions).toEqual(backup.data.sessions);
    expect(restored.profile).toEqual(backup.data.profile);
    expect(restored.nutrition).toEqual(backup.data.nutrition);
    expect(restored.reminders).toEqual(backup.data.reminders);
    expect(restored.sessions.find((row:{session:{id:string}})=>row.session.id===fixture.activeId).session.exercises[0].logs[0]).toMatchObject({kg:57.5,done:false});
    const result={completedSets,completedWorkouts:fixture.completedWorkouts,browser:browser.version(),viewport:{width:390,height:844},
      milliseconds:{startup,navigationToReady,inputPaint,inputSave,historySearch,chartRender,exportRequest,restore},
      storage:{...serialized,backupUtf8Bytes:Buffer.byteLength(backupText,'utf8')},observedAt:new Date().toISOString()};
    const text=JSON.stringify(result,null,2);
    await testInfo.attach(`performance-${completedSets}`,{body:text,contentType:'application/json'});
    if(process.env.SETLINE_BENCHMARK_REPORT_DIR){
      await mkdir(process.env.SETLINE_BENCHMARK_REPORT_DIR,{recursive:true});
      await writeFile(path.join(process.env.SETLINE_BENCHMARK_REPORT_DIR,`${completedSets}.json`),text);
    }
    console.log(`SETLINE_BENCHMARK ${JSON.stringify(result)}`);
  });
}
