# Setline — Athlete’s Journal

The current design is a new presentation system, preserving the existing product,
training logic and local records. The full concept comparison, tokens, typography,
spacing and component rules live in the [design system](docs/SETLINE_REINVENTION_DESIGN.md).
Public benchmark evidence and access limitations are in the
[research record](docs/SETLINE_REINVENTION_RESEARCH.md).

## Four destinations

| Destination | Primary question | Secondary access |
| --- | --- | --- |
| Today | What matters today? | Session cover, Start/Continue, real weekly gym progress, next volleyball, Fuel, weekly plan |
| Train | What set do I do next? | Previous set, large number rails, completion, rest, exercise options, Session tools |
| Progress | Am I improving? | One selected measured lens, jump/weight check-ins, strength, history and weekly report |
| You | What else do I need? | Nutrition, Routine, plan, saved workouts, library, records, imports, settings and backup |

Nutrition remains one tap from Today’s Fuel row and You’s Daily group. It answers
what is still needed today, with remaining calories, protein priority and quick meal
logging. Configuration stays under Nutrition options. Empty screens invite a real
first entry instead of displaying fabricated numbers or charts.

## Visual identity

A warm neutral canvas and restrained wine accent replace the previous palettes.
Dark mode uses a deep neutral base and a softer accent. Selective serif session
names and page titles contrast with system sans controls and tabular numbers.
The centered Today cover, stacked set-entry rails and single-metric Progress
composition replace the previous dashboard hierarchy. Content uses whitespace,
alignment and fine dividers; containers represent inputs or genuine modal objects.

Four integrated tabs respect the home indicator. Contextual tools, short horizontal
selectors and searchable lists reduce persistent controls. Sheets keep a fixed
44px Close target outside their single scrolling body. Compact-height layouts make
technique visible earlier. Touch feedback stays subtle; keyboard focus stays visible.

## Product invariants

The original versioned workout mutations, decimal parser, timer logic and validation
remain the only source of stored data. Completing a set is explicit. Weight/reps
carry only into empty sets of the same movement; invalid input cannot reuse a prior
weight. Manual +/- controls and dot/comma decimal entry coexist.

Complex pairs alternate A1/A2 or B1/B2 by round in one workspace, retaining each
movement’s rest and logs. Per-set countdowns support pause/resume/reset and refresh;
zero never automatically completes work. Long activities keep manual duration.

Current sessions are snapshots. Editing today, templates, the weekly plan or the
recommended programme cannot rewrite completed sets or historical sessions.

Performance comparisons retain stable movement identity, logging mode, matched reps
and measurement kind. Height, highest touch and distance remain separate. Weight
trends require adequately sampled weeks. Readiness is self-reported; training load
and calorie burn are estimates. Recommendations require explicit application and
never silently change working sets or saved nutrition targets.

The storage key remains `setline.gym.v1`; schemas, portable backups and optimistic
version checks are unchanged. No migration, reset or demo history is introduced.
Manifest ID, scope and start URL remain stable. Offline assets remain local.

## Mobile behavior

Today’s Start and real weekly progress fit above the tabs on a 320×568 viewport
with simulated safe areas, including the long Wednesday master-plan title. Entering
a session resets browser scroll anchoring so its heading stays visible. Input and
completion scroll together when the keyboard leaves enough room. Navigation and
rest chrome yield to the keyboard without stopping timers. Landscape headers are
compact enough for the long exercise picker to remain touch-scrollable.

Validation combines production browser workflows, unit tests and actual rendered
light/dark screenshots. See [VALIDATION.md](VALIDATION.md) for results and limits.
