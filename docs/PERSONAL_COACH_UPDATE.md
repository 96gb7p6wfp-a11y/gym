# Personal training coach and premium UX

Baseline: Setline V18 / Volleyball Performance Plan V9, main `1a6284d`.
The application, V9 prescriptions, original storage key and backup version remain.

## The Easy Preparation result

An isolated reproduction matches the reported 7 November 2026 screen exactly:
an October 12 cycle start made it week four; unknown/restricted impact guidance
removed acceleration and split-squat jumps; unknown/restricted heavy-lifting
guidance converted remaining work to easy preparation and capped sets at two.
The old phase ran first and reduced Cable Crunch from two sets to one, yielding
nine exercises and seventeen sets. Week four alone cannot produce the
`Modified — Easy Preparation` title. The main Train header also read the copied
85–105-minute base duration instead of the adjusted estimate. An intentional
saved date draft could keep this prescription later.

These are confirmed code paths and a local screenshot reproduction, not a claim
that the owner's inaccessible iPhone guidance was inspected or restored.

## Full reference, safe recommendation

V9 now defaults to daily coaching. Its normal reference is the complete saved
weekly prescription: non-match Saturday has eleven exercises and twenty-nine
working sets. `resolveV9PlanningBase` is a read-only projection before readiness,
phase and medical guidance. It is never the start action's executable plan.
Today and Train lead with that reference and offer a compact, specific adjusted
recommendation when needed. Preview opens the full reference and clearly shows
the actual recommendation, its dose and estimated time. Start always uses the
eligible actual recommendation. Great cannot grant medical clearance.

The four optional date responses are Great, Normal, Tired and Poor. Great/Normal
retain the full eligible dose. Tired reduces demanding explosive work and selected
hard sets; Poor recommends recovery. Legacy Green/Yellow/Red rows are retained
but do not become a new daily answer. Missing readiness is explicitly unknown.
No extra strength sets or jump contacts are added for feeling great or finishing
quickly. A duration is a planning estimate, not a training quota.

V9 no longer silently applies calendar week-four/eight reductions. Explicit dated
reduced/evaluation phases are available in advanced Training Plan settings;
normal training can explicitly replace them. Earlier cycle metadata and legacy
V13.1/V8.1 behavior remain available for interpretation and compatibility.

## Actual-date matches and preservation

Select a Sunday in Train and use **Match scheduled**. Time, opponent, location
and notes are optional. A confirmed Sunday selects its separate Saturday primer;
Off restores Lower B. Neither operation creates an activity or modifies session
snapshots. Other weekends stay independent; dates use calendar arithmetic that
does not shift through Berlin daylight-saving changes.

Optional `calendarMatches` is authoritative, including empty arrays and explicit
Off dates. Existing confirmed block indices map only to the exact Sundays implied
by their original start date; historic matches never roll forward. Migration is
pure on read and persists only with an explicit save. Changing an old cycle start
first retains the old exact match dates. Legacy indices remain stored.

Optional `dailyReadiness` and `calendarMatches` survive restoring an older or
plain personal plan through `coachRecords`, including the older **Return to saved
plan** entry; they carry back into an explicitly
selected V9 plan without resurrecting cleared or disabled entries. Medical
guidance remains individually controlled. Program-specific phase records remain
in their existing program/backup and are not inferred from incomplete logs.

Older intentional V9 date edits now require a coaching review. They remain
stored, never silently deleted or substituted. Explicit Keep stamps an optional
`reviewedForCoach` marker; new deliberate edits get the same marker. Past and
active workouts remain untouched. Existing review/checkpoint/version-lease,
archive, export and validated restore mechanisms are retained.

## Quieter screens, clearer progress, easier recording

Today has one session focus, one primary action and one small weekly-progress
row. V9 sport days lead to actual activity logging. Nutrition and secondary
schedule details move into **More for today**. Train keeps its calendar, full
reference, View/Start and compact daily check-in; program history and preparation
utilities stay secondary.

Progress offers four weeks, twelve weeks and all time; prioritized lift trends;
matched previous/latest sets; standing/approach vertical and Approach Advantage;
actual weight check-ins and weekly average; and recorded training consistency.
Different equipment, repetition configurations, known effort or jump protocols
do not become a fabricated improvement. Unspecified assistance on mixed pull-up
records remains an explicit comparison limitation. Missing tests offer an action.

Focus and Quick Log share the same records and practical adjustable kilogram
increments. Quick Log reveals compact weight/repetition steppers for the active
row, preserving direct decimal input and previous-performance reuse. New session
defaults carry provenance: deliberate input/applied advice stays protected,
completed current-set values outrank old history, then planned fallback applies.
Legacy untagged and explicitly planned active values remain protected. Only new
generated planned defaults carry the optional `plannedDefaults` qualifier that
allows replacement by the last completed set; old records are never relabeled.
Deliberate custom weekly/date loads also take precedence over historic suggestions.
Quick Log action buttons keep a stable position through pointer activation;
focusing Copy or Complete no longer expands a toolbar before the click finishes.
Preparation-only work never inherits a heavy historic load. New suggestions never mark sets complete or
invent RIR. Tired/Poor suppress load-increase recommendations. Existing immutable
completion, Undo, timers, refresh recovery and offline logging remain.

## Verification boundary

See [VALIDATION.md](../VALIDATION.md) for actual final command results. The
capture script uses only localhost QA fixtures and generates before/after views.
No personal device store or production training data was accessed or reset.
Physical iPhone keyboard, VoiceOver, Dynamic Type, storage eviction and audible
locked/background alerts require actual-device verification. Deployment must be
confirmed against the merged commit, not inferred from this implementation.
