import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { performanceFixture } from '../tests/v16-performance-fixture.ts';

// This is an isolated localhost-only measurement driver, never a production
// fixture importer. Use the same command/fixture directory before and after.
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const split = value.indexOf('=');
  if (!value.startsWith('--') || split < 0) throw new Error('Use --name=value arguments.');
  return [value.slice(2, split), value.slice(split + 1)];
}));
const root = path.resolve(args.root ?? '.');
const output = path.resolve(args.output ?? `artifacts/native-experience/${args.label ?? 'sample'}`);
const fixtures = path.resolve(args.fixtures ?? 'artifacts/native-experience/fixtures');
const label = args.label ?? 'sample';
const port = Number(args.port ?? 4174);
const samples = Number(args.samples ?? 3);
const cases = (args.cases ?? '0,120,1000,5000,10000').split(',').map(Number);
const viewports = (args.viewports ?? '375x812,390x844,430x932,820x1180,1194x834').split(',').map(value => value.split('x').map(Number));
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isInteger(samples) || samples < 1 || samples > 5
  || cases.some(value => ![0,120,1000,5000,10000].includes(value))
  || viewports.some(pair => pair.length !== 2 || pair.some(value => !Number.isInteger(value) || value < 200 || value > 3000))) throw new Error('Invalid benchmark configuration.');
await mkdir(output, { recursive: true }); await mkdir(fixtures, { recursive: true });
const dist = path.join(root, 'dist');
const html = await readFile(path.join(dist, 'index.html'));
const serviceWorker = await readFile(path.join(dist, 'service-worker.js'), 'utf8');
const cacheId = serviceWorker.match(/const CACHE_NAME = CACHE_PREFIX \+ "([^"]+)"/)?.[1] ?? 'unknown';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding:'utf8' }).trim();
const NOW = '2026-11-17T10:00:00Z';
const STORE = 'setline.gym.v1';
const origin = `http://127.0.0.1:${port}`;
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
let hangNavigation = false;
let serverEvents = [];
let serverRequests = [];
const hangingResponses = new Set();
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
  if (pathname === '/__fixture__') { response.writeHead(200, { 'Content-Type':'text/html', 'Cache-Control':'no-store' }); response.end('<!doctype html><title>Isolated fixture setup</title>'); return; }
  const navigation = (request.headers.accept ?? '').includes('text/html');
  serverRequests.push({pathname,navigation});
  if (hangNavigation && navigation) { hangingResponses.add(response); response.on('close', () => hangingResponses.delete(response)); return; }
  try {
    let file = path.resolve(dist, `.${pathname}`);
    if (!file.startsWith(dist + path.sep) && file !== dist) throw new Error('Outside build');
    try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
    catch { if (!path.extname(pathname)) file = path.join(dist, 'index.html'); }
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type':mime[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control':'no-store', 'Content-Length':bytes.length });
    response.on('finish', () => serverEvents.push({ pathname, bytes:bytes.length, js:file.endsWith('.js') }));
    response.end(bytes);
  } catch { response.writeHead(404, { 'Content-Type':'text/plain' }); response.end('Not found'); }
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
function releaseHangs() { hangNavigation = false; for (const response of hangingResponses) response.destroy(); hangingResponses.clear(); }
const browser = await chromium.launch({ executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' });

async function fixture(count) {
  const filename = path.join(fixtures, `${count}.json`);
  try { const raw = await readFile(filename, 'utf8'); return { data:JSON.parse(raw), hash:createHash('sha256').update(raw).digest('hex') }; }
  catch {
    const base = performanceFixture(count >= 1000 ? count : 1000, new Date(NOW));
    if (count < 1000) base.state.sessions = base.state.sessions.slice(0, count === 0 ? 1 : 7);
    base.state.profile.timerSoundEnabled = false;
    base.state.profile.appearance = 'light';
    base.completedSets = count; base.completedWorkouts = count / 20;
    const raw = JSON.stringify(base);
    await writeFile(filename, raw);
    return { data:base, hash:createHash('sha256').update(raw).digest('hex') };
  }
}

async function instrumentation(page) {
  await page.addInitScript(fixedDate => {
    const NativeDate=Date, fixed=NativeDate.parse(fixedDate), began=performance.now();
    class BenchmarkDate extends NativeDate {
      constructor(...values) { if(values.length) super(...values); else super(fixed+performance.now()-began); }
      static now() { return Math.floor(fixed+performance.now()-began); }
    }
    window.Date=BenchmarkDate;
    const metrics = window.__nativeBench = { ready:null, phase:null, values:{}, json:{ parseMs:0, stringifyMs:0, parseCalls:0, stringifyCalls:0, nativeWriteMs:0 } };
    const nativeParse = JSON.parse, nativeStringify = JSON.stringify, nativeSet = Storage.prototype.setItem;
    JSON.parse = function(...values) { const start=performance.now(); try { return nativeParse.apply(this, values); }
      finally { if (metrics.phase === 'input') { metrics.json.parseMs += performance.now()-start; metrics.json.parseCalls++; } } };
    JSON.stringify = function(...values) { const start=performance.now(); try { return nativeStringify.apply(this, values); }
      finally { if (metrics.phase === 'input') { metrics.json.stringifyMs += performance.now()-start; metrics.json.stringifyCalls++; } } };
    Storage.prototype.setItem = function(key, value) {
      const start=performance.now(); const result=nativeSet.call(this,key,value);
      if (this === localStorage && key === 'setline.gym.v1' && metrics.phase) {
        metrics.json.nativeWriteMs += performance.now()-start;
        metrics.values[`${metrics.phase}Save`] ??= performance.now()-metrics.started;
      }
      return result;
    };
    const ready = () => {
      const card=document.querySelector('[aria-label="Your day"]');
      const title=card?.querySelector('h2')?.textContent;
      const action=card?.querySelector('button.day-cover__primary,button.btn');
      if (title === 'Benchmark active workout' && action && !action.disabled) {
        requestAnimationFrame(() => { metrics.ready=performance.now(); }); observer.disconnect();
      }
    };
    const observer=new MutationObserver(ready);
    observer.observe(document,{childList:true,subtree:true,attributes:true});
  },NOW);
}
const metricMap = result => Object.fromEntries(result.metrics.map(item => [item.name,item.value]));
function delta(after, before, name) { return after[name] >= (before[name] ?? 0) ? after[name]-(before[name] ?? 0) : after[name]; }
async function startup(page, cdp, mode) {
  await cdp.send('Tracing.start',{categories:'devtools.timeline,v8,disabled-by-default-v8.compile',transferMode:'ReturnAsStream'});
  const before=metricMap(await cdp.send('Performance.getMetrics'));
  const eventStart=serverEvents.length;
  const requestStart=serverRequests.length;
  const begin=performance.now();
  const navigation=mode === 'warm' ? page.reload({waitUntil:'domcontentloaded',timeout:12000}) : page.goto(origin,{waitUntil:'domcontentloaded',timeout:12000});
  await navigation;
  await page.waitForFunction(() => window.__nativeBench?.ready != null, null, { timeout:12000 });
  const observed=await page.evaluate(() => ({ toTodayMs:window.__nativeBench.ready,
    resources:performance.getEntriesByType('resource').filter(item => /\.js(?:\?|$)/.test(item.name)).map(item => ({ name:new URL(item.name).pathname,
      initiator:item.initiatorType, transferBytes:item.transferSize, encodedBodyBytes:item.encodedBodySize, decodedBodyBytes:item.decodedBodySize })) }));
  const after=metricMap(await cdp.send('Performance.getMetrics'));
  const wire=serverEvents.slice(eventStart);
  const requestCount=serverRequests.length-requestStart;
  const traceReady=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
  await cdp.send('Tracing.end');
  const {stream}=await traceReady; let trace='';
  for(;;){const part=await cdp.send('IO.read',{handle:stream});trace+=part.data;if(part.eof)break;}
  await cdp.send('IO.close',{handle:stream});
  const events=JSON.parse(trace).traceEvents;
  const mainThreads=new Set(events.filter(item=>item.name==='thread_name'&&item.args?.name==='CrRendererMain').map(item=>`${item.pid}:${item.tid}`));
  const compile=events.filter(item=>item.ph==='X' && mainThreads.has(`${item.pid}:${item.tid}`)
    && Number.isFinite(item.dur) && /^(?:v8\.compile|V8\.CompileScript|V8\.CompileModule|V8\.CompileCode)$/.test(item.name));
  const ranges=compile.map(item=>[item.ts,item.ts+item.dur]).sort((a,b)=>a[0]-b[0]);
  let compiled=0,lastEnd=-Infinity;for(const [start,end] of ranges){compiled+=Math.max(0,end-Math.max(start,lastEnd));lastEnd=Math.max(lastEnd,end);}
  const compileEvents=[...new Set(compile.map(item=>item.name))];
  return { ...observed, driverWallMs:performance.now()-begin,
    pageScriptExecutionMs:delta(after,before,'ScriptDuration')*1000,
    observedV8CompileMs:compile.length?compiled/1000:null, compileTraceEventNames:compileEvents,
    pureJavaScriptParsingMs:null,
    pageMainThreadTaskMs:delta(after,before,'TaskDuration')*1000,
    jsHeapUsedBytes:after.JSHeapUsedSize, jsHeapTotalBytes:after.JSHeapTotalSize,
    documentCount:after.Documents, domNodes:after.Nodes,
    observedServerJsBytes:wire.filter(item=>item.js).reduce((sum,item)=>sum+item.bytes,0),
    observedServerTotalBytes:wire.reduce((sum,item)=>sum+item.bytes,0), observedServerRequests:requestCount,
    completedServerResponses:wire.length };
}

async function action(page, control, key, selector, input = false) {
  await control.evaluate((element,{key,selector,input}) => {
    // Radix tabs select on pointer-down, before click. Starting at click would
    // incorrectly report an already-rendered tab as a near-zero transition.
    const eventName=input ? 'input' : ['train','progress','you','today'].includes(key) ? 'pointerdown' : 'click';
    element.addEventListener(eventName, () => {
      const bench=window.__nativeBench; bench.phase=key; bench.started=performance.now();
      const painted=() => {
        if (document.querySelector(selector)) bench.values[`${key}Paint`]=performance.now()-bench.started;
        else requestAnimationFrame(painted);
      }; requestAnimationFrame(painted);
    },{once:true,capture:true});
  },{key,selector,input});
  if (!input) await control.click();
}
async function waitValue(page,key) {
  await page.waitForFunction(key => window.__nativeBench.values[key] !== undefined,key,{timeout:15000});
  return page.evaluate(key => window.__nativeBench.values[key],key);
}
async function readActive(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('setline.gym.v1')).sessions.find(row=>row.session.status === 'active')); }

async function workflow(page, cdp, filename) {
  const result={};
  await action(page,page.getByRole('tab',{name:'Train',exact:true}),'train','[aria-label="Current exercise"]');
  result.trainPaintMs=await waitValue(page,'trainPaint');
  const name='Machine Chest Press';
  const weight=page.getByRole('textbox',{name:`${name} set 1 weight in kilograms`,exact:true});
  await weight.waitFor();
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval',{interval:1000}); await cdp.send('Profiler.start');
  await action(page,weight,'input','input[aria-label="Machine Chest Press set 1 weight in kilograms"]',true);
  await weight.fill('57.5');
  result.inputPaintMs=await waitValue(page,'inputPaint'); result.inputSaveMs=await waitValue(page,'inputSave');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('setline.gym.v1')).sessions.find(row=>row.session.status === 'active').session.exercises[0].logs[0].kg === 57.5);
  result.jsonDuringInput=await page.evaluate(() => { const bench=window.__nativeBench; bench.phase=null; return bench.json; });
  const {profile}=await cdp.send('Profiler.stop');
  await writeFile(`${filename}-input-profile.json`,JSON.stringify(profile));
  const hits=new Map(); for(let i=0;i<(profile.samples??[]).length;i++){ const id=profile.samples[i]; hits.set(id,(hits.get(id)??0)+(profile.timeDeltas?.[i]??0)); }
  result.inputCpuTopSelf=profile.nodes.map(node=>({name:node.callFrame.functionName||'(anonymous)',selfMs:(hits.get(node.id)??0)/1000,url:node.callFrame.url,line:node.callFrame.lineNumber})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,15);
  const complete=page.getByRole('button',{name:`Complete ${name} set 1`,exact:true});
  await action(page,complete,'complete','button[aria-label="View Machine Chest Press set 1, complete"]');
  result.completePaintMs=await waitValue(page,'completePaint'); result.completeSaveMs=await waitValue(page,'completeSave');
  const saved=await readActive(page);
  if(saved.session.exercises[0].logs.filter(log=>log.done).length!==1) throw new Error('Completion did not target exactly one set.');
  result.completedSet=saved.session.exercises[0].logs[0];
  await action(page,page.getByRole('tab',{name:'Progress',exact:true}),'progress','.progress-overview');
  result.progressPaintMs=await waitValue(page,'progressPaint');
  result.progressChartPresent=await page.locator('.progress-overview svg[role="img"]').count();
  await action(page,page.getByRole('tab',{name:'You',exact:true}),'you','.workspace--menu');
  result.youPaintMs=await waitValue(page,'youPaint');
  await action(page,page.getByRole('tab',{name:'Today',exact:true}),'today','[aria-label="Your day"]');
  result.todayPaintMs=await waitValue(page,'todayPaint');
  const memory=metricMap(await cdp.send('Performance.getMetrics'));
  result.afterWorkflowJsHeapUsedBytes=memory.JSHeapUsedSize;
  await cdp.send('HeapProfiler.enable');await cdp.send('HeapProfiler.collectGarbage');
  result.afterWorkflowJsHeapUsedPostGcBytes=(await cdp.send('Runtime.getHeapUsage')).usedSize;
  await page.evaluate(() => {window.__nativeBench.phase=null;});
  return result;
}

async function installed(context,page) {
  await page.waitForFunction(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    return !!registration?.active && !registration.installing;
  },null,{timeout:20000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller && window.__nativeBench?.ready!==null);
}
async function isolatedLaunch(context, mode) {
  const page=await context.newPage(); await instrumentation(page);
  const begin=performance.now(); let ready=false, message=null;
  const eventStart=serverRequests.length;
  try {
    const navigation=page.goto(origin,{waitUntil:'domcontentloaded',timeout:3500});
    await navigation;
    await page.waitForFunction(()=>window.__nativeBench?.ready!=null,null,{timeout:3500}); ready=true;
  } catch(error) { message=String(error.message).split('\n')[0]; }
  const result={mode,ready,driverWallMs:performance.now()-begin,
    toTodayMs:ready?await page.evaluate(()=>window.__nativeBench.ready):null,
    navigationNetworkRequests:serverRequests.slice(eventStart).filter(item=>item.navigation).length,
    error:message};
  if(mode==='hanging-network') releaseHangs();
  await page.close(); return result;
}

async function buildSizes(directory) {
  const files=[];
  async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())await walk(file);else if(entry.name.endsWith('.js')){const bytes=await readFile(file);files.push({file:path.relative(directory,file),bytes:bytes.length,gzipEstimateBytes:gzipSync(bytes).length});}}}
  await walk(directory);
  const initialModulePaths=[...html.toString().matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(match=>match[1]);
  const initial=files.filter(item=>initialModulePaths.includes(`/${item.file}`));
  return { files, totalJavaScriptBytes:files.reduce((sum,item)=>sum+item.bytes,0), totalJavaScriptGzipEstimateBytes:files.reduce((sum,item)=>sum+item.gzipEstimateBytes,0),
    initialModulePaths,initialModuleBytes:initial.reduce((sum,item)=>sum+item.bytes,0),initialModuleGzipEstimateBytes:initial.reduce((sum,item)=>sum+item.gzipEstimateBytes,0) };
}

async function screenshots() {
  if(args.screens==='false') return [];
  const outputDirectory=path.join(output,'screenshots');await mkdir(outputDirectory,{recursive:true});
  const frames=[];
  for(const [width,height] of viewports) for(const theme of ['light','dark']){
    const {data}=await fixture(120); const state=structuredClone(data.state);state.profile.appearance=theme;
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'en-GB',timezoneId:'Europe/Berlin',reducedMotion:'reduce'});
    const page=await context.newPage();await page.goto(origin+'/__fixture__');await page.evaluate(state=>localStorage.setItem('setline.gym.v1',JSON.stringify(state)),state);await instrumentation(page);await page.goto(origin);await page.waitForFunction(()=>window.__nativeBench?.ready!=null);
    const capture=async name=>{await page.screenshot({path:path.join(outputDirectory,`${width}x${height}-${theme}-${name}.png`),animations:'disabled'});const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth}));frames.push({width,height,theme,name,...layout});};
    await capture('today');await page.getByRole('tab',{name:'Train',exact:true}).click();await page.getByRole('region',{name:'Current exercise',exact:true}).waitFor();await capture('focus');
    await page.getByRole('button',{name:'Quick Log',exact:true}).click();await capture('quick-log');
    await page.getByRole('button',{name:'Focus',exact:true}).click();await page.getByRole('button',{name:'Complete Machine Chest Press set 1',exact:true}).click();await page.locator('.rest-floating').waitFor();await capture('rest');
    await page.getByRole('tab',{name:'Progress',exact:true}).click();await page.locator('.progress-overview').waitFor();await capture('progress');await context.close();
  }
  return frames;
}

const observations=[];
try {
  for(const count of args.measurements === 'false' ? [] : cases){const current=await fixture(count);for(let sample=1;sample<=samples;sample++){
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'en-GB',timezoneId:'Europe/Berlin',reducedMotion:'reduce'});
    const setup=await context.newPage();await setup.goto(origin+'/__fixture__');await setup.evaluate(state=>localStorage.setItem('setline.gym.v1',JSON.stringify(state)),current.data.state);await setup.close();
    const page=await context.newPage();page.setDefaultTimeout(15000);await instrumentation(page);
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    const cold=await startup(page,cdp,'cold');await installed(context,page);const warm=await startup(page,cdp,'warm');
    const filename=path.join(output,`${count}-${sample}`);const interactions=await workflow(page,cdp,filename);
    await page.close();await context.setOffline(true);const offline=await isolatedLaunch(context,'offline-cold');await context.setOffline(false);
    hangNavigation=true;const hanging=await isolatedLaunch(context,'hanging-network');
    const record={completedSets:count,completedWorkouts:current.data.completedWorkouts,sample,fixtureSha256:current.hash,cold,warm,interactions,offline,hanging};observations.push(record);
    await writeFile(`${filename}.json`,JSON.stringify(record,null,2));console.log(JSON.stringify({label,completedSets:count,sample,cold:cold.toTodayMs,warm:warm.toTodayMs,input:interactions.inputPaintMs,inputSave:interactions.inputSaveMs,offline:offline.toTodayMs,hanging:hanging.ready}));
    await context.close();
  }}
  const frames=await screenshots();
  const report={label,revision,cacheId,distHtmlSha256:createHash('sha256').update(html).digest('hex'),browser:browser.version(),observedAt:new Date().toISOString(),conditions:{viewport:{width:390,height:844},deviceScaleFactor:1,locale:'en-GB',timezone:'Europe/Berlin',workers:1,cpuThrottling:false,networkCompression:false,fixtureProvisioningExcluded:true,server:'isolated localhost static server with optional document-request hang'},build:await buildSizes(dist),observations,frames};
  await writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(`Benchmark complete: ${path.join(output,'results.json')}`);
} finally { releaseHangs();await browser.close();await new Promise(resolve=>server.close(resolve)); }
