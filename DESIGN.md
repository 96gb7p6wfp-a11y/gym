# Setline interface

The app keeps its existing training plan, local records and calculation rules.
Known session titles have short display aliases; saved titles and exercise keys
remain unchanged.

| Section | Primary question | Secondary tools |
| --- | --- | --- |
| Today | What am I doing today? | Compact week selector, next volleyball session, extra activity timeline, weekly plan |
| Train | What set do I do next? | All sets, exercise technique, alternatives, preparation, recovery, activity logging |
| Progress | Am I improving? | Strength, history, weekly report, deleted records |
| Nutrition | What should I still eat? | Recent meals, saved foods, targets and profile, weight check-in, fuel guidance |
| More | What else do I need? | Training plan, routine, settings, imports, backup and installation |

The visual system uses a warm neutral background, dark type and one soft green
accent. Primary actions are large; secondary actions are simple rows or
disclosures. Mobile dialogs become bottom sheets with a pinned close button and
an independently scrolling body. The bottom navigation and popup boundaries
respect iPhone safe areas.

Workout logging still uses the original versioned mutations, weight parser,
timer logic and validation. Focused controls advance only after the saved state
marks a set complete. Detailed set editing remains available. Nutrition never
silently replaces saved targets or adds estimated exercise calories to them.

Explicit A1/A2 and B1/B2 complex pairs share one card and alternate by round.
Both names and the current round stay visible; each movement keeps its planned
rest and its own logs. New values carry only into empty sets of that same movement.
Short timed work uses a large countdown with the planned duration, quick
adjustment, pause, resume and reset. Each timer belongs to one set and survives
refresh. Reaching zero never checks off work automatically. Long activities keep
manual minutes and an optional stopwatch. Touch states preserve readable button
contrast. Research and dated customer feedback are in
[WORKOUT_UX_RESEARCH.md](docs/WORKOUT_UX_RESEARCH.md).

The storage key remains `setline.gym.v1`. No records are cleared or recreated.
Optional routine and timer fields accept older records and backups. Closed-app reminders
require a push service; the app honestly provides an in-app schedule. Photo
analysis is hidden when its optional service is unavailable.


## Athlete refinement

The 2026-10-16 refinement keeps those five destinations and the original recommended
plan, while adding purpose-led previews and a more focused set card. Exercise benefit
and intent are each one short line. Technique, effort, alternatives and session changes
open only when requested. Manual +/- controls and decimal text entry coexist.

The semantic visual system has deliberate neutral light and dark surfaces, controlled
green emphasis, readable on-accent text and consistent phone touch targets. System
appearance is the default; explicit preferences live in the existing profile. Short
viewports use normal-flow completion actions so controls do not cover weight inputs.

WorkoutBuilder, ExerciseLibrarySheet, WorkoutCustomizer, WeeklyPlanTools,
PerformanceDetails, WorkoutCompletion and the shared page/header/sheet primitives
keep capability behind focused interfaces. Templates and recurring plans are separate
from live session snapshots. New sessions retain planned duration separately from
recorded elapsed time, so saving a custom template cannot borrow another day’s duration. Removing or replacing remaining work retains completed
sets; plan editing and resetting cannot rewrite history.

Performance comparisons include stable exercise identity, normalized name, logging mode
and measurement kind. Height, absolute touch and distance remain distinct. Weekly
weight trends require adequately sampled weeks; readiness is self-reported and training
load is an estimate, never an invented physiological score. Recommendations are explicit
actions and never silently alter working sets, weekly volume or nutrition targets.

The v1 storage key and portable backup envelope remain compatible. New appearance,
template and performance fields are optional; validation and optimistic version checks
protect writes and reject malformed data without wiping old records.
