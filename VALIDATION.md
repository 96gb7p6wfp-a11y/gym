# Standalone app validation

Initial validation was performed on 2026-10-08. The athlete-focused redesign
was checked on 2026-10-16 in the Linux cloud workspace. This repository
contains the full React + Vite Setline gym app and an installable PWA. The previous
website/iPhone wrapper and native build configuration have been removed.

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed; 132 packages installed, resolved dependencies recorded in `package-lock.json` |
| `npm run typecheck` | Passed |
| `npm test` | Passed: 247 tests, zero failures or skips |
| `npm run build` | Passed; TypeScript check, Vite production bundle and generated service worker |
| `npm run test:web` | Passed: 82 real Chromium application workflows, zero failures or skips (3.3 minutes) |
| Final PWA metadata check | Passed in the full production suite: installation, manifest/icons and offline workout workflows |
| Development server | Passed; HTTP 200 for the Vite page and React entry module |
| Visual review | Redesigned Today, Train, focused workout, Progress, Nutrition, More, Routine, plan and report reviewed; small-phone rest controls and desktop layout checked |
| Standalone dependency review | Passed; no iframe, former-host dependency, remote workout API, remote nutrition API or remote app assets |
| PWA configuration | Local manifest, 192/512 px normal and maskable icons, 180 px Apple touch icon, standalone/fullscreen display modes and worker registration included |
| iPhone layout | Mobile navigation, 16 px form controls, `viewport-fit=cover` and top/bottom/horizontal safe-area padding included |
| Vercel configuration | Repository-root Vite build, `npm ci`, `dist` output, SPA navigation fallback and worker/manifest cache headers included |
| Reference verification | Hosted app HTML, styles and assets retrieved over verified HTTPS; original seven-day training plan and Tuesday primer retained |

The unit tests cover workout validation, completed-set counts, volume, timers,
calorie estimates, jump measurements, history prefill, date boundaries and
nutrition totals. Persistence checks cover saved plans/workouts/meals/preferences,
version conflicts, invalid values, one active workout, storage failures, corrupted
data recovery, portable backups, import validation and resetting only Setline data.

## Premium interface regression checks

The five sections are Today, Train, Progress, Nutrition and More. History and
weekly reports live in Progress; the plan, Routine and data tools remain
accessible through More. Known session names use display aliases without changing
saved plan titles or exercise keys. Existing local storage is retained.

New browser checks cover focused decimal entry, completion-driven advancement,
prefill only into empty sets, invalid-set rejection, rest-bar hit areas, recent
meal and saved-food reuse with distinct record IDs, direct weight check-in,
recorded weight trends, direct import sheets and report-week synchronization.
Editing a saved timed workout cannot affect a separate active workout. Changed
routine instructions clear confirmation and cannot retain a hardcoded zinc dose.

Phone checks include 320×568 and 390×844 viewports with top/bottom safe areas;
the primary Today action is reachable above navigation without scrolling.
The week selector has one horizontal scroll area. All five screens also pass
1280 px desktop containment checks. Existing touch, keyboard, modal, offline,
backup/restore, schedule and persistence regressions remain in the suite.
PWA launch colors match the light interface and the iOS status-bar setting uses
dark text appropriate for that background. Manifest ID, scope, icon paths,
installation mode, service-worker registration and storage key remain stable.

## Complex pairs and timed sets

Explicit adjacent complex-pair labels alternate A1/A2 and B1/B2 by round in one
card. Tests cover incomplete rounds, manual selection, uneven/added sets and
confirmation before advancing. Weight/reps prefill only the same movement's
empty fields; jump measurements and partner loads are never copied. The existing
180-second rest prescriptions remain intact.

Each work timer uses an optional `timerSetId`; older records keep their original
shape. Countdown targets come from the plan. Pause/resume and refresh preserve
the elapsed work for that set, a new set starts at zero, and returning late from
another app cannot record time beyond the countdown. Completion remains explicit.
Manual duration edits and owned-set removal safely clear timer association;
the all-sets stopwatch adopts the next unfinished set. Strict validation and
backup round trips include the optional field.

Touch checks verify readable Complete/Undo contrast after taps and hover, large
timer controls on a 320×568 phone, and grouped progression without the movement
menu. Saved stopwatch durations remain manually editable. Official Hevy/Strong
documentation and a small sample of dated App Store reviews informed the update;
sources and their limits are in [WORKOUT_UX_RESEARCH.md](docs/WORKOUT_UX_RESEARCH.md).

Decimal-entry regressions type both `12.5` and `12,5` with real keystrokes,
preserve intermediate separators, reload the stored fractional value and verify
12.5 kg × 8 reps produces 100 kg of volume. Invalid and empty mandatory weights
cannot reuse a prior value or complete a set; zero and optional bodyweight loads
are handled separately.

Movement dropdown regressions use real browser touch input, rather than setting
scroll positions or using a mouse wheel. The old production build failed at both
390 px and 320 px: its item-aligned menu repeatedly reset the scroll position.
The fixed popup has one scrolling viewport, bounded dimensions and collision
padding for iPhone safe areas. Tests swipe down and back up, reach and select the
last option, keep the background stationary and verify page scrolling resumes
after selection. Coverage includes 390×844, 320×568 and 844×390 screens with
portrait/horizontal safe-area insets, keyboard navigation and selection inside
the plan editor.

Loading guidance preserves each current exercise's rep/time target and separates
main lifts, controlled accessories, very light shoulder work, fast power drills,
core, carries, warm-up and recovery. Tests exclude heavy progression for renamed
custom movements, timed variants and jumps.

The daily calculator checks adult inputs, supports decimal-comma weight and an
unspecified equation, and keeps profile saving separate from applying targets.
Its confirmed personal starting estimate is 3,000 kcal with 128 g protein,
80 g fat and 442 g carbs. Activity is already included. Existing meals, goal
weight, chosen targets and historical workout body weights are preserved.
Older profiles retain their saved weight and can explicitly load the shared
setup details. Volleyball timing saves independently and drives short food tips
for Tuesday/Friday in Europe/Berlin.

Reminder checks cover strict optional-field migration, dates, duplicate entries,
optimistic versions, invalid backups, capacity and storage failures. Meal saving
does not record supplement intake. Taken/Later/Undo are date-specific and
survive reload. New medicines retain prescribed instructions without guessed
frequency; changed instructions clear confirmation. Confirmed clock-time cues
work while Routine is open, in Berlin time. No background push or
closed-app notification service is configured.

Browser tests use the built standalone application with real local storage and
service-worker caching. They cover all five views at 390 px and 320 px widths;
logging, finishing, editing, deleting and restoring workouts; paused workout
reload/resume; editable plans; progress charts; jump/timed movements; meal/weight/
target logging; preferences; iPhone installation instructions; manifest/icons;
offline app reload and workout saving; and backup export/import/reset. Tests also
check for browser runtime errors, iframes and requests to the former backend.

Modal regressions recreate the reported tall Volleyball summary with 120 minutes
and zero completed sets. Portrait, landscape and small-screen checks simulate
iPhone safe-area insets, scroll content to the bottom, verify the 44 px close
button stays at the same visible position, and dismiss with a touch at its actual
screen coordinates. Long plan and meal forms are checked on a short screen too.
The dialog body scrolls independently; the close button remains outside it, and
the modal's bounds exclude all four safe-area insets.

An earlier parallel browser run exposed a movement-timer button partly obscured
by the fixed rest bar and bottom navigation. Movement timers now have a 44 px
minimum touch height, and mobile scrolling reserves space for both bars. The
regression checks the entire button bounds and actual hit points at its center,
top and bottom without forcing a manual scroll or weakening timer assertions.
Five consecutive repetitions passed with two browser workers in 32.3 seconds.

Extra-activity checks cover a 5 km run (64 kg → approximately 320 active kcal),
cycling added while editing a saved workout, correct dates, edit/delete/restore,
watch overrides including zero, weekly/history/progress/nutrition integration,
offline saves and backups. Old version-1 state and backups remain compatible.
Cancelled workouts and deleted extras are excluded from daily energy totals.

Training and nutrition guidance considers the day's scheduled and recorded load,
while keeping planned time separate from completed time and preserving saved
nutrition targets. Tests cover leg/jump/volleyball and recovery contexts, gradual
cardio progression, protein/carbohydrate ranges, and longer-session fueling.
Public reference links are included; live retrieval of these reference pages was
blocked with HTTP 403 in the cloud environment. No external service is used to
generate the recommendations or calculate activity energy.

Short pre/post-training reminders provide meal timing and simple food examples,
hydration, cool-down and sleep advice. Recovery days without substantial extra
training receive a lighter reminder. All 55 default exercise, primer, warm-up and
cool-down names have local technique, working-muscle descriptions, mistakes and
precautions, plus clearly labelled video-search links. Unknown custom movements
receive general guidance; renaming an exercise cannot reuse unrelated instructions
or inherit the old movement's weekly performance comparison.

Activity-file unit checks cover GPX track/segment distance, TCX lap totals,
namespaces, dates/timezones, Strava/generic CSV units and quoted fields, malformed
rows, XML document-type/entity rejection, explicit versus ambiguous energy, file
size limits and duplicates across providers/formats. FIT fixtures use Garmin's
official binary encoder and verify the real decoder, scaled units, multisport
sessions, timer/elapsed fallbacks, CRC integrity and invalid/truncated files.
Import storage checks cover one atomic batch write, capacity, quota retry,
optimistic edits, deleted records, duplicate start instants and provenance backups.

New browser workflows import editable GPX summaries, preserve provenance when
editing/reloading, skip repeated files, reject a malformed CSV without saving,
import multiple CSV records offline, and decode a genuine FIT file using its
precached lazy chunk on first use while offline. They verify total-calorie metadata
does not replace active-energy estimates, and damaged FIT checksums fail visibly.
Short tips, expandable movement/preparation guides and demonstration links are
checked at 320 px. Weekly reports are tested with real completed sessions,
imported activities and meals, previous/next-week navigation and a JSON download.

Weekly analysis counts completed workouts, distinct planned gym dates, recorded
sets/volume/time and undeleted extra activities. It compares the prior week without
inventing a zero-data baseline. Meal averages divide only by days with logged
meals and always identify incomplete records; missing meals are not treated as
zero intake or evidence of a nutritional deficiency.

The production worker precaches the complete local app, including charts and
exercise data. Failed installs do not activate a partial cache. Updates wait for
older app tabs to close, and cleanup removes only Setline app caches. Workouts,
plans and nutrition use the local storage key `setline.gym.v1`; network access is
not required to save them.

The final production output contains 13 precached files. The main JavaScript
bundle is 1,246.47 kB (368.80 kB gzip), the lazy FIT decoder is 431.69 kB
(64.30 kB gzip), and CSS is 332.27 kB (54.47 kB gzip). Vite
reports its standard large-chunk advisory; the build completes successfully.

The reusable cloud install/start configuration was saved as a draft. Publishing
that environment draft is separate from running the validated app or deploying
the repository to Vercel.

Official Doppelherz and dm product-label requests returned CONNECT HTTP 403,
including the retry after official domains were added to the saved environment
network draft. Manufacturer serving instructions were not verified. D3 strength
(2,500 IU = 62.5 µg), the zinc product ingredients and reported once-daily zinc/
magnesium frequency come from the user. K2 amount, omega-3 variant and elemental
magnesium serving remain awaiting label confirmation in the reminder UI. Saving
the domain draft did not establish runtime network access or publication.

## Athlete refinement checks — 2026-10-16

The full app retains Today / Train / Progress / Nutrition / More. Purpose-led
previews, short exercise benefits and intent, deliberate light/dark surfaces and
large stepper controls were reviewed against the current production build.
Session details, technique, effort, weekly calendar and records stay behind a tap.

New automated checks cover:

- Searchable local exercise metadata and alternatives ranked by movement, muscles,
  equipment and purpose; original exercise keys remain resolvable.
- Creating/editing reusable workouts with decimal starting loads, sets, reps,
  target RPE, rest and notes; cancel/invalid drafts leave saved data unchanged.
- Adding, replacing, moving and removing today's work without changing the plan;
  completed sets stay recorded when remaining work is replaced or removed.
- Swapping plan days, assigning custom sessions, confirmed recovery days and
  explicitly restoring recommendations without deleting templates or history.
- Conservative progression, explicit application to only the current unfinished
  set, and unchanged completed sets, other sets and historical records.
- Canonical exercise copies sharing a chart while renamed, retyped and differently
  measured movements remain separate. Session prefill follows the same safety rule.
- Manual jump height and highest touch as separate series; offline save/reload and
  confirmed deletion preserve the other measurement and all existing data.
- Weekly body-weight averages and adequately sampled trends; multi-week stable
  weight can suggest a small calorie increase without changing saved targets.
- Self-reported energy and leg soreness, optimistic versions, strict validation, optional stable planned-session duration,
  old backups without optional fields, malformed imports and full backup/restore.
- Appearance persistence, reachable narrow-phone close controls, all five screens
  without horizontal overflow and restrained session-specific completion records.

The final empty-recovery-day action refinement was followed by 18 passing Today/
customization regressions and 3 passing install/manifest/offline-workout checks
against the final production output. Empty recovery days open guidance without
creating an empty session.

The production checks include the original decimal, rest, complex pair, timed-set,
nutrition, supplement/medication routine, import, history, plan, offline, backup and
PWA regressions. Phone tests cover 320×568 and 390×844, landscape 844×390 with
horizontal insets, 16 px input text, 44 px actions and desktop width 1280.
These are Chromium emulations and source/visual reviews, not a physical Safari run.

The before-change audit and eleven accessible official Hevy/Strong references are
in [PREMIUM_PRODUCT_AUDIT.md](docs/PREMIUM_PRODUCT_AUDIT.md) and
[PREMIUM_BENCHMARKS.md](docs/PREMIUM_BENCHMARKS.md). Other requested benchmark
sites remained blocked by the environment proxy; they are marked unverified.

## Focus and iPhone interaction refinement — 2026-10-16

The screen audit covered all five destinations and 36 distinct states across
320×568, 390×844 and 844×390 viewports: previews, active workouts, complex pairs,
timers, all-set editing, movement/details sheets, history, reports, plan editing,
library, custom builder, nutrition, routine, settings, imports and backup tools.
The final dev inspection found no page errors or horizontal document overflow.
Light/dark screenshots were also reviewed with actual saved-record fixtures.

Today exposes the workout, goal, Start and real weekly gym progress before the
calendar. Both primary actions fit above navigation at 320 px and 390 px with
47 px top and 34 px bottom safe areas. Progress uses calendar-spaced jump-height,
weekly weight and comparable strength records, with no invented empty-state
graphs. Optional primers do not inflate gym-day consistency; recovery is preserved.

Eight new browser workflows cover Today containment, the progress link, keyboard
focus versus touch, reachable workout inputs/Complete, all-set controls in three
logging modes, keyboard-sized meal/preferences sheets, viewport panning, and
resize fallback without the Visual Viewport API. Keyboard tests simulate visual
viewport geometry; they do not exercise a physical iOS keyboard. Existing guide
checks now open Exercise preview before inspecting the unchanged instructions.
Seven new unit checks cover gym-day counting and date-spaced chart coordinates.

No storage schema or key changes are required. The same user records, PWA identity,
manifest paths and versioned writes remain in use. The source shell and generated
offline cache share the updated launch color.

## Practical limits

- Chromium checks emulate phone-sized screens. A physical iPhone/Safari
  installation has not been tested in this workspace.
- Vercel deployment is configured, but no live Vercel deployment is claimed.
  Import/connect the repository to Vercel as described in `README.md`.
- Optional automatic meal-photo analysis needs a separate AI service and remains
  hidden until configured. Manual nutrition logging works locally and offline.
- Strava/Adidas Running import uses exported GPX, TCX, FIT or compatible CSV files;
  automatic account synchronization/OAuth is not configured. ZIP archives must be
  extracted first, and JSON exports are unsupported. Activities must fit the app's
  1–600 minute and maximum 300 km limits. GPX without usable timestamps is rejected;
  elapsed time can include pauses and is editable before saving.
- Video links open a search for the movement; they are not verified individual
  demonstrations. Technique guidance and report calculations work offline.
- Existing logs from the original site's cloud account are not copied. Saved data
  stays on the current device and origin; use Settings backups to move it.
- Browser storage availability and quotas still apply. Failed saves produce an
  error, and invalid backups do not overwrite existing data.

No Apple signing account, native iOS wrapper or weekly certificate renewal is
required for the PWA. Install the deployed HTTPS app using Safari's **Share → Add
to Home Screen** action.
