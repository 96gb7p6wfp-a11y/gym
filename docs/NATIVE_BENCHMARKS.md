# Native experience benchmark evidence

Baseline capture began on 17 November 2026. The final corrected matrices run on
18 November in sequential isolated Linux Chromium windows. These measurements describe
this configured test environment, not physical iPhone performance.
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
  median, not a claimed population percentile. Each revision launches one browser
  process shared by its 15 observations; revisions run sequentially.
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
- Harness version 2 verifies the input displays `57.5` at its frame marker and
  that Progress contains its overview SVG when history exists. One `fill()` input
  event is measured, not sustained typing or hardware presentation. The overview
  is distinct from the separately opened advanced Strength/Recharts screen;
  Recharts was already deferred in the original app.
- Input diagnostics wrap JSON operations and sample CPU at 1 ms; their window
  includes measurement polling and is diagnostic rather than pure application CPU.
  The write-duration accumulator is reset at input start and restricted to that
  phase. Save timestamps remain the first successful primary `setItem`, with
  independent value and exactly-one-target completion checks across the workout.
- A dedicated CDP probe confirmed startup duration counters reset at a new
  top-level navigation in this Chromium version. Version 2 asserts a changed
  NavigationStart epoch and reports the new document's counters directly, with
  the raw before/after epoch retained. The old subtract-or-reset heuristic was
  incorrect; all three matrices are rerun with the corrected driver.
- V8 compile intervals are a broad trace-window diagnostic: renderer intervals
  are unioned, not claimed as summed CPU or pure parsing time. Instrumentation
  has overhead and is identical across revisions. Pure JavaScript parsing time
  is unavailable and explicitly null.
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

## Final corrected results — 18 November 2026

All three comparison sources have **15 observations**: every 0 / 120 / 1,000 /
5,000 / 10,000-set case retains all three samples. No outliers are removed.
Five fixture hashes, browser version and recorded host metadata match across the
three matrices. All 90 cold/warm navigation epochs passed the counter checks;
script duration never exceeded the corresponding total task duration. The
runner exposed three logical CPUs on Linux x64, Chromium `151.0.7922.173`; no
other build or browser suite ran during these measurement windows.

The final app runtime is `73c2a81`; subsequent evidence-only/test commits do not
change this build. The baseline/PR12 builds are immutable worktrees. The first
native candidate's blanket lazy loading caused a 340.2 ms first Train opening
in a 10,000-set probe; keeping the essential logger eager removed it. The next
candidate added a roughly 300 ms first-Progress floor for sparse histories;
keeping the lightweight overview eager removed that floor too. Heavy Recharts,
optional guide sheets and secondary screens remain deferred. Those earlier
implementation results are superseded, not mixed into the final medians.

| Source | Commit | Cache suffix | Captured UTC |
| --- | --- | --- | --- |
| Main | 693265cc96c0 | 0c12b755da157bd1ac30 | 2026-11-18T07:05:29.103Z |
| PR #12 only | 8e5f30d35166 | c178374091852999fd74 | 2026-11-18T07:07:41.106Z |
| Final native | 73c2a8130bde | c9f5c8d6a117437c2a88 | 2026-11-18T07:20:18.596Z |

Raw evidence: [main](performance/native/main-baseline.json),
[PR #12 only](performance/native/pr12-baseline.json),
[final native](performance/native/optimized.json),
[all medians](performance/native/comparison.json). The actual
[CDP counter reset probe](performance/native/counter-probe.json) records the
before/reload/after counters. Preliminary 17 November CPU fields used an
incorrect subtract-or-reset heuristic and are **not** used in these tables.
The corrected harness reports the new document's counters directly.

### JavaScript transfer and installation

These are generated JavaScript body sizes; the server sent uncompressed bytes.
Gzip values are local estimates, not measured Vercel compression.

| Bytes | Main | PR #12 only | Final native |
| --- | --- | --- | --- |
| Initial HTML-linked JS body | 1,350,752 | 1,361,603 | 1,134,477 |
| Initial JS gzip estimate | 388,981 | 392,053 | 334,309 |
| All generated JS bodies | 2,310,366 | 2,321,217 | 2,338,720 |
| All JS gzip estimate | 610,145 | 613,222 | 629,506 |

Initial JavaScript bodies decreased **16.0%**;
the initial gzip estimate decreased **14.1%**.
All generated JavaScript grew **1.2%**.
The full offline shell still includes every essential chunk; this is not a claim
that the entire first installation became smaller. Server-response bytes in the
raw reports can include background precaching and duplicate fetches, so they are
not mislabeled as the page's critical JavaScript transfer.

### 10,000 completed sets — median milliseconds

| Metric (ms) | Main | PR #12 only | Final native |
| --- | --- | --- | --- |
| Cold Today ready | 874.8 | 761.0 | 739.0 |
| Warm Today ready | 356.2 | 432.9 | 262.4 |
| Cold document JS execution | 567.9 | 489.1 | 389.8 |
| Warm document JS execution | 288.8 | 291.8 | 131.0 |
| Cold document main-thread tasks | 783.6 | 783.7 | 584.8 |
| First Train ready | 98.7 | 109.4 | 85.7 |
| Input → frame with 57.5 shown | 47.7 | 170.9 | 34.1 |
| Input → first primary write | 556.5 | 84.2 | 14.6 |
| Completion → completed-set frame | 173.7 | 180.8 | 56.0 |
| Completion → first primary write | 61.5 | 52.1 | 14.1 |
| First Progress overview/SVG | 1,035.3 | 1,099.5 | 966.5 |
| You ready | 453.2 | 479.3 | 449.7 |
| Return to Today | 80.1 | 73.8 | 28.6 |
| Cached offline Today ready | 788.9 | 877.1 | 577.5 |

Main's input write includes its approximately 450 ms debounce. Its quicker
in-memory frame does not offer equivalent immediate persistence. PR #12 already
removed the debounce; the final comparison to PR #12 isolates the added caching
and historical-computation work more fairly. A successful primary `setItem`
precedes this branch's completion acknowledgement, but is not a disk-fsync or
arbitrary OS-crash guarantee.

The Progress overview still takes approximately **967 ms** at 10,000 sets. Its
main comparison is 1,035 ms, not the superseded lazy candidate's 527 ms. This is
remaining large-history processing cost, not a dramatic chart-speed claim.

### Input scaling — all samples retained

Input-to-frame marker, milliseconds:

| Completed sets | Main | PR #12 only | Final native |
| --- | --- | --- | --- |
| 0 | 20.2 | 28.9 | 14.7 |
| 120 | 21.5 | 41.9 | 15.5 |
| 1,000 | 23.0 | 54.1 | 14.7 |
| 5,000 | 35.1 | 120.2 | 22.8 |
| 10,000 | 47.7 | 170.9 | 34.1 |

Input-to-first-primary-write marker, milliseconds:

| Completed sets | Main (debounced) | PR #12 only | Final native |
| --- | --- | --- | --- |
| 0 | 454.0 | 2.9 | 1.9 |
| 120 | 456.4 | 5.0 | 1.8 |
| 1,000 | 461.4 | 12.8 | 2.7 |
| 5,000 | 503.0 | 60.2 | 9.3 |
| 10,000 | 556.5 | 84.2 | 14.6 |

### Startup and first Progress — no blanket speed claim

Median milliseconds:

| Completed sets | Main cold | Native cold | Main warm | Native warm | Main Progress | Native Progress |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 522.2 | 653.3 | 202.9 | 171.5 | 36.4 | 39.1 |
| 120 | 661.0 | 601.4 | 173.7 | 161.4 | 68.4 | 55.2 |
| 1,000 | 592.0 | 596.2 | 211.2 | 193.4 | 167.3 | 152.6 |
| 5,000 | 705.0 | 698.7 | 317.7 | 230.6 | 581.4 | 573.0 |
| 10,000 | 874.8 | 739.0 | 356.2 | 262.4 | 1,035.3 | 966.5 |

Cold launch did **not** improve consistently. With no completed history, the
observed cold median rose from **522.2 to 653.3 ms**; the cold document's execution
counter rose from 287.7 to 354.9 ms. At 1,000 sets the cold medians were essentially
flat (592.0 / 596.2 ms). Do not infer a guaranteed cold-start improvement from
smaller transfer size. Three unthrottled shared-runner samples do not establish
statistical significance or a physical-phone population result.

First Train remained 57–86 ms in the final scaling cases, after removal of the
340 ms lazy-logger regression. Sparse-history Progress returned to 39–153 ms
after removal of the lazy-overview floor. The You surface still costs roughly
255 ms at 5,000 sets and 450 ms at 10,000; it is not described as instant.
The 5,000-set You median rose from 236.8 to 254.8 ms. These remaining costs merit
separate profiling rather than another late architectural change.

### Memory and storage cost

Post-workflow V8 heap after forced collection, decimal MB (1 MB = 1,000,000 bytes):

| Completed sets | Main MB | PR #12 MB | Native MB |
| --- | --- | --- | --- |
| 0 | 10.0 | 9.9 | 8.6 |
| 120 | 10.2 | 10.2 | 8.9 |
| 1,000 | 10.4 | 10.4 | 9.5 |
| 5,000 | 11.3 | 11.3 | 12.2 |
| 10,000 | 12.4 | 12.3 | 15.4 |

At 10,000 sets the retained heap increased from 12.36 to
15.42 MB (**+3.06 MB**, +24.7%).
Keeping validated storage/history views trades memory for less repeated work.
Uncollected heap readings fluctuate with collection timing and are retained in
the raw evidence; they are not peak process memory. Browser/worker/GPU/OS memory
is outside this measurement. The synthetic primary-store text is about 2.22 MB
at 10,000 sets; UTF-8 JSON length is not a browser storage-quota guarantee.
Whole-store synchronous serialization remains and no IndexedDB migration occurs.

### Offline results

| Source | Offline new-page ready | Server configured to hang: ready | Document network requests in successful hanging probes |
| --- | --- | --- | --- |
| Main | 15/15 | 0/15 | Not successful; actual requests hit 3,500 ms timeout |
| PR #12 only | 15/15 | 0/15 | Not successful; actual requests hit 3,500 ms timeout |
| Final native | 15/15 | 15/15 | 0 |

The final installed shell bypassed document HTTP entirely while the server was
configured to hold document requests unanswered. Baselines actually issued those
requests and timed out. The successful final probe therefore demonstrates a
cache-first bypass, not an uncached hanging-request fallback test. Offline
record/edit/Undo/finish, interrupted installation and first-use offline guide
behavior are covered by the separate browser/unit suites in the release report.
No service-worker benchmark proves iOS screen-lock execution or notification sound.

### Screenshots and provenance

The corrected main matrix captured **60** frames and the final matrix captured
**60**, across 320×568 / 375×812 / 390×844 / 430×932 / 820×1180 portrait /
1194×834 landscape, both themes. No frame had document-width overflow.
PR #12-only has no screenshot matrix. The 15 matching pairs below are unedited
copies of the corrected 18 November outputs; [the manifest](screenshots/native/manifest.json)
records each image SHA-256 and build provenance. The browser's fixed training
date is 17 November for repeatability; capture dates are 18 November.

Focus captures mark core logging ready; optional secondary controls can still be
loading in the first frame. Stable tablet examples below use the rest phase,
after secondary controls resolve. Whole-page stability is not substituted for
or silently mixed into the core-ready timing definition. Large-text, hit-target,
keyboard and data-preservation assertions belong to the separate browser tests.

| Frame | Main | Final native |
| --- | --- | --- |
| 320x568 · light focus | [Before](screenshots/native/before/320x568-light-focus.png) | [After](screenshots/native/after/320x568-light-focus.png) |
| 320x568 · light rest | [Before](screenshots/native/before/320x568-light-rest.png) | [After](screenshots/native/after/320x568-light-rest.png) |
| 375x812 · light focus | [Before](screenshots/native/before/375x812-light-focus.png) | [After](screenshots/native/after/375x812-light-focus.png) |
| 390x844 · light today | [Before](screenshots/native/before/390x844-light-today.png) | [After](screenshots/native/after/390x844-light-today.png) |
| 390x844 · light focus | [Before](screenshots/native/before/390x844-light-focus.png) | [After](screenshots/native/after/390x844-light-focus.png) |
| 390x844 · dark focus | [Before](screenshots/native/before/390x844-dark-focus.png) | [After](screenshots/native/after/390x844-dark-focus.png) |
| 390x844 · light quick log | [Before](screenshots/native/before/390x844-light-quick-log.png) | [After](screenshots/native/after/390x844-light-quick-log.png) |
| 390x844 · light rest | [Before](screenshots/native/before/390x844-light-rest.png) | [After](screenshots/native/after/390x844-light-rest.png) |
| 390x844 · light progress | [Before](screenshots/native/before/390x844-light-progress.png) | [After](screenshots/native/after/390x844-light-progress.png) |
| 430x932 · light focus | [Before](screenshots/native/before/430x932-light-focus.png) | [After](screenshots/native/after/430x932-light-focus.png) |
| 820x1180 · light rest | [Before](screenshots/native/before/820x1180-light-rest.png) | [After](screenshots/native/after/820x1180-light-rest.png) |
| 820x1180 · light quick log | [Before](screenshots/native/before/820x1180-light-quick-log.png) | [After](screenshots/native/after/820x1180-light-quick-log.png) |
| 1194x834 · light today | [Before](screenshots/native/before/1194x834-light-today.png) | [After](screenshots/native/after/1194x834-light-today.png) |
| 1194x834 · light rest | [Before](screenshots/native/before/1194x834-light-rest.png) | [After](screenshots/native/after/1194x834-light-rest.png) |
| 1194x834 · light progress | [Before](screenshots/native/before/1194x834-light-progress.png) | [After](screenshots/native/after/1194x834-light-progress.png) |

The images are synthetic localhost evidence. They establish neither physical
Safari/iPhone/iPad rendering nor native Dynamic Type, keyboard, VoiceOver,
suspension, storage eviction, haptics, or lock-screen audio. See the physical
checklist in [the implementation report](NATIVE_EXPERIENCE.md).
