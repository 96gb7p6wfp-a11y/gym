# Native experience: storage and PR #12 release audit

Audit date: 17 November 2026. This is source and isolated-test evidence. It does
not establish access to an existing iPhone installation or a production release.

## Revision and scope

- Base main: `693265cc96c00f198700c43634bdba8e001d3366` (Setline V18 with
  Volleyball Performance Plan V9; package version remains `2.0.0`).
- Reviewed PR #12 head: `8e5f30d3516667644d9303735cebd0265c0d7eed`.
- PR #13 head incorporated locally:
  `98824e202363cddd31715f2def70831fa6ece4e6`.
- Work is isolated on `codex/native-experience-20261117`. Incorporating these
  heads locally is not a GitHub merge of either existing PR. The current task
  does not authorize merging main or deploying production.
- Main data stays at `setline.gym.v1`, schema version 1, portable backup version
  1. No IndexedDB migration, dependency, origin or program upgrade is introduced.

PR #11's earlier automatic recovery behavior is superseded by PR #12's explicit
choices. It is not merged separately. Remote PR state and final branch-head
validation must be reconfirmed in the delivery report.

## Confirmed findings

### Completion could acknowledge an uncommitted set

PR #12's `App.markSetDone` changed the in-memory session, consumed its completion
intent and started rest before the queued primary write had been confirmed.
When the write failed, the primary record remained safe, but the interface could
advance and suggest that completion had succeeded. Its existing quota test
expected that optimistic advancement. This was a real gap against the newer
requirement that success follow persistence.

The native branch uses the same local client through `requestLocalSync`. It
validates and writes the targeted session first; only a successful primary write
publishes the session, consumes the intent, records Undo and starts rest. A
rejection returns false and keeps the target incomplete and retryable. Existing
promise-based callers retain `requestLocal` and its rejection behavior. The
updated lifecycle/browser cases must pass in the final frozen suite; unit tests
alone cannot verify React advancement.

### Starting a pre-upgrade date could use the current program

The original `planForDate` consulted the V9 archive for dates before
`v9EffectiveDate`, but PR #12's new original-workout start path consulted the
current master settings and plan again. Starting an archived V13.1 date could
therefore choose the current V9 prescription. The draft prescription path could
also apply the current revision to that historical selection. Completed records
were not rewritten, but the newly started session could have the wrong source.

`profileForPlanDate` now supplies the same dated plan and archived program to
preview, draft and original-start resolution. Current medical guidance remains
authoritative; archived clearance is never restored. Archived starts do not
write readiness into the current V9 settings. Three new browser regressions
cover the archived full prescription, current restrictions on that prescription,
and the full 11-exercise/29-set V9 Saturday after activation. They also compare
the prior completed session, profile/archive and nutrition to their fixtures.

### Repeated validation was unnecessary on unchanged local bytes

The original local client parsed and schema-validated every saved workout for
each valid set edit. A unit probe confirms that a 51-workout first read validates
51 records; after the cache change, an ordinary edit validates the submitted
workout once instead of all unchanged records. This is evidence of removed work,
not a measured claim about iPhone latency.

The client retains only an exact-byte validated view. It still reads the primary
key before each request. Changed bytes, corrupt data, deletion and restore
operations invalidate or bypass the view. A new mutable shell and reminder
container isolate request mutations. Arrays and records are replaced, and public
responses are cloned. Cache publication happens after `setItem` succeeds. A
quota error cannot publish a phantom version, profile, session or reminder.

Each save also retains the exact primary bytes read at its start, including null
on a new installation. After validation and serialization, it checks those bytes
again immediately before the primary write. An intervening save rejects the stale
candidate without automatic retry. The same check protects checkpoint/restore
primary commits. A rejected checkpoint rolls back only its own safety-copy slot,
preserving a newer fallback produced by another operation. Deterministic tests
inject changes during validation, serialization, initial creation and safety-copy
creation. This narrows a cross-window race; it is not an atomic compare-and-swap.

This retains synchronous whole-store serialization and an additional raw string
plus validated view in memory. Memory and end-to-end interaction results belong
in the controlled benchmark report; reduced validation does not prove all
workloads became faster.

## The two previously failing PR #12 tests

The checked-in PR #12 validation report records **481 passed / 2 failed** in its
complete run, then **8 passed** across both affected whole files. It explicitly
does not claim one clean 483-case execution. Those are prior reported results,
not a substitute for this branch's clean rerun.

| Test | Original expectation | Reviewed replacement | Coverage assessment |
| --- | --- | --- | --- |
| `v16-quicklog.web.spec.ts` | Click another Ready interstitial after Undo | Ready is absent and the exact undone set's Complete action is enabled | Consistent with explicit Undo rearming; manual values, duplicate taps, timer ownership, shared records and history assertions remain |
| `v9-logging.web.spec.ts` | Final record version equals 2, treating reuse/edit/completion as one debounce | Poll that the manual 60 kg edit is durable, capture its version, then require ten completion taps to add exactly one version | Strengthens durable edit and idempotence checks; next-set suggestions, exactly one done flag, timer and Undo/RIR checks remain |

Neither replacement removes the safety assertion in order to accept duplicate
records. The separate PR #12 quota expectation is changed in this branch because
the optimistic application behavior was incorrect, as described above.

## File-by-file PR #12 review

All 37 changed paths were classified and reviewed against the base/head diff.
The five binaries are screenshot evidence, not executable source or user data.

| Changed path | Review finding |
| --- | --- |
| `README.md` | Describes local durability and explicit choices; does not add cloud-sync claims |
| `VALIDATION.md` | Distinguishes the mixed full run from the two-file rerun; final native evidence must be recorded separately |
| `docs/TRUSTWORTHY_TRAINING.md` | Implementation and physical-device limitations; documentation is not validation of private device data |
| `docs/screenshots/trust/focus-390.png` | Isolated UI fixture evidence; not a persistence test |
| `docs/screenshots/trust/preflight-before.png` | Before-state UI evidence |
| `docs/screenshots/trust/preflight-changes-320.png` | Review-changes UI evidence |
| `docs/screenshots/trust/preflight-choices-390.png` | Explicit-decision UI evidence |
| `docs/screenshots/trust/quick-log-390.png` | Quick Log fixture evidence |
| `src/App.jsx` | Start/finish wait for primary write; edits flush immediately; completion ACK and archived-date source gaps fixed on native branch |
| `src/FocusedWorkout.tsx` | Undo rearms only its immutable target; auto-advance does not arm a later target |
| `src/PreWorkoutCheck.tsx` | Not quite selects no dose; original/lighter/recovery/rest are explicit; cancellation read-only; pending guard prevents repeated start |
| `src/QuickWorkoutLog.tsx` | Exact undone row remounts to rearm; session/exercise/set identity remains stable in records |
| `src/domain.js` | Reuses genuine unloaded bodyweight reps, keeps zero planned load and blocks loaded-history injection |
| `src/performance-insights.ts` | Fractional RIR retained; target RPE does not invent recorded effort; mixed loads/out-of-range sets cannot justify progression |
| `src/pre-workout.css` | Decision/review rows wrap, remain focusable and meet 44 px targets; visual/browser verification remains necessary |
| `src/pre-workout.ts` | Declining a reduction does not fabricate readiness; validates calendar date before returning unchanged profile |
| `src/volleyball-master-plan.ts` | Original resolution skips optional phase/readiness reductions while retaining match routing and medical limits; defaults unchanged |
| `src/workout-continuity.ts` | Optional metadata references primary active session, start instant and restore generation; never another workout model or portable backup |
| `src/workout-customization.ts` | Added sets copy applicable suggestions without editing existing sets or treating suggestions as done; excludes incompatible timed/measurement modes |
| `src/workout-flow.css` | Compact recover-controls strip; no storage or prescription changes |
| `src/workout-reuse.ts` | Unloaded bodyweight reuse supported; loaded history cannot enter a zero-load prescription |
| `tests/coach-planning.web.spec.ts` | Explicit recovery action selector; prior plan-preservation assertions retained |
| `tests/master-program.web.spec.ts` | Separates reduced preview from an explicitly selected original start; asserts the saved full plan remains unchanged |
| `tests/performance-insights.test.ts` | Negative cases for mixed loads, missing sets/effort and fractional reserve |
| `tests/pre-workout-choice.web.spec.ts` | Four deliberate choices, read-only cancellation, rest, original dose, phase rejection and mandatory medical limits |
| `tests/pre-workout-premium.web.spec.ts` | Updated explicit actions; separate positive-answer clearance test retained |
| `tests/pre-workout.test.ts` | Null readiness does not change any date/profile and invalid dates still fail |
| `tests/trust-original-plan.test.ts` | V13.1/V8.1/V9 original doses, match routing, restrictions and immutable snapshots |
| `tests/trust-prefill.test.ts` | Unloaded versus loaded history, added-set provenance, immutable existing values, backup round trip |
| `tests/trust-prefill.web.spec.ts` | Same bodyweight/new-set values in Focus/Quick Log and after refresh |
| `tests/trust-workout-lifecycle.web.spec.ts` | Lifecycle, storage rejection, immediate-reload edits, finish/start retry, concurrent-start detection; native branch strengthens failed-completion expectation |
| `tests/v16-quicklog.web.spec.ts` | Exact Undo rearming; see previous-failure review |
| `tests/v81-reporting.test.ts` | Sparse logs no longer imply novice status, a fixed empty-bar mass or replacing a planned exercise |
| `tests/v9-logging.web.spec.ts` | Immediate edit plus exactly one completion write; see previous-failure review |
| `tests/workout-continuity.test.ts` | Invalid/deleted/old/wrong-generation/undone data and optional-storage failures fail closed |
| `tests/workout-continuity.web.spec.ts` | Explicit fresh-context transfer, expired deadline and restored-generation controls |
| `tests/workout-reuse.test.ts` | Zero-load reps reusable, added load rejected; measurement semantics retained |

## Storage mutation and recovery invariants

The cache audit covered every request branch: profile, session, single/batched
activities, nutrition, performance, reminder instructions and reminder entries.
Each replaces a top-level value, except reminder item/entry assignment, which is
isolated by the copied reminder container. Schema parsing isolates submitted
objects. Failed writes preserve the prior cache and primary bytes.

Checkpoint/restore operations deliberately preserve compatible raw metadata not
owned by the edited profile. They invalidate the validated view; the next read
performs the existing normalization. The safety slot keeps the exact previous
primary bytes. Invalid backups, stale recovery reviews and failed safety-copy
writes remain atomic rejections through the existing implementation and tests.

The sync API is another entry to that same versioned client, not a second store.
Existing async callers still receive rejected promises. Version fences and
restore generations remain checked before saving. No code in this change resets
storage, changes exercise IDs, substitutes a training plan or fabricates history.

## Earlier targeted validation checkpoint

| Command/check | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/native-storage.test.ts tests/storage.test.ts tests/profile-updates.test.ts tests/v14-backup.test.ts tests/v18-profile-checkpoint.test.ts tests/v18-setup-recovery.test.ts tests/reminder-storage.test.ts tests/customization-storage.test.ts` | **131 passed, 0 failed, 0 cancelled, 0 skipped**, 4,036.5 ms, including 13 new cache/fence cases |
| `npm run typecheck` | Passed after the sync API, cache and archive browser fixtures were present |
| `git diff --check -- src/storage.ts tests/native-storage.test.ts tests/native-archive-source.web.spec.ts` | Passed |
| New archive-source browser cases | Written; pending frozen production-build execution at this audit checkpoint |
| Full unit, build, browser and controlled benchmark | Final results must be appended by the release coordinator; not claimed here |

The first interleaving-test draft incorrectly read nutrition from the tracker
response, which intentionally does not contain nutrition. Two assertions failed
after their write-rejection checks passed. The tests now inspect the authoritative
primary record and separately check the cached tracker response. The final
131-case rerun above is clean; application behavior was not weakened.

The first archive-source browser run also exposed an incorrect new assertion:
it assumed restricted guidance removes every `mode: weight` entry. Existing
`applyRecordedClearance` and `v18-training-guidance.test.ts` preserve that logging
identity while requiring unloaded preparation, at most two sets and RPE 5.
The regression now checks every exercise and log for those actual safeguards,
rejects jumps/power/ballistics and linked heavy pairs, requires unperformed
zero-load records, and compares the entire profile, prior history and nutrition.
The runtime restriction was not loosened. The root coordinator must record the
rerun result. Reapplying guidance can currently duplicate the explanatory cue;
that cosmetic repetition does not authorize additional load or impact.

## Release decision and remaining limits

**READY for code review after the clean final run recorded below.**
This does not authorize a main merge or production deployment. Physical-device
checks and measured limitations remain explicit release considerations.

- Browser localStorage version checks and the exact-byte precommit fence reject
  observed stale changes. The final comparison and write are still not an atomic
  transaction across renderer processes; a narrower simultaneous-write window
  remains. Sequential and injected-interleaving tests do not prove general
  multiwriter serialization.
- Optional timer/Undo continuity is not cloud sync. Independent windows require
  explicit ownership transfer. Browser Duplicate Tab can clone sessionStorage;
  copied-tab semantics require additional browser/device validation.
- The primary store is still serialized synchronously as a whole. Large-history
  timing and retained-memory costs must be reported. No risky IndexedDB migration
  is hidden in this optimization.
- Absolute deadlines restore timing when the app resumes. Locked-screen sound,
  native haptics, guaranteed suspended execution and Live Activities are not
  established PWA capabilities here.
- Physical Safari keyboard, VoiceOver, Dynamic Type, background suspension,
  process termination, device storage eviction and real iOS update behavior are
  not established by Chromium emulation.
- No private iPhone storage has been accessed, recovered or verified. Local
  settings/history preservation is verified with isolated fixtures and backup
  compatibility tests. Users still need an external backup they actually retain.

## Final validation findings after the first complete native run

The first completed 515-case native execution had **513 passed / 2 failed**.
It is not counted as a clean release run. Both failures were investigated before
another full execution:

- **Real All Sets layout shift:** App's deferred guide rendered a roughly 20px
  loading paragraph before replacing it with a 48px button plus 12px margin.
  The trace shows all ten real touch taps remained at the original checkbox
  coordinates while the checkbox moved down about 40px. No set completed; this
  was a real missed-touch defect. App now uses the existing lightweight guide
  trigger immediately; only the guide body loads on request. The original rapid
  touch test is unchanged. A new controlled regression makes the heavy guide
  module unavailable, then requires the visible stable trigger, exactly one set
  from ten fixed-coordinate real touches, unchanged entered values/profile and
  one owned rest timer.
- **Backup deep-link test navigation:** the shared settings helper checked for
  an All settings button before deferred settings content existed. The backup
  entry loads directly into Data & Backup, so waiting for a group list alone
  could miss its later back action. The helper now waits for an actual requested
  group, back action or list before choosing its navigation. The complete export,
  invalid import, confirmed synthetic reset and restore assertions remain.

All three targeted cases (original touch, controlled unavailable guide, complete
backup roundtrip) then passed. The new case increases the full suite to 516.
The subsequent single clean full run below supplies final validation evidence.

Earlier interrupted executions are retained separately: one was intentionally
stopped after 89 passes to remove a measured primary-Progress loading regression;
an environment interruption later stopped a diagnostic execution after the log
reached case 461. Neither is represented as a complete pass. That diagnostic run
also exposed stale private settings helpers and suggestion text. Private helpers
now use the same real settings navigation; no update/data assertions were removed.
The suggestion regression now checks the actual review/Ready state, disabled
Complete, and that Ready itself leaves the saved record unchanged, before retaining
all manual-edit, offline, layout and history checks. No retries or larger timeouts
were used to mask these failures.


## Final frozen verification — 18 November 2026

The final runtime is `02ddc63`, tested tree `ae6efff`; subsequent changes are
documentation/evidence only. **All required commands passed:** typecheck,
**900/900 unit tests**, production build, and **516/516 browser tests in one clean
27.5-minute run**, zero failures, interruptions, skips or retries. This includes
the exact touch scenario and complete backup roundtrip that failed in the earlier
515-case run. [Machine-readable command/result/hash evidence](NATIVE_VALIDATION.json).
The build index SHA-256 and cache suffix match the final benchmark report.

PRs #11/#12/#13 were reconfirmed open and unmerged; #12/#13 heads remain
`8e5f30d` / `98824e2`. Their compatible work is incorporated only on the isolated
Native branch. Main remains `693265c`; no merge or production deployment occurred.
No primary storage schema/key, backup format, exercise ID, domain or dependency
changed. Existing-user data safety is verified with fixtures, not access to a
private iPhone installation.

Recommendation: **READY for review**. Safe production release still needs the
manual iPhone checklist and separate authorization. Remaining limits include
whole-store serialization, the non-atomic cross-renderer compare/set gap, measured
cold-start/heap tradeoffs and approximately one-second large-history Progress.
Locked-screen audio, physical Safari/VoiceOver, OS eviction and native haptics
remain unverified. No cloud sync, native wrapper or unsafe storage migration was added.
