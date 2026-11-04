# Setline V16 measured long-term workflows

Measured 2026-11-04T07:25:36.863Z against the existing production build (PWA cache `3c0a2d098fac71f93c28`), branch HEAD `c08f1b0`. Run with `npm run build` followed by `node scripts/benchmark-v16.mjs`.

## Actual observations

All durations below are milliseconds, one run per fixture. These are observations, not percentile service-level guarantees.

| Completed sets | Workouts | Startup | Input → frame | Input → saved | History search → frame | All-history chart → frame | Export request | Restore → atomic write | Stored JSON UTF-8 bytes | Backup UTF-8 bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 50 | 594.7 | 24.8 | 467.7 | 6.5 | 21.2 | 13.3 | 11.9 | 184,442 | 427,163 |
| 5,000 | 250 | 493.9 | 31.8 | 493.0 | 8.9 | 67.6 | 38.5 | 37.3 | 872,442 | 2,034,163 |
| 10,000 | 500 | 538.4 | 48.6 | 511.0 | 9.0 | 116.1 | 101.2 | 62.2 | 1,732,442 | 4,042,913 |

## Method and limits

- Synthetic records run only inside isolated test browser contexts: 50/250/500 completed workouts, five weighted exercises and four sets each, distributed across approximately four years for the largest fixture. One unfinished workout is included and verified after export/restore. No production/user browser data is read or modified.
- Browser: Chromium 151.0.7922.173, 390×844 mobile viewport, touch enabled, iPhone user-agent string. Runtime: linux 6.18.57; Node v24.19.0; AMD EPYC 9V74 80-Core Processor; 3 logical CPUs; 10 GiB host memory. No CPU/network throttling. This is browser automation on a cloud machine, not physical iPhone testing.
- Startup runs from the end of test-only record provisioning in a browser initialization script to the first animation frame showing the loaded active-workout title. It includes application bootstrap, saved-data reads/validation and rendering; it excludes fixture serialization/writing. The raw measurements separately include navigationToReady, which starts at the browser navigation time origin and includes fixture provisioning. The app shell is fresh in each isolated context. Local server transfer and service-worker installation may overlap startup.
- Input starts at the real input event, then records the next animation frame and the first subsequent main-data storage write. The save duration includes the intentional input-save batching interval. Saved decimal weight is verified from storage.
- Search starts at the real input event and ends at the first animation frame containing exactly the matching oldest workout. The initial History view renders at most 40 records; search covers all records. Opening History and typing latency from the automation protocol are excluded.
- Chart time starts at the All history click and ends at the first animation frame containing one SVG point per completed workout in the selected strength series. The default chart route has already loaded. This measures all-history derivation/rendering; it excludes initial lazy-chunk transfer.
- Export time starts at Export backup click and ends when the download anchor is invoked. The downloaded backup is read and its completed-set count verified. This measures export generation/request, not successful long-term preservation of the file.
- Restore begins at the Restore backup click (confirmation automatically accepted in this test), validates the backup, preserves the pre-restore safety copy and ends after the atomic main-data write. The app reload and exact restored sessions/profile/nutrition/reminders are separately verified. Browser disk-flush durability is not claimed.
- Stored size is the actual serialized main JSON encoded as UTF-8, not the browser's quota accounting. The JSON contains 1,000: 184,441 UTF-16 code units; 5,000: 872,441 UTF-16 code units; 10,000: 1,732,441 UTF-16 code units. Browser quotas and available device storage vary. The restore safety copy temporarily stores another complete dataset.
- All measured workflows completed without an IndexedDB migration. This result does not guarantee acceptable latency/quota on older iPhones, private browsing, constrained storage or much larger records. Export/restore remain the recovery path; no unverified destructive migration was introduced.

## Physical iPhone validation still required

VoiceOver announcement quality and rotor navigation; actual iOS numeric keyboard and visual-viewport resizing; Dynamic Type / browser text scaling; one-handed reach; installed PWA update prompts; offline behavior after long suspension or storage pressure; background and locked-screen timer/audio behavior. Automated mobile viewport, safe-area, focus, reduced-motion and offline tests provide partial evidence only. Locked-screen audio reliability is not claimed.

## Raw measurements

```json
{
  "runtime": {
    "node": "v24.19.0",
    "platform": "linux",
    "release": "6.18.57",
    "cpu": "AMD EPYC 9V74 80-Core Processor",
    "logicalCpus": 3,
    "memoryBytes": 10452459520
  },
  "results": [
    {
      "completedSets": 1000,
      "completedWorkouts": 50,
      "browser": "151.0.7922.173",
      "viewport": {
        "width": 390,
        "height": 844
      },
      "milliseconds": {
        "startup": 594.6999999997206,
        "navigationToReady": 678,
        "inputPaint": 24.799999999813735,
        "inputSave": 467.6999999997206,
        "historySearch": 6.5,
        "chartRender": 21.200000000186265,
        "exportRequest": 13.299999999813735,
        "restore": 11.899999999906868
      },
      "storage": {
        "utf8Bytes": 184442,
        "utf16CodeUnits": 184441,
        "backupUtf8Bytes": 427163
      },
      "observedAt": "2026-11-04T07:25:36.863Z"
    },
    {
      "completedSets": 5000,
      "completedWorkouts": 250,
      "browser": "151.0.7922.173",
      "viewport": {
        "width": 390,
        "height": 844
      },
      "milliseconds": {
        "startup": 493.89999999990687,
        "navigationToReady": 584.1000000000931,
        "inputPaint": 31.799999999813735,
        "inputSave": 493,
        "historySearch": 8.899999999906868,
        "chartRender": 67.60000000009313,
        "exportRequest": 38.5,
        "restore": 37.3000000002794
      },
      "storage": {
        "utf8Bytes": 872442,
        "utf16CodeUnits": 872441,
        "backupUtf8Bytes": 2034163
      },
      "observedAt": "2026-11-04T07:25:43.031Z"
    },
    {
      "completedSets": 10000,
      "completedWorkouts": 500,
      "browser": "151.0.7922.173",
      "viewport": {
        "width": 390,
        "height": 844
      },
      "milliseconds": {
        "startup": 538.3999999999069,
        "navigationToReady": 647.8999999999069,
        "inputPaint": 48.60000000009313,
        "inputSave": 511,
        "historySearch": 9,
        "chartRender": 116.10000000009313,
        "exportRequest": 101.20000000018626,
        "restore": 62.200000000186265
      },
      "storage": {
        "utf8Bytes": 1732442,
        "utf16CodeUnits": 1732441,
        "backupUtf8Bytes": 4042913
      },
      "observedAt": "2026-11-04T07:25:50.824Z"
    }
  ]
}
```
