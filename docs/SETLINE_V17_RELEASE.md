# Setline V17 — Calm Performance

Inspected baseline: V16 on main, `dcc75aa1271762f8c7fa35ed3abe5a347333dc24`.
V17 is an incremental interface refinement on the existing React application.
This document describes the implementation; it is not deployment evidence.
Local branch: `codex/setline-v17-calm-performance`. Implementation commit:
`5e6d38a`. Main and origin/main remain at the inspected V16 baseline.
PR #1 was reviewed and was not merged or modified by this task. No V17 remote
branch, pull request, merge or production deployment was created.

## Confirmed problems and changes

| Area | Before | V17 |
| --- | --- | --- |
| Strength progress | The empty Strength view offered `Log weight`, leading to body-weight entry. | `Start a strength workout` selects an existing planned strength session, or `Continue workout` resumes an active session. An explicit Back to Progress action preserves the originating view. |
| Body-weight progress | The generic weight label blurred body mass and lifting load. | `Body weight` and `Log body weight` are explicit. Saving or cancelling entry opened from Progress returns to that view and metric. |
| Warm-up | Start, bulk completion and warmed-up shortcuts competed for attention. | Start workout is primary; Skip warm-up is secondary. Individual drills show clear checks and progress. Full preparation keeps saved instructions, alternatives and the explicit warmed-up-elsewhere action. |
| Focus | Coaching and secondary context competed with current-set controls. | Exercise, set, previous result, inputs and completion lead. Training notes holds equipment and detailed guidance; optional RIR, technique and session controls remain accessible. A recorded-set receipt replaces general coaching in the primary flow. |
| Quick Log | Bodyweight rows such as Dead Bug displayed kilograms by default. | Saved exercise metadata determines fields. Bodyweight shows reps; timed/isometric work shows duration; measured jumps retain their measurement; weighted drills retain load. Optional added weight remains available and an existing positive load stays visible. |
| Today | Release/plan metadata and repeated messaging competed with the workout. | One main session uses a factual session-type label. Technical version information moves to settings. A volleyball session already featured today is not duplicated as the next on-court item. |
| Preview | Repeated purpose text and tall rows made long plans expensive to scan. | Compact rows show name, sets/target, rest and optional equipment/pair identity. Opening exercise details retains saved session cues, restrictions, RPE and instructions. |
| Settings | Unrelated controls shared one long surface with ambiguous saving. | Three groups: Training; Appearance & Sound; Data & Backup. Body weight/default rest have Save training defaults and an unsaved status. Mode, theme and sound retain automatic saving. Group changes keep mounted drafts and restore previews. |

Warm-up checkbox focus also survives the brief save/disabled transition, allowing
keyboard users to check and uncheck the same drill without losing their place.

## Reliability and preservation boundaries

- V16's immutable set targets, consumed completion intents, authoritative no-op
  transitions and Undo remain the logging foundation. V17 does not replace this
  already-working protection with a debounce.
- Focus and Quick Log edit the same active session and history. Field visibility
  is presentation only; hiding an optional input does not clear saved data.
- No storage key, schema version, backup format, origin or migration changes are
  introduced. `setline.gym.v1`, validated restore, stale-tab protections and
  pre-restore safety copies remain in place.
- No personalized prescription, weekly volume, jump dosage, health restriction,
  custom plan, nutrition record or supplement routine is rewritten by this update.
- Existing and fresh installations retain V16's separate initialization behavior.
  New users do not inherit the owner's athlete profile; established data is not
  reset to the neutral onboarding profile.
- Existing local-first operation, rest deadlines, offline cache generation and
  protected PWA update controls remain. Unsaved training defaults still block an
  update reload until saved.

## Interface and accessibility

The existing forest/sage and warm-neutral tokens remain the shared system.
Spacing, text scale, row density, button states and touch targets are refined
without adding a navigation tab, dashboard, dependency or animation delay.
The changes retain system/light/dark appearances, safe-area styling and reduced
motion support. Settings moves focus to the selected group heading without
automatically opening a numeric keyboard.

## Verification evidence

V17 adds regression cases for Progress routing and return context, warm-up
provenance and keyboard interaction, focused logging, exercise-type inputs,
320/375/390/430px Quick Log layouts in light and dark, shared session persistence,
Today/preview density and settings draft behavior. Existing regression tests are
adapted to use the real grouped navigation and individual warm-up controls.

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 550 passed, 0 failures or skips |
| `npm run build` | Passed; existing large-bundle advisory remains |
| Full `npm run test:web -- --workers=3` | 306 passed, 6 failed in 18.9 minutes; failures used old UI expectations/navigation |
| Corrected UI and V17 regression rerun, 2 workers | 57 passed in 2.9 minutes |
| Quiet 1,000 / 5,000 / 10,000-set stress rerun, 1 worker | 3 passed in 20.7 seconds |
| Corrected offline activity export rerun, 1 worker | 1 passed in 10.1 seconds |
| `npm run lint` | Cannot run lint checks: the repository has no lint script or configuration |
| `git diff --check`; capture script `node --check` | Passed |

All 312 distinct browser scenarios have passing evidence across the full run
and scoped reruns. The full run is not described as a clean 312-test pass.
Its six failures were an old recovery label, the former single-line pair-rest
label, and four export paths missing the new Data & Backup navigation. The
updated tests retain the original record, rest-value, offline and restore
assertions. The reruns also verify the explicit Back to Progress control and
the final test files. V16 duplicate-completion protection was verified before
visual changes, then exercised again by the full regression.

The finalized V17 build precaches 26 app files under
`setline-pwa-f14211e346d21ff618ec`. Baseline and after screenshots use isolated local QA data in
`artifacts/v17/before` and `artifacts/v17/after`; they do not modify production
workouts or imply deployment.

### Measured long-term workflows

The existing V16 stress fixture was exercised against the V17 build on
4 November 2026, using Chromium 151.0.7922.173, one worker, a 390×844 touch
viewport, and the Linux environment's two-CPU quota and 8 GiB memory limit.
All three cases passed exact completed-set counts and full export/restore
comparisons, including the active session, profile, nutrition and reminders.
The settings-navigation step now opens Data & Backup before measurement.

| Completed sets | Startup (ms) | Input paint (ms) | History search (ms) | Chart render (ms) | Export request (ms) | Restore write (ms) | Serialized UTF-8 bytes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1,000 | 647.7 | 28.4 | 7.4 | 22.4 | 22.6 | 9.5 | 184,442 |
| 5,000 | 486.1 | 36.1 | 6.8 | 61.3 | 39.8 | 33.4 | 872,442 |
| 10,000 | 504.0 | 44.8 | 8.5 | 126.0 | 91.1 | 79.4 | 1,732,442 |

These are single local observations, not device guarantees or a statistical
performance comparison with V16. Startup excludes fixture provisioning; the
separately observed navigation-to-ready times were 724.5 / 594.2 / 659.6 ms.
Input-to-storage times were 463.4 / 499.0 / 515.9 ms and include the existing
450 ms batched save. They are distinct from visible input responsiveness.
Export measures requesting a browser download, not permanent external-file
preservation. Restore measures confirmation to records write, excluding the
earlier file-preview step and subsequent page reload. UTF-8 serialization size
is not a measurement of browser quota accounting or device memory usage.

Reproduce with a production build served on localhost:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
SETLINE_BENCHMARK_REPORT_DIR=artifacts/v17/performance \
npm run test:web -- 'v16-performance-stress.web' --workers=1
```

The retained test filename and fixture describe their V16 origin; the measured
application in this run is V17. Raw JSON outputs are local artifacts. No storage
migration or training-data rewrite was needed or introduced.

### Reproduce screenshots

Use Node.js 24 and installed project dependencies. Build the desired revision,
then serve that existing build with `node scripts/serve-web.mjs` on the fixed
`http://127.0.0.1:4173` origin. In another terminal run:

```sh
node --experimental-strip-types scripts/capture-v17.mjs before
node --experimental-strip-types scripts/capture-v17.mjs after
```

Run `before` against a separately checked-out/built V16 baseline (`dcc75aa`),
with this capture script available there; run `after` against the V17 build.
Do not run both commands against the same build and label that a comparison.
The script does not build or start the server, so do not replace the served build
while browser tests or another capture are running. It accepts only `before` or
`after` and does not accept a production URL.

Both stages use the same isolated legacy-plan fixture, empty history, fixed
Monday clock (2026-11-02 10:00 UTC), 390×844 mobile/touch viewport and a second
mixed bodyweight/timed/weighted fixture for Quick Log. No user's browser profile
is loaded. Chromium defaults to `/usr/bin/chromium`; set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if a different local executable is needed.
The original screenshot timing and device settings are preserved in both stages.
PNG screenshots and any local HTML review artifacts under `artifacts/` are ignored,
untracked files; they are not part of the application bundle or a deployment.
Both capture stages completed against their respective builds. The local
`artifacts/v17/index.html` gallery pairs the seven major surfaces. Captures use
the same settled-animation timing; transitional overlays are not used as the
before comparison.

Physical iPhone Safari/PWA validation remains separate from Chromium mobile
automation: actual iOS numeric keyboard, Dynamic Type, VoiceOver, thumb reach,
background suspension, storage eviction and locked-screen audio still require
supported devices. No locked-screen sound reliability is claimed.

## Short walkthrough

1. **Progress → Strength:** start or continue strength training; use Back to
   Progress to return. **Body weight → Log body weight** is a separate action.
2. **Start workout:** check the drills performed, open Full preparation if useful,
   then Start workout; Skip warm-up records no unperformed preparation.
3. **Train → Focus / Quick Log:** switch layouts without creating a second log.
   Use Training notes or Details for optional information and load fields.
4. **View workout:** scan compact prescriptions, then tap an exercise for full
   technique and saved session details.
5. **You → Settings:** Training holds defaults/presentation; Appearance & Sound
   holds theme/rest audio; Data & Backup holds backup, update and support controls.

## Changed files

All paths are relative to the repository root. No storage, domain, plan-generator,
dependency or deployment-configuration file is changed.

Application (22):

```text
src/App.jsx
src/FocusedWorkout.tsx
src/NutritionView.jsx
src/ProgressOverview.tsx
src/QuickWorkoutLog.tsx
src/SettingsExperience.tsx
src/SupportPrivacy.tsx
src/TodayView.jsx
src/TrainingPlanStatus.tsx
src/WarmupFlow.tsx
src/WorkoutPlanPreview.tsx
src/WorkoutPreview.tsx
src/exercise-input.ts
src/focused-workout.css
src/progress-overview.css
src/quick-workout-log.css
src/settings-experience.css
src/today.css
src/training-plan-status.ts
src/warmup-flow.css
src/workout-plan-preview.css
src/workout-preview.css
```

Tests (33):

```text
tests/helpers/navigation.ts
tests/journal-experience.web.spec.ts
tests/jump-measurement.web.spec.ts
tests/master-program.web.spec.ts
tests/master-v131-upgrade.web.spec.ts
tests/master-v81-upgrade.web.spec.ts
tests/mobile-sheets.web.spec.ts
tests/native-reset.web.spec.ts
tests/premium-performance.web.spec.ts
tests/premium.web.spec.ts
tests/pwa-update.web.spec.ts
tests/recovery-coaching.web.spec.ts
tests/rest-audio.web.spec.ts
tests/session-preparation.web.spec.ts
tests/smart-warmup.web.spec.ts
tests/training-plan-status.test.ts
tests/v131-exposure.web.spec.ts
tests/v131-preparation.web.spec.ts
tests/v14-backup.web.spec.ts
tests/v14-plan-status.web.spec.ts
tests/v16-onboarding.web.spec.ts
tests/v16-performance-stress.web.spec.ts
tests/v16-quicklog.web.spec.ts
tests/v16-trust.web.spec.ts
tests/v17-exercise-input.test.ts
tests/v17-focus.web.spec.ts
tests/v17-progress.web.spec.ts
tests/v17-quicklog.web.spec.ts
tests/v17-settings.web.spec.ts
tests/v17-today-preview.web.spec.ts
tests/v17-warmup.web.spec.ts
tests/web.spec.ts
tests/workout-plan-preview.web.spec.ts
```

Documentation and capture tooling (4):

```text
README.md
VALIDATION.md
docs/SETLINE_V17_RELEASE.md
scripts/capture-v17.mjs
```

## Intentionally deferred

Cloud accounts/sync, Apple Health, AI meal photos, exercise-media expansion,
social features and a new logo are outside this UX update. V16's cloud-backup
proposal remains in [the data trust architecture](SETLINE_V16_DATA_TRUST.md).
Commercial readiness still requires the existing operator/support and legal
review work; this interface update makes no certification claim.

V17 has not been pushed to main or deployed as part of these local changes.
Production publication requires the user's explicit authorization and verified
GitHub/Vercel outcomes.
