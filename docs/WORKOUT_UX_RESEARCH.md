# Workout interaction research

Checked **12 October 2026**. Scope: make Setline's existing complex pairs, set logging and timed movements easier to use. This is a small review of official product documentation and individual public App Store reviews, not a representative customer survey.

## Useful patterns

| Verified source | What it documents | Apply to Setline |
| --- | --- | --- |
| [Hevy: Supersets](https://www.hevyapp.com/features/what-are-supersets/) | Smart Superset Scrolling moves to the next paired exercise after completing a set, then returns to the first exercise for the next round. Grouping is visible during training. | Display the existing A1/A2 and B1/B2 complex pairs together. Advance A1 round 1 → A2 round 1 → A1 round 2 without reopening the movement selector. Show the current round and completion of each member. |
| [Strong: Supersets / Circuits](https://help.strongapp.io/article/98-supersets-and-circuits) | Explicitly describes A1, B1, A2, B2 ordering and grouped exercises; Next selects the appropriate paired set. | Preserve the user's exercise names, prescribed sets and logged values; group the interface instead of changing their program or storage. Resume the first unfinished round, including uneven or partially completed pairs. |
| [Hevy: Previous Workout Values](https://www.hevyapp.com/features/track-exercises/) | Shows previous performance alongside the current set; tapping a previous value can copy weight, reps or duration. Missing previous data stays blank. | Keep previous performance visible. Reuse values only for the correct exercise and empty fields; never replace an edited or completed set, invent previous performance, or carry values from the other member of a pair. |
| [Hevy: Automatic Rest Timer](https://www.hevyapp.com/features/workout-rest-timer/) | Starts rest after completion; supports exercise-specific durations, adjustments and disabling rest where appropriate. | Keep recovery contextual to the prescribed exercise. Do not impose a generic no-rest superset rule on strength-plus-jump complex training. |
| [Strong: Rest Timer](https://help.strongapp.io/article/231-rest-timer) | Automatic start after completion, an expanded timer, duration adjustment and Skip. | Keep one obvious countdown and reachable controls. For timed work, provide a separate large work timer with Start, Pause, Resume and Restart; keep rest and work distinct. |
| [Strong: Perform a Workout](https://help.strongapp.io/article/229-my-first-workout) | Check off individual sets, add or remove sets, modify workouts and finish without requiring every planned exercise to be completed. | Preserve individual completion, undo, editing and all-sets access. Automatic movement selection must happen only after a valid set has been saved. |

## Actual customer feedback

The following are identifiable reviews visible on the **US Apple App Store pages** when checked. They are individual opinions; their original dates matter, and they do not establish the current prevalence of an issue. Duplicate desktop/mobile renderings were treated as the same review. Marketing-selected quotations and empty RSS responses were not counted as customer evidence.

| Review | Observed feedback | Setline implication |
| --- | --- | --- |
| [Hevy](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350): **“Best workout tracking app I’ve tried”**, el-jefe-kyle, **2 May 2022** | Praises easy superset/set-type labels and access to past exercise performance. | Make pairs recognizable and the next step automatic; retain history and technique behind a tap. |
| [Hevy](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350): **“Super Easy Interface , Great Community.”**, Mrs. Wallker, **18 June 2025** | Praises easy exercise replacement, workout timing and instructional videos. | Keep the main logging action simple and exercise guidance available without exposing long instructions during a set. |
| [Strong](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577): **“Best app I’ve ever used to track workouts”**, stephilippou, **23 September 2019** | Values built-in rest tracking because it avoids switching between a separate clock and exercise log. | Let Pogo Jump and other timed movements run inside the active set instead of making the user leave the app or type the planned duration repeatedly. |
| [Strong](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577): **“Database flexibility”**, elgrego1939, **24 October 2023** | Reports inability to combine added weight and duration, a workaround of putting seconds in the reps field, and difficulty retaining accessible history when converting exercise types. | Use explicit seconds for timed work. Keep optional added weight where supported and maintain existing identifiers/history. Avoid representing seconds as repetitions. |
| [Hevy](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350): **“Best workout app imaginable”**, 69burner69, **23 December 2024** | Praises intuitive logging but reports excessive calendar scrolling when backfilling older years. | Avoid adding navigation or repeated scrolling to the normal workout path. Keep direct movement/set selection available alongside automatic progression. |

## Decisions and boundaries

- Borrow interaction patterns, not third-party code, branding, screenshots or assets.
- A complex pair is not automatically a conventional no-rest superset. Keep the existing prescription and recovery cues.
- A timer reaching zero is a prompt, not proof that work was performed. Completion stays an explicit action, and incomplete work can be recorded accurately.
- The reported dark/unreadable Complete set button is a Setline issue to fix and verify with contrast and touch checks; the research does not diagnose that defect.
- Keep work timers compact until needed. Preserve existing logging, undo, history, local persistence and all-sets controls.
- Native Watch, Live Activity and background notification features described by other apps do not establish support for Setline's browser/PWA.

Sources were fetched over normal HTTPS with certificate verification. Public review RSS feeds returned no entries on this check; the dated reviews above came from the live Apple storefront pages.
