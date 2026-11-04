# Setline V16 product maturity release

Baseline: main `b690534` (V15). V13.1 `c086944` remains in the ancestry. The existing app and version-1 storage were extended; no production workouts were generated, deleted, reset or migrated to another origin.

## What changed

- **SL-001:** completion uses immutable session/exercise/set targets and synchronously consumed action intents. Authoritative no-op transitions cannot save again or restart rest. Focus, Quick Log and All sets protect duplicate activations. Explicit Ready / selection / input arms a separate Focus completion; separate Undo preserves values and cancels only the relevant rest timer.
- **SL-002:** Today, Train, preview, active sessions and History display the saved workout title. Historical names and identifiers are unchanged.
- **SL-003 / SL-011:** previous metrics use the exercise's actual logging type and original set ordinal. Machine labels are optional. Session suggestions, previous-set reuse, progress records, charts and weekly comparisons share configuration/equipment identity. Unlabeled older records remain unlabeled. Matched-rep load changes qualify missing effort and identify their dates; estimated 1RM excludes inappropriate movements.
- **SL-004 / SL-005 / SL-009:** only an absent store gets neutral preferences, unknown body weight, no personal nutrition or sport schedule, and no supplement routine. Three-step setup can be completed, skipped or bypassed to restore a backup. Beginner templates use appropriate equipment and modest prescriptions. Track my own workouts opens an empty builder.
- **Simple / Athlete:** new installations start in Simple. Established installations retain Athlete unless changed. The modes share all data; advanced effort controls remain available in a disclosure. Preferences can be edited without replacing the existing plan. Explicit replacement preserves the previous plan and is blocked during an active workout.
- **Quick Log:** compact working-set rows share the Focus session, including decimal weights, corrections, RIR, metric-specific previous results, timers and refresh recovery.
- **Nutrition:** quick calorie/protein entry, favorites, quantity adjustment and recent reuse. Missing carbohydrate/fat values are explicit unknowns; partial totals are labeled. New Athlete users do not inherit the owner's V13.1 nutrition targets. Missing body weight does not create a zero calorie estimate.
- **Data trust:** discoverable backup controls, exact current origin, local storage explanation, last export action, separately labeled user confirmation of an external file, dismissible reminders and safe device/domain transfer guidance. Existing full validation, restore preview, pre-restore safety copy and stale-tab protection remain.
- **Support / education:** optional short training-term explanations; local problem-report copy/export with opt-in whitelisted diagnostics. No report is claimed submitted. Storage/privacy information is discoverable.
- **Long-term use:** all-history search with bounded initial rendering, memoized historical calculations, existing progress visualizations, offline cache and safe PWA update flow retained.

## Validation

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 546 passed, 0 failed |
| `npm run build` | Passed; existing bundle-size advisory remains |
| `npm run test:web -- --workers=6` | 278 / 280 passed; two long flows exhausted the 45-second test budget |
| Targeted quiet browser rerun (`--workers=1`) | 4 / 4 passed: all three native-scroll sizes and the complete plan-edit flow; all 280 distinct browser scenarios verified |

No functional assertion failures remain. The landscape scroll stress performs up to 40 paced native gestures (12 CDP steps each); its timeout is now 90 seconds to cover accumulated IPC under concurrent CI load. Scroll, bounds, selection and body-unlock assertions are unchanged. The plan-edit test retains its 45-second budget and passed in 9.1 seconds when isolated. The quiet scroll cases passed in 9.3, 10.1 and 19.7 seconds.

The critical final-build browser run passed all 21 cases, including mouse, touch, pointer and keyboard bursts in All sets, separate undo/next completion, 320px layouts, unknown fresh profile, mode switching, welcome-screen backup restore and legacy full-data restore. The other new functional cases also passed their targeted runs. The later complete regression and the explicit quiet rerun above cover every browser scenario. A further 22-case focused-logging regression run passed after the final short-phone layout adjustment.

Automated coverage includes active-workout refresh/interruption, invalid restore atomicity, old backups, V13.1 upgrade/restoration and prescriptions, substitutions, jump measurement/contact classification, partial meal semantics, PWA offline use and updates, keyboard/focus/contrast, safe areas and diagnostics privacy. Existing regression fixtures now explicitly represent established installations; fresh-user tests use genuinely empty storage.

See [actual 1,000 / 5,000 / 10,000-set workflow measurements](V16-PERFORMANCE.md) for startup, input, search, chart, export/restore and serialized sizes. Synthetic stress records exist only in isolated test contexts. No IndexedDB migration was required or performed.

## Release and deployment evidence

PR #1 was reviewed: its origin/share backup changes overlap functionality already present in main; its branch was not merged, overwritten or copied wholesale. V16 has its own feature branch and pull request.

The V16 pull request and its checks provide the merge and deployment evidence; match the Production – gym-kveq deployment to the resulting main commit. A successful merge alone is not deployment proof. The user's existing address is `https://gym-kveq.vercel.app`. The cloud environment restricts outbound hosts and has no Vercel credentials; direct access to that address is blocked and the web-fetch tool also cannot access it. GitHub's Vercel production deployment status can verify the deployed commit and project, but does not independently prove alias binding or successful rendering at the existing address. No domain or origin changes are made.

## What still needs external validation or setup

Physical iPhone Safari and installed-PWA checks remain necessary for VoiceOver quality, actual numeric keyboard/visual viewport, Dynamic Type, one-handed reach, storage pressure/eviction, background suspension and locked-screen timer sound. Chromium with mobile viewport, touch and an iPhone user-agent is browser automation, not a physical device test. Locked-screen audio reliability is not claimed.

Authenticated cloud backup, Apple Health, AI food photography and large hosted exercise media remain deferred. No fake sync, photo inference, public personal-data database or frontend secret was introduced. [Data trust and cloud architecture](SETLINE_V16_DATA_TRUST.md) documents authentication, authorization, snapshots, conflicts, restore validation and deletion requirements.

A public commercial launch still needs an operator identity, a real support contact, applicable terms and professional privacy/legal review. The app describes its actual local-first behavior; no legal certification or commercial-readiness certification is claimed.

## Short walkthrough

1. Existing users open their current plan unchanged. New users choose a goal, experience and setup, skip, or restore an existing backup.
2. Train → Focus / Quick Log changes the logging layout. Complete targets one group; use Ready, an explicit set selection or input to intentionally continue. Undo retains entered values.
3. Exercise equipment label separates comparisons across machines. Progress → Training journey and History show recorded progress; History searches old workouts as well as recent ones.
4. You → Settings changes Simple / Athlete. You → Training preferences keeps the plan unless replacement is explicitly selected.
5. You → Nutrition → Quick entry records calories/protein without invented macros; favorites and quantities speed reuse.
6. You → Backup & data shows storage/origin and backup actions. Report a problem prepares a local report. Existing PWA update controls offer an update when the worker detects one and protect active work.
