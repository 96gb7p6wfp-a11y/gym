# Setline V18 · Volleyball Performance Plan V9

Baseline: main `bbf3c51` (merged V18). Application and prescription versions are
independent. This change introduces an explicitly selected V9 training plan; it
does not downgrade the app or silently replace an established installation.

## Prescription and resolver changes

- Four full gym days: Monday 11 exercises, Wednesday 12 entries in four blocks,
  Thursday two agility entries plus 11 upper-body exercises, Saturday 11 entries.
- Normal Saturday is **Lower B — Full Strength**, 29 working sets, 85–105 minutes.
  Its exact sequence, dose and rest are tested against the requested prescription.
- A confirmed Sunday match in the actual selected cycle week selects the separate
  **Pre-Match Primer** identity; no match time is invented. Sunday is match or
  recovery. Friday retains PE and volleyball without a gym session.
- Wednesday has 24 planned main jump contacts and exactly three Hack Squat/CMJ
  rounds, with each movement's prescribed rest. These are planned contacts, never
  completed exposure until the athlete records the work.
- Green, Yellow, Red, user-controlled guidance, week-four reductions and week-eight
  evaluation apply to recommendations separately from the full base. Modified
  sessions explain why. Viewing the base cannot bypass the recommended start dose.
- An expired eight-week block does not recycle week one's match or restart itself.
  The V9 base can continue; starting a new cycle is a separate explicit action.

The prior five-exercise Saturday was the real V13.1 template, not a list-rendering
limit. Saved date drafts could also take precedence over the weekly plan and
retain earlier reductions. Active workouts correctly retained saved snapshots.
Those sources are now distinguished; the actual state on a personal phone was
not accessible and has not been diagnosed or restored remotely.

## Data and activation boundaries

The reviewed upgrade saves an exact local recovery copy before changing profile
fields. It archives the previous week, program settings and date drafts. A failed
checkpoint or stale profile-version lease aborts the write. Past and active
session records are never rewritten. Reopening the V9 review does not restart
the cycle or replace the archive.

Compatible load/equipment setup carries across. Changed prescription structure
requires explicit review. Unreviewed intentional old date drafts remain stored
but cannot silently override V9. Named future-date choices can keep an approved
customization or replace it with the recommendation. The approval survives
subsequent date-only edits. A draft for the opposite Saturday match identity is
kept for recovery and cannot override the actual match branch. Restoring an older
program also quarantines retained V9 drafts instead of relabeling or deleting them.

Storage remains `setline.gym.v1`, schema version 1 and backup version 1. New fields
are optional. Existing V13.1/V8.1 plans, sessions, nutrition, preferences, guidance,
routines, custom templates and jump records remain supported. Performance writes
from older callers preserve newer optional sprint/joint fields they do not edit.
Local recovery copies are not verified external backups.

On the existing origin, open **You → Training plan → Upgrade Training Plan to V9
→ Review Weekly Schedule → Apply V9 to Future Workouts**. Review old future-date
edits individually. Updating code alone does not edit an iPhone's local profile.
An existing active workout retains its original prescription until completed or
otherwise handled through the app's normal controls.

## Workout and performance interface

The existing premium light/dark surfaces and Focus/Quick Log remain. Preview
shows full lists, exercise count, working sets, duration, sections and source.
The gentle V9 match primer is explicitly **Light primer**, with freshness and
optional-rest guidance rather than strength-load progression. It starts directly
through the same guarded session transaction when it has no separate warm-up.
An explicitly added warm-up, heavy work or explosive customization retains the
normal preparation flow. Starting never completes a set or records sport exposure.
Advanced details stay contextual. Sprints use metres and optional measured
seconds; timed holds use seconds with optional external load. Legacy loaded
distance carries still support kilograms. Medicine-ball and jump work do not
receive inappropriate strength 1RM estimates.

An optional reaction cue aid produces four visual directions and optional device
speech; it does not time reactions or complete records. Real 5/10 m test results
compare only compatible timing methods, protocols and recorded conditions.
Optional joint observations are self-reported context, not medical clearance or
an automatic physiological readiness score. Existing next-set suggestions, Undo,
immutable completion targeting and session recovery are retained.

## Verification and deployment

Final command results and browser coverage are recorded in [VALIDATION.md](../VALIDATION.md).
Thirteen isolated localhost screenshots were captured with
`scripts/capture-v9.mjs`; the inspected 320/390 px light/dark preview and complex
captures showed no horizontal overflow. These are QA fixtures, not the owner's
stored profile, historical screenshots or physical iPhone testing.

Physical iPhone keyboard behavior, VoiceOver, Dynamic Type, storage eviction,
speech audibility and locked/background audio remain device checks. The build
retains the existing large-chunk advisory. No new dependency or persistence-key
change was introduced.

Deployment must be checked against the eventual merged SHA and the existing
Vercel **Production – gym-kveq** environment. A preview deployment or branch commit
does not establish production success. Production and merge results are reported
after validation; this document alone makes no deployment claim.
