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

The final app runtime is `02ddc63`. The raw final report records the observed
checkout `ae6efff`, whose later commit changes only a browser-test helper. The
production build was created after the guide-trigger fix: the lightweight guide
trigger is eager so optional guide loading cannot move the All Sets touch target;
the heavy guide sheet, Recharts and secondary screens remain deferred. The
baseline/PR12 builds are immutable worktrees. All earlier native measurements are
superseded and excluded from these tables.

The corrected baselines were captured around 07:05–07:07 UTC; the final native
rerun occurred later the same day. Matching recorded host, browser, fixtures and
settings does not remove elapsed-time or shared-host drift. These sequential
windows are neither simultaneous nor interleaved comparisons.

| Source | Observed commit | Cache suffix | Captured UTC |
| --- | --- | --- | --- |
| Main | 693265cc96c0 | 0c12b755da157bd1ac30 | 2026-11-18T07:05:29.103Z |
| PR #12 only | 8e5f30d35166 | c178374091852999fd74 | 2026-11-18T07:07:41.106Z |
| Final native | ae6efff6d23a | 97c7ccee3df79a773bac | 2026-11-18T15:19:15.798Z |

| Source | Build HTML SHA-256 |
| --- | --- |
| Main | 85b899f4d100efa147e850b2be7774ea056ace9b91964161dda3c2a33092e3ef |
| PR #12 only | cb17ff646aff31ecd70ac18f6e079bc6b81c4231076a2eaba3c5b0a19013e7e2 |
| Final native | 0bcb20ec8d4f8958329d245a7841ade40fd7c561b4b00faf4faacfac2037c4d6 |

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
| Initial HTML-linked JS body | 1,350,752 | 1,361,603 | 1,134,304 |
| Initial JS gzip estimate | 388,981 | 392,053 | 334,259 |
| All generated JS bodies | 2,310,366 | 2,321,217 | 2,338,522 |
| All JS gzip estimate | 610,145 | 613,222 | 629,437 |

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
| Cold Today ready | 874.8 | 761.0 | 778.6 |
| Warm Today ready | 356.2 | 432.9 | 286.5 |
| Cold document JS execution | 567.9 | 489.1 | 493.3 |
| Warm document JS execution | 288.8 | 291.8 | 152.3 |
| Cold document main-thread tasks | 783.6 | 783.7 | 707.9 |
| First Train ready | 98.7 | 109.4 | 92.7 |
| Input → frame with 57.5 shown | 47.7 | 170.9 | 26.7 |
| Input → first primary write | 556.5 | 84.2 | 13.5 |
| Completion → completed-set frame | 173.7 | 180.8 | 52.1 |
| Completion → first primary write | 61.5 | 52.1 | 13.0 |
| First Progress overview/SVG | 1,035.3 | 1,099.5 | 1,038.2 |
| You ready | 453.2 | 479.3 | 473.3 |
| Return to Today | 80.1 | 73.8 | 29.7 |
| Cached offline Today ready | 788.9 | 877.1 | 631.0 |

Main's input write includes its approximately 450 ms debounce. Its in-memory
frame can precede storage by that delay, so it does not offer equivalent
immediate persistence. PR #12 already removed the debounce; the final comparison to PR #12 isolates the added caching
and historical-computation work more fairly. A successful primary `setItem`
precedes this branch's completion acknowledgement, but is not a disk-fsync or
arbitrary OS-crash guarantee.

The Progress overview still takes approximately **1,038 ms** at 10,000 sets,
compared with 1,035 ms on Main. This remains close to one second of large-history
processing; the data does not support a dramatic chart-speed claim.

### Input scaling — all samples retained

Input-to-frame marker, milliseconds:

| Completed sets | Main | PR #12 only | Final native |
| --- | --- | --- | --- |
| 0 | 20.2 | 28.9 | 22.6 |
| 120 | 21.5 | 41.9 | 17.0 |
| 1,000 | 23.0 | 54.1 | 20.7 |
| 5,000 | 35.1 | 120.2 | 21.5 |
| 10,000 | 47.7 | 170.9 | 26.7 |

Input-to-first-primary-write marker, milliseconds:

| Completed sets | Main (debounced) | PR #12 only | Final native |
| --- | --- | --- | --- |
| 0 | 454.0 | 2.9 | 2.8 |
| 120 | 456.4 | 5.0 | 2.5 |
| 1,000 | 461.4 | 12.8 | 4.2 |
| 5,000 | 503.0 | 60.2 | 8.1 |
| 10,000 | 556.5 | 84.2 | 13.5 |

### Startup and first Progress — no blanket speed claim

Median milliseconds:

| Completed sets | Main cold | Native cold | Main warm | Native warm | Main Progress | Native Progress |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 522.2 | 693.9 | 202.9 | 173.1 | 36.4 | 51.7 |
| 120 | 661.0 | 567.9 | 173.7 | 156.8 | 68.4 | 61.7 |
| 1,000 | 592.0 | 778.4 | 211.2 | 174.4 | 167.3 | 156.5 |
| 5,000 | 705.0 | 662.5 | 317.7 | 230.9 | 581.4 | 558.8 |
| 10,000 | 874.8 | 778.6 | 356.2 | 286.5 | 1,035.3 | 1,038.2 |

Cold launch did **not** improve consistently. With no completed history, the
observed cold median changed from **522.2 to 693.9 ms**; the cold document's
execution counter changed from 287.7 to 385.0 ms. At 1,000 sets, the cold
medians were 592.0 / 778.4 ms. Smaller transfer size does not guarantee faster
cold startup. Three unthrottled shared-runner samples do not establish statistical
significance or a physical-phone population result; the same-day time gap is an
additional comparison limit.

First Train ranged from 60.4 to 92.7 ms across the final scaling cases. Sparse-history
Progress medians ranged from 51.7 to 156.5 ms for 0 / 120 / 1,000 completed sets.
The You surface costs 250.6 ms at 5,000 sets and 473.3 ms at 10,000;
it is not described as instant. Main's corresponding You medians were
236.8 and 453.2 ms. These remaining costs merit separate profiling.

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
15.44 MB (**+3.07 MB**, +24.9%).
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

Focus captures mark core logging ready. The lightweight guide trigger is eager
in this build; its heavy sheet loads on demand. The unchanged screenshot driver
waits for the planned-exercise pane on wide tablets and otherwise uses the same
core-ready selectors; those screenshot waits are not substituted for the timing
markers. Large-text, hit-target, keyboard and data-preservation assertions belong
to the separate browser tests.

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
