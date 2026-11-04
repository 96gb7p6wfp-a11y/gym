import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { cpus, platform, release, totalmem, tmpdir } from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
await readFile(path.join(root,'dist','index.html')); // Benchmark the existing production build; never silently rebuild it.
const temporary=await mkdtemp(path.join(tmpdir(),'setline-v16-benchmark-'));
const resultDirectory=path.join(temporary,'measurements');
await mkdir(resultDirectory);
const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';
const child=spawn(process.execPath,[path.join(root,'node_modules/@playwright/test/cli.js'),'test','tests/v16-performance-stress.web.spec.ts','--workers=1',`--output=${path.join(temporary,'playwright')}`],{
  cwd:root,stdio:'inherit',env:{...process.env,PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:executable,SETLINE_BENCHMARK_REPORT_DIR:resultDirectory},
});
const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
if(code!==0) {console.error(`Benchmark failed; no success report generated. Artifacts: ${temporary}`);process.exit(code??1);}
const results=await Promise.all([1000,5000,10000].map(async count=>JSON.parse(await readFile(path.join(resultDirectory,`${count}.json`),'utf8'))));
const commit=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:root,encoding:'utf8'}).trim();
// A generated/untracked report must not describe a clean app build as modified.
const dirty=execFileSync('git',['status','--porcelain','--','src','public','package.json','package-lock.json','vite.config.ts','scripts/finalize-web.mjs'],{cwd:root,encoding:'utf8'}).trim().length>0;
const worker=await readFile(path.join(root,'dist','service-worker.js'),'utf8');
const cache=worker.match(/const CACHE_NAME = CACHE_PREFIX \+ "([^"]+)"/)?.[1]??'unknown';
const runtime={node:process.version,platform:platform(),release:release(),cpu:cpus()[0]?.model??'unknown',logicalCpus:cpus().length,memoryBytes:totalmem()};
const rounded=value=>value.toFixed(1);
const rows=results.map(result=>`| ${result.completedSets.toLocaleString('en-GB')} | ${result.completedWorkouts} | ${['startup','inputPaint','inputSave','historySearch','chartRender','exportRequest','restore'].map(key=>rounded(result.milliseconds[key])).join(' | ')} | ${result.storage.utf8Bytes.toLocaleString('en-GB')} | ${result.storage.backupUtf8Bytes.toLocaleString('en-GB')} |`).join('\n');
const report=`# Setline V16 measured long-term workflows

Measured ${results[0].observedAt} against the existing production build (PWA cache \`${cache}\`), branch HEAD \`${commit}\`${dirty?' with uncommitted app-source changes':''}. Run with \`npm run build\` followed by \`node scripts/benchmark-v16.mjs\`.

## Actual observations

All durations below are milliseconds, one run per fixture. These are observations, not percentile service-level guarantees.

| Completed sets | Workouts | Startup | Input → frame | Input → saved | History search → frame | All-history chart → frame | Export request | Restore → atomic write | Stored JSON UTF-8 bytes | Backup UTF-8 bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Method and limits

- Synthetic records run only inside isolated test browser contexts: 50/250/500 completed workouts, five weighted exercises and four sets each, distributed across approximately four years for the largest fixture. One unfinished workout is included and verified after export/restore. No production/user browser data is read or modified.
- Browser: Chromium ${results[0].browser}, 390×844 mobile viewport, touch enabled, iPhone user-agent string. Runtime: ${runtime.platform} ${runtime.release}; Node ${runtime.node}; ${runtime.cpu}; ${runtime.logicalCpus} logical CPUs; ${Math.round(runtime.memoryBytes/1024**3)} GiB host memory. No CPU/network throttling. This is browser automation on a cloud machine, not physical iPhone testing.
- Startup runs from the end of test-only record provisioning in a browser initialization script to the first animation frame showing the loaded active-workout title. It includes application bootstrap, saved-data reads/validation and rendering; it excludes fixture serialization/writing. The raw measurements separately include navigationToReady, which starts at the browser navigation time origin and includes fixture provisioning. The app shell is fresh in each isolated context. Local server transfer and service-worker installation may overlap startup.
- Input starts at the real input event, then records the next animation frame and the first subsequent main-data storage write. The save duration includes the intentional input-save batching interval. Saved decimal weight is verified from storage.
- Search starts at the real input event and ends at the first animation frame containing exactly the matching oldest workout. The initial History view renders at most 40 records; search covers all records. Opening History and typing latency from the automation protocol are excluded.
- Chart time starts at the All history click and ends at the first animation frame containing one SVG point per completed workout in the selected strength series. The default chart route has already loaded. This measures all-history derivation/rendering; it excludes initial lazy-chunk transfer.
- Export time starts at Export backup click and ends when the download anchor is invoked. The downloaded backup is read and its completed-set count verified. This measures export generation/request, not successful long-term preservation of the file.
- Restore begins at the Restore backup click (confirmation automatically accepted in this test), validates the backup, preserves the pre-restore safety copy and ends after the atomic main-data write. The app reload and exact restored sessions/profile/nutrition/reminders are separately verified. Browser disk-flush durability is not claimed.
- Stored size is the actual serialized main JSON encoded as UTF-8, not the browser's quota accounting. The JSON contains ${results.map(result=>`${result.completedSets.toLocaleString('en-GB')}: ${result.storage.utf16CodeUnits.toLocaleString('en-GB')} UTF-16 code units`).join('; ')}. Browser quotas and available device storage vary. The restore safety copy temporarily stores another complete dataset.
- All measured workflows completed without an IndexedDB migration. This result does not guarantee acceptable latency/quota on older iPhones, private browsing, constrained storage or much larger records. Export/restore remain the recovery path; no unverified destructive migration was introduced.

## Physical iPhone validation still required

VoiceOver announcement quality and rotor navigation; actual iOS numeric keyboard and visual-viewport resizing; Dynamic Type / browser text scaling; one-handed reach; installed PWA update prompts; offline behavior after long suspension or storage pressure; background and locked-screen timer/audio behavior. Automated mobile viewport, safe-area, focus, reduced-motion and offline tests provide partial evidence only. Locked-screen audio reliability is not claimed.

## Raw measurements

\`\`\`json
${JSON.stringify({runtime,results},null,2)}
\`\`\`
`;
const destination=path.resolve(root,process.argv[2]??'docs/V16-PERFORMANCE.md');
await mkdir(path.dirname(destination),{recursive:true});
await writeFile(destination,report);
console.log(`Measured report written to ${destination}. Raw test artifacts: ${temporary}`);
