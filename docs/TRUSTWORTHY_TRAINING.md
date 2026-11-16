# Train smarter. Track effortlessly. — 2026-11-16

Base: latest main `693265c` (Setline V18, Volleyball Performance Plan V9).
Feature branch: `codex/trustworthy-training`.

## Confirmed implementation checklist

- [x] Inspect current main, open PRs and prior release/audit documents.
- [x] Reproduce the implicit recovery choice from main and inspect unmerged PR #11.
- [x] Repair unloaded bodyweight history prefill and deliberately added sets.
- [x] Persist valid set edits without the previous 450 ms debounce window.
- [x] Make Undo select and rearm only the explicitly undone set in both layouts.
- [x] Separate original, lighter, recovery and rest decisions from the fit answer.
- [x] Preserve saved plans and custom date prescriptions; keep medical gates mandatory.
- [x] Commit workout completion before reporting success; retain retry on failure.
- [x] Provide explicitly claimed, validated rest/Undo continuation in a new window.
- [x] Tighten existing deterministic progression instead of adding a second coach.
- [ ] Finish complete validation and record exact results in VALIDATION.md.

## Architecture and lifecycle

React 19 / Vite / TypeScript with the existing JSX application coordinator.
React component state and refs own the visible session and serialized mutations.
`domain.js` supplies the existing Zod workout/profile schemas and session factory.
The local client in `storage.ts` is the authoritative persistence layer. There is
no cloud database or IndexedDB, and no synchronization claim.

The main key remains `setline.gym.v1`, schema version 1. Optimistic per-record
versions, serialized writes, profile rebasing, restore-generation fencing,
validated atomic restore and safety copies remain in use. Startup does not write
defaults over established or invalid data. No primary schema migration is needed.

The lifecycle remains one path: Today uses the actual Berlin date; Train can
browse another date. Start opens a read-only preflight. Confirmation resolves a
safe executable prescription and optionally opens workout-specific preparation.
The session factory creates new immutable workout/set IDs and prior-value drafts.
Focus and Quick Log edit that same session. Completion claims an immutable intent,
writes one target, prepares the next suggestion and starts one owned deadline.
Undo changes only that set's completion, preserves its values and rearms that
explicit target. Refresh reads the saved active session. Finish first flushes
pending edits, then commits the same session as completed before showing success.
History and analytics use the completed record, not the saved weekly plan.

## Actual causes and fixes

1. **Implicit recovery.** On main, `Not quite` directly selected `poor` in
   `PreWorkoutCheck.tsx`. PR #11 is an open, unmerged draft, and its two-choice
   fix had not run full validation. This branch incorporates its intent while
   providing four explicit choices. Merely opening, switching or cancelling the
   choices never writes training data. Rest logs no synthetic session. Continuing
   the original after Not quite does not fabricate a positive readiness report.
2. **Lost prefill opportunities.** `previousSessionSeed` and `previousSetReuse`
   excluded every bodyweight movement with planned zero added load. They now
   accept genuine unloaded history while excluding loaded prior variants.
   `adjustSessionSets` used template load and blank repetitions for appended sets;
   it now uses an applicable completed set, then valid preceding draft/planned
   fallback, without copying completion, RIR, elapsed time or measurements.
3. **Save window.** `updateSet` used the ordinary 450 ms buffered queue. It now
   requests the existing immediate write path. The local client performs its
   localStorage write synchronously before its promise settles. Other buffered
   edits also flush on pagehide, in addition to the existing visibility handling.
   Storage denial/conflicts remain visible errors, not success claims.
4. **Undo friction.** Focus reset the intent gate without arming the undone set;
   Quick Log retained its consumed row gate. An explicit Undo now rearms only its
   own immutable target. Auto-advance, elapsed time and rerenders do not rearm a
   new set. The consumed-intent and authoritative idempotency guards stay intact.
5. **Premature finish.** The UI optimistically marked a workout completed and
   dismissed its finish dialog even if persistence failed. Finish now reads the
   latest queued session, writes it successfully, then updates history and opens
   the completion summary. A synchronous action guard rejects duplicate finish
   taps. A failure leaves the active record, entered duration and retry available.
6. **New-context rest.** Session storage preserves refresh but can disappear when
   an app window terminates. A tiny optional local record references the existing
   active workout, its exact start instant, restore generation and still-completed
   owner/Undo target. A new window offers Resume saved rest, or Restore workout
   controls if only Undo remains. It never claims another window's alarm silently.
   Explicit transfer stops the old window's controls; old/completed/deleted,
   undone, mismatched, corrupt or restored records are rejected. Expired rest
   resolves silently rather than starting another full countdown.
7. **Unsupported progression.** The existing rep-increase branch could use the
   heaviest set among mixed loads, including incomplete/under-range work. It now
   requires complete same-load, in-range sets and recorded reserve. Fractional
   prescribed RIR is respected. Prescribed RPE informs the target but never
   invents actual RIR. Sparse trap-bar history no longer asserts inexperience,
   an exact empty-bar weight or a change of exercise selection.

## Plan and safety boundaries

Original weekly templates, date-specific customizations and completed snapshots
remain separate. For V9, Continue original uses the saved full planning reference
instead of stale readiness or an optional reduced phase. Match dates still choose
the correct primer versus Lower B identity. Intentional date edits remain the
reference when accepted and compatible; obsolete/conflicting drafts retain their
existing review workflow. The preflight displays exact dose differences.
Legacy V13.1/V8.1 original selection similarly skips optional phase/readiness
reductions through an opt-in resolver flag; normal historical resolution stays
unchanged. For restricted legacy plans the compact reference is the medically
eligible reference, with the exact saved original still available in Weekly plan.

Lighter/recovery choices are transient executable sessions. They cannot replace a
custom plan. Existing date-specific readiness may be recorded only after explicit
confirmation and only for the actual current date. Choosing original after Not
quite makes no positive readiness write. Current medical limits are applied
independently and checked again against the latest stored profile at actual start.
Choosing Yes or original cannot clear a restriction. No exercise volume, V9 base
prescription, prior V13.1 history, jump dose or clearance is increased here.

Two optional UI keys are additive: localStorage `setline.workout-continuity.v1`
and sessionStorage `setline.workout-continuity-owner.v1`. They contain no competing
session or exercise records, are not a backup, and are omitted from portable
exports. Missing/denied optional storage does not block the primary workout.
All existing backup formats, settings, nutrition, custom exercises, supplements,
measurements, PWA identity and existing primary storage keys remain compatible.

## Existing capabilities intentionally retained

Prior-performance comparability includes canonical movement, equipment label,
logging mode and per-side configuration. Preparation-only work does not seed
working sets. Raw set ordinals remain stable. Same-session suggestions never
overwrite explicit edits or deliberate clears. Recommendations remain optional
Use suggestion actions, not plan rewrites.

Existing Progress already provides comparable exercise history, strength/jump
protocol separation, weekly weight averages, consistency and truthful sparse-data
states. The exercise library already has normalized search, aliases, categories,
equipment/muscle filters, explicit substitutions, precise guides and separately
available Google/YouTube links. These are not rebuilt or duplicated. Custom
movements remain in saved workouts/templates rather than a separate global custom
catalogue. No new dependency or licensed media was needed.

## Verification boundaries and manual device checks

Representative original application captures (isolated Chromium fixtures):
[preflight before](screenshots/trust/preflight-before.png),
[explicit choices at 390px](screenshots/trust/preflight-choices-390.png),
[reviewed lighter changes at 320px](screenshots/trust/preflight-changes-320.png),
[Focus](screenshots/trust/focus-390.png),
[Quick Log](screenshots/trust/quick-log-390.png).
The small-screen change review is intentionally scrolled to its confirmation;
the separate close row stays outside the scroll body and cannot cover a choice.

Automated fixtures are isolated localhost records. The complete-workout test uses
a five-set saved upper workout and enters a simulated 75-minute duration. It tests
the whole lifecycle; it is not a physical 75-minute workout. Existing full-dose V9
tests cover the large prescriptions separately. Exact commands/results and any
failed initial runs belong in VALIDATION.md.

On a physical iPhone, check:

1. Open the existing installed PWA after updating; confirm the saved plan,
   guidance, preferences, history and original training targets.
2. Start fit and already warm; verify previous load/reps. Test decimal input and
   native keyboard reachability with Focus and Quick Log.
3. Complete, Undo and immediately re-complete one set. Confirm the next set stays
   pending during repeated taps and the timer remains singular.
4. Switch apps, lock/unlock, close/reopen and resume the same active workout. If
   tab storage was discarded, explicitly resume its saved rest controls.
5. Try Not quite and each decision, cancellation, warm-up, current medical limits
   and a confirmed match weekend. Confirm the original workout remains available.
6. Complete a real session, inspect history/progress, export a backup and reopen
   the PWA offline. Do not clear storage or reinstall to test an update.

Real Safari keyboard, VoiceOver, Dynamic Type, system storage eviction, physical
thumb reach and locked-screen audio cannot be established by Chromium emulation.
Browser process/storage behavior still has platform limits. Export remains a
local action, not proof of external safekeeping. Cloud sync, Apple Watch, social,
gamification, generative coaching and unrelated feature expansions are deferred.
