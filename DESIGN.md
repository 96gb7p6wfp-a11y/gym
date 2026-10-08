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

The storage key remains `setline.gym.v1`. No records are cleared or recreated.
Optional routine fields accept older records and backups. Closed-app reminders
require a push service; the app honestly provides an in-app schedule. Photo
analysis is hidden when its optional service is unavailable.
