# Setline product audit

Reviewed **15 October 2026**, before this refinement, against baseline `92a1774`. This is a source and interaction-structure audit, not a claim of physical iPhone testing.

## Keep the product that already works

Setline already has the right five destinations: Today, Train, Progress, Nutrition and More. Its strongest interactions are focused set logging, decimal loads, automatic rest, explicit complex-pair rounds, per-set work timers, saved workout editing, local nutrition and routines. Imports, weekly reports, backup/restore, offline installation and existing identifiers are valuable infrastructure. The redesign should build on these rather than replace them.

## Before: friction and missing capability

| Area | Observed issue | Refinement direction |
| --- | --- | --- |
| Today | Short aliases turn both upper sessions into “Upper Body” and strength into “Lower Body.” The card gives minutes and exercise count, but little reason for the session. | Retain one primary action. Add a distinct performance title and one short purpose, grounded in the existing plan. Keep volleyball next, with at most a few useful supporting values. |
| Session preview | A full exercise list and session metadata are available, but the purpose is buried in “Session focus.” The user must infer intensity and performance intent. | Show goal, time and working-set count up front. Put preparation, detailed prescriptions and secondary tools behind a tap. |
| Focused workout | Pair grouping and timers work well. There is no contextual way to replace, remove, move or insert an exercise. The fast controls rely on typing; progression is largely a technique-guide paragraph. | Preserve pair alternation and valid-save advancement. Add one quiet exercise action, reachable adjustment controls and a conservative recommendation next to the existing previous performance. |
| Exercise guidance | Detailed technique is already collapsed, but expanded guidance is long. Alternatives exist only for a small hard-coded set of exercises and link elsewhere rather than changing the workout. | Show one purpose and one intent line during training. Give details a small structured summary, technique and mistakes. Connect alternatives to a searchable purpose-aware library. |
| Library | The existing `EXERCISE_LIBRARY` display is a jump-block phase overview, not a selectable movement database. Editing a day adds an unnamed exercise with manual fields. | Provide a real catalog with stable keys, muscles, movement, equipment, goal and tradeoffs. Search first; filters second. Keep original names/keys compatible with history. |
| Plan editing | A day can be edited, including sets and notes, but the form exposes many fields at once. There is no complete custom-workout/template flow or easy workout swap/move. | Use concise exercise rows and contextual editing. Support custom templates and day assignment while retaining an explicit reset to the recommended plan. Future-plan changes must not rewrite historical logs. |
| Progress | The overview contains body weight, monthly gym count and one weekly strength/jump comparison. Body-weight change uses the first/last sampled measurements, rather than mainly weekly averages. Jump measurements live inside individual workout logs. | Keep a few headline trends. Add a dedicated jump entry/detail view, weekly weight averages, meaningful records and short evidence-based insights. Leave detailed charts deeper. |
| Weekly report | Primary totals are concise, but many secondary measures and long explanations remain in the expanded report. The weekly plan lives elsewhere. | Preserve export and all details. Add a compact completed/planned week and one next action; avoid a new analytics dashboard. |
| Completion | Finishing opens a form, then the history sheet. A success toast is the main reward. | Preserve optional duration/watch-calorie capture, then show a restrained completion summary with real sets, volume, records and next-day advice. |
| Nutrition | The calorie/protein hierarchy and quick meal logging are already useful. Body-weight check-in is reachable from Progress. | Preserve these flows and saved targets. Connect multi-week weight evidence to an optional small calorie suggestion; never change targets automatically. |
| More / routine | The reduced menu is sensible. Routines correctly distinguish confirmed instructions from unverified labels. | Keep these secondary. Put appearance and training tools here without increasing home-screen noise. Keep notification capability honest. |
| Appearance | The premium layer explicitly uses `color-scheme: light`. Hard-coded white surfaces and pale colors remain across charts, sheets and component styles. Similar semantic values exist under several token names. | Use deliberate light/dark semantic surfaces and high-contrast type across the whole product. Check inputs, popups, timers, disabled/pressed states and charts as well as home. |
| Mobile structure | Safe-area navigation and pinned sheet close controls are already regression-tested. The advanced all-sets/history views still use tables. New controls can easily crowd the focused card. | Keep the focused default sparse, with 44 px or larger actions and progressive disclosure. Retain detailed tables where useful, make them scroll safely and test narrow/landscape screens. |

## Information architecture

| Destination | First answer | Deeper tools |
| --- | --- | --- |
| Today | What should I do today, and why? | Compact week, next volleyball, selected nutrition/readiness context, weekly plan |
| Train | What is my next set? | Exercise actions, add/search library, alternatives, all sets, work/rest timers, session adjustments, custom workouts |
| Progress | Am I improving for my goals? | Jump, strength/records, weight averages, history, weekly review and volume/load context |
| Nutrition | What should I still eat today? | Meal entry, recent/saved foods, targets, weight check-in and concise fuel advice |
| More | What else do I need? | Weekly plan/templates, routine, appearance/settings, import, backup and installation |

## Training and data boundaries

- Tuesday and Friday 20:00–22:00 volleyball stay visible and configurable. Existing recommended sessions remain recoverable; customization must not silently rewrite the recommendation or saved sessions.
- Explosive work prioritizes intent and rep quality. A jump or power exercise should not receive a generic “add weight every workout” instruction.
- A load/repetition suggestion uses comparable completed performance and available effort data. It is a suggestion the user can edit, not a prescription or proof of readiness.
- Fatigue from recorded volume, recent sessions or a check-in is context, not a measured physiological score. Missing readiness is unknown, not “Good.”
- Jump height, absolute highest touch and horizontal distance are different measurements. Never combine them into one trend or record.
- Estimated 1RM is an estimate for suitable weighted exercises, not a test result, and should not be applied to throws, jumps, timed work or bodyweight movements indiscriminately.
- Keep local records and legacy backups readable. New optional performance/template data must travel with exports and restore without deleting existing workout, meal, activity or routine records.

## Acceptance priorities

First, make today’s purpose and the next set obvious. Second, make workout changes quick and reversible. Third, surface a small number of defensible progress insights. Finally, verify both visual modes, iPhone touch/safe areas, complex pairs/timers, old data, offline behavior and complete export/restore. Features may be powerful internally while their default screens remain quiet.
