# Setline product and reliability audit — 3 November 2026

Baseline: `c086944a6cdd4e9f4979887fb25fb451f9256d0b` (V13.1). This is a code/documentation and published-feature comparison, not a physical iPhone user study. The source and existing regression tests were inspected; the claims below do not imply that this branch's new tests have run.

## Product position

Setline is a focused, installable React/Vite PWA for one volleyball athlete: fast set logging, an eight-week competition-aware program, jump and strength trends, nutrition, reminders and device-local history. Preserve the calm, four-destination phone experience, one-set-at-a-time flow, user-approved V13.1 upgrades, deliberate same-day changes, previous-plan restoration, and historical workout/meal/activity records.

## Benchmark evidence

- [Hevy exercise library](https://www.hevyapp.com/features/exercise-library/), [rest timer](https://www.hevyapp.com/features/workout-rest-timer/), [performance](https://www.hevyapp.com/features/exercise-performance/): searchable exercises, configurable exercise-specific rest and depth in per-exercise records.
- [Strong templates](https://help.strongapp.io/article/105-about-templates), [rest timer](https://help.strongapp.io/article/231-rest-timer): reusable sessions and quick, adjustable set-to-set recovery.
- [Fitbod workout generation](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout), [muscle recovery](https://help.fitbod.me/hc/en-us/articles/43492170863895-How-does-Fitbod-know-my-muscles-are-still-recovering): equipment-aware, feedback-driven recommendations and estimated recovery; the estimate is a model, not a physiological measurement.

These are publisher descriptions, not controlled UX tests or independent proof of training outcomes.

## Ranked findings and action plan

| Priority | Evidence in Setline | Gap / risk | Next action | Acceptance test |
| --- | --- | --- | --- | --- |
| P0 | `src/storage.ts` uses browser `localStorage` under `setline.gym.v1`; JSON export/import exists. | No account backup/sync; changing the browser or origin can make history appear missing. | **This PR:** show the exact current origin and offer native file sharing for backups. **Later:** design explicit, encrypted, opt-in account sync with conflict resolution; never auto-migrate or reset existing local records. | Export, cancel, restore, offline use and new device migration preserve all records; no false success claims. |
| P0 | Commit reports four Vercel contexts: `gym`, `gym-kqeo`, `gym-kveq`, `gym-8d17`. | Multiple deployments may have different origins and separate local data. The exact installed origin was not identified. | Identify the iPhone's actual origin using the new Settings panel; choose one canonical deployment only after a verified backup. | Installed app and canonical URL match; switching origins is an explicit export/import, not presumed automatic sync. |
| P1 | `src/rest-audio.ts` and PWA verification note acknowledge background iOS audio uncertainty. | Locked/background phone can miss timer sound. | Physical Safari/standalone tests; give clear in-app expectations. Avoid claiming guaranteed background alerts without a native integration. | Foreground, music playing, locked, background and resume behavior are documented per tested iOS version. |
| P1 | V13.1 supports match weeks, readiness, clearance and supervised opt-in upgrades. | Fatigue estimates are not direct measurements; added sessions or contacts may overlap volleyball/PE. | Improve context labels and week-at-a-glance totals without automatic prescription increases. | No double-counted jumps or completed activity; match overrides gym and never deletes history. |
| P1 | `src/FocusedWorkout.tsx`, `src/WorkoutPreview.tsx` and customizer have extensive controls. | Set logging speed vs Hevy/Strong remains unverified on a physical device. | Usability study: time to start, log, swap, finish; tackle only observed friction. | Typical session actions comfortably reachable on 320–430px iPhone with keyboard and safe areas. |
| P2 | Library of 158 local moves, text instruction and external demonstration search. | Fitbod advertises richer embedded video demonstrations and equipment adaptation. | Add lightweight, rights-cleared demonstrations for the user's most frequent movements first, with offline-friendly fallback. | Guidance loads quickly, is accessible and does not enlarge the initial bundle excessively. |
| P2 | Nutrition has manual meals, recent foods and targets; import is by exported activity file. | More manual work than barcode/connected-health flows in mature products. | Prioritize fast repeat meals, fewer taps and transparent estimates before paid integrations. | Common meal can be logged in under 15 seconds without inventing nutrients. |
| P2 | Vite build previously reported a large bundle warning; `src/App.jsx` and `src/reference.css` are large. | Initial load and maintainability may suffer. | Measure mobile load, then progressively split infrequently used screens and remove dead styles with regression tests. | Same offline availability, no historical schema changes and improved measured transfer/parse time. |

## First safe change in this branch

1. Display `window.location.origin` in **You → Settings → Your data** with copy affordance, explaining that a different URL has separate records.
2. Add an optional Web Share file action beside the existing JSON export/import, so supported iPhones can choose **Save to Files**. Cancellation is not success. The existing download/export button remains available.
3. Cover address copying, full-data file sharing and cancelled sharing in Playwright.

No training prescription, storage schema, history, nutrition target or hosted access setting is changed. This branch is for review; do not deploy the main branch until build and browser tests pass and the user's installed origin is known.

## Verification gate

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:web`
- Manual Safari/iPhone verification: Save to Files, open the saved JSON, import on a fresh origin, preserve old data, cancel share, and check that the app origin shown matches the installed one.

The current environment can inspect and edit through the connected repository, but it has not executed these commands. Avoid representing the new tests or device checks as passed until observed.
