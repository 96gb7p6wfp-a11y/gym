# Volleyball Performance Plan V9

V9 is an opt-in athletic prescription within Setline V18. The current
[personal coach update](PERSONAL_COACH_UPDATE.md) uses daily readiness and actual
Sunday match dates by default, with optional periodization in advanced settings.
Its revision number is
independent of the application version and does not downgrade V13.1 records.

## Why Saturday could show five exercises

The inspected V18 main (`bbf3c51`) defines V13.1 Lower Strength B as five exercises
and 45–55 minutes in `volleyball-master-plan.ts`. That was the actual older
prescription, not simply a truncated list. In addition, `workoutForDate()` allowed
an intentional date draft to override the weekly recommendation. Editing an
already-reduced day could preserve that reduced prescription in a later draft.
Existing clearance, readiness and phase reductions can further change a session.
An active workout is a separate saved snapshot and correctly keeps its old plan.

Those mechanisms are confirmed in code; this does not establish which one was
present on an inaccessible personal iPhone installation.

## Complete recommendations

| Day | Session | Base duration |
| --- | --- | --- |
| Monday | Upper A — Spike Power + Strength | 85–100 min |
| Tuesday | Volleyball, plus optional four-drill approach technique | Practice + optional 10 min |
| Wednesday | Speed + Jump + Heavy Lower A | 100–120 min |
| Thursday | Agility + Upper B | 85–105 min |
| Friday | School PE and volleyball; no gym | Record actual exposure |
| Saturday, no confirmed Sunday match | Lower B — Full Strength, 11 exercises | 85–105 min |
| Saturday, confirmed Sunday match | Separate Pre-Match Primer | 10–15 min, optional |
| Sunday | Match if confirmed; otherwise recovery | Actual match duration / optional recovery |

Monday contains eleven prescribed exercises. Wednesday separates acceleration,
24 planned main jump contacts, three Hack Squat–CMJ rounds and remaining strength
and stability. Hack Squat has three working sets in total, never another three
after the complex. Each Hack set rests 240 seconds (within 3–4 minutes) before
CMJ; each CMJ set rests 180 seconds (within 2–3 minutes) before the next round.
Thursday contains two agility entries followed by all eleven upper-body entries.

The non-match Saturday sequence is: 10 m acceleration 4×1; split-squat jump
2×3/leg; Leg Press 3×5–8; Smith Bulgarian Split Squat 3×6–8/leg; Hip Thrust
Machine 3×6–8; Leg Curl 3×8–12; Standing Calf Raise 3×6–10; Standing Calf
Isometric Hold 2×30 seconds; Tibialis Raise 2×15–20; Copenhagen Plank
2×20–30 seconds/side; Cable Crunch 2×10–15.

Rest ranges remain visible, with a concrete timer duration inside the prescribed
range. Clear-space sprint/COD instructions allow a suitable hall or outdoor
location, or explicit omission for this date. No exercise is substituted at random.
The optional reaction cue aid provides visual directions and, when supported,
device speech; it does not measure reaction time or complete training records.

## Resolution and safe modification

V9 uses stable `programSessionId` identities for Lower B, Primer, match and the
other templates. Display names do not choose a match branch. A Sunday match
requires an explicitly scheduled actual Sunday date. Legacy confirmed week
selections map only to their original dates. Its start time remains unset until
entered; a time alone does not confirm a match.

The resolver retains the full base and derives guidance, readiness and phase
changes separately. Great/Normal keep the full permitted dose; Tired reduces or
omits demanding acceleration/jumping and selected hard strength; Poor offers a
clearly modified recovery recommendation. Reduced/evaluation phases are explicit
choices; a legacy week-four/eight number no longer reduces V9 by default.
Recorded guidance remains user-controlled; selecting V9 never grants clearance.
Missing sleep, sport or symptom data is unknown, not evidence of recovery.

Workout Preview shows the current recommendation and the complete base as an
explicit read-only reference. Viewing the base cannot bypass the current start
prescription. The source identifies weekly V9, an approved date customisation,
or an older saved edit awaiting review. Explicit older-revision weekly leftovers
are distinguished from intentional V9 customisation.

## Activation and existing data

In the updated app: **You → Training plan → Upgrade Training Plan to V9 →
Review Weekly Schedule → Apply V9 to Future Workouts**.

The review lists compatible equipment/load configuration and incompatible
intentional changes. Replacing an incompatible weekly prescription requires an
explicit acknowledgement. The complete previous plan and date drafts are
archived, with an exact local recovery copy saved before confirmation. A failed
safety copy stops the change. Historical and active session records are separate
and are never rewritten by this profile operation.

Older intentional upcoming date drafts stay stored until separately reviewed.
They cannot silently override V9. A reviewed custom choice remains labelled;
a draft for the opposite Saturday match variant cannot win. Explicit replacement
removes only the selected date/slot. Past and active dates remain protected.
Preparation-only caches may refresh through the reviewed upgrade. The optional
`v9EffectiveDate` bounds activation without restarting the saved eight-week cycle.
An explicit new-cycle control remains available; no automatic restart occurs.

Existing V13.1/V8.1 restore versions, preferences, nutrition, routines, custom
templates, jump data and session snapshots remain compatible. Storage remains
`setline.gym.v1`, schema version 1, backup version 1. No reset runs on startup.

## Recording and actual progress

Focus, Quick Log and All sets retain immutable completion targets, Undo and one
underlying session. Next-set suggestions are drafts and never complete a set.
Sprints log metres with optional genuinely measured seconds. V9 holds and
suitcase work log seconds, with optional external load. Throws and loaded jumps
are excluded from strength 1RM estimates.

Actual 5/10 m tests are separate performance records, grouped by distance,
timing method, start/finish protocol and recorded conditions. Different methods
are not exact comparisons. Optional knee/Achilles/shoulder observations remain
self-reports, never an automatic physiological score. Guidance to retest jumps
about every two weeks, sprints about every four weeks and optionally review at
six weeks does not create results or restart the block.

Physical iPhone keyboard, speech audibility, background/lock audio and browser
storage eviction require device verification. Local safety copies do not replace
an externally retained backup. Deployment and final validation results are
reported separately from this prescription description.
