# Native experience benchmark evidence

Measured on 17 November 2026 with an isolated Linux Chromium installation. These
measurements describe this test environment, not physical iPhone performance.
The production site and private device storage were not used.

## Reproduce

Build each revision in an isolated worktree, then run the same driver and fixture
directory sequentially. Do not run builds, tests or another browser concurrently.

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
node --experimental-strip-types scripts/benchmark-native.mjs \
  --root=/path/to/built/worktree --label=revision-name \
  --output=artifacts/native-experience/revision-name \
  --port=4174 --samples=3
```

`--screens=false` skips visual evidence. `--measurements=false` captures only
screenshots; `--viewports=320x568,390x844` selects their sizes. The driver launches
its own localhost static server. It never provisions production data.

## Conditions and interpretation

- Three independent browser contexts per history size and revision; report the
  median, not a claimed population percentile. The browser process is shared.
- Chromium mobile/touch emulation, 390 × 844 CSS pixels, scale factor 1,
  Europe/Berlin, en-GB, reduced motion, no CPU throttling or network compression.
- Completed history sizes are 0, 120, 1,000, 5,000 and 10,000 working sets. Each
  fixture also contains the same 20-pending-set active workout. “0” means no
  completed history; it is not a virgin installation or onboarding benchmark.
- Synthetic fixture creation and storage provisioning happen before measurement.
  Persisted fixture hashes must match across all three revisions. The date is
  fixed to 17 November 2026, while elapsed time advances monotonically.
- “Cold” means a new page/context without an installed worker, within one already
  running browser process. “Warm” is an installed, controlled-page reload.
  Neither represents a phone OS cold launch.
- Today-ready is the first animation frame with the expected workout title and
  enabled primary action. Input and tab timing measures an event-to-frame marker,
  not hardware touch latency or physical display presentation.
- Tabs are measured from pointer-down: Radix changes tabs before click. Measuring
  from click would incorrectly count an already-rendered destination as instant.
- A save is the first successful primary `localStorage.setItem` after the input
  or completion action. The driver independently verifies saved input values and
  exactly one completed set. The legacy debounce is reported separately from
  immediate-persistence implementations; postponing writes is not an improvement
  in data reliability.
- Input diagnostics wrap JSON operations and sample CPU at 1 ms. Trace startup
  records ScriptDuration and V8 compile intervals on the renderer main thread;
  nested intervals are unioned. Instrumentation has overhead and is identical
  across revisions. Pure JavaScript parsing time is unavailable and is reported
  as null, rather than inferred from execution time.
- JavaScript transfer from ResourceTiming is distinguished from all server
  responses, which can include background service-worker shell precaching and
  duplicate resource fetches. Gzip values are local estimates, not observed
  Vercel transfer sizes. The test server deliberately sends uncompressed bytes.
- Heap is the page's V8 heap, including a second reading after forced collection.
  It does not measure the entire browser, worker, GPU or operating system memory.
- Offline cold launch closes the prior page, disables network, then opens a new
  page after a verified worker installation. The hanging-network probe leaves
  actual document HTTP requests unanswered and gives navigation 3,500 ms. A
  deadline means that probe failed; it is not converted into a success.
- Screenshots cover compact phones and portrait/landscape tablets in both themes.
  They are synthetic active-session evidence, not proof of physical keyboard,
  lock-screen audio, haptics or iOS suspension behavior.

## Results

The final comparison, source revisions, raw evidence and selected before/after
frames are recorded here after all three controlled matrices complete.
