# Standalone app validation

Validation performed in the Linux cloud workspace on 2026-10-08. This repository
contains the full React + Vite Setline gym app and an installable PWA. The previous
website/iPhone wrapper and native build configuration have been removed.

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed; 132 packages installed, resolved dependencies recorded in `package-lock.json` |
| `npm run typecheck` | Passed |
| `npm test` | Passed: 168 tests, zero failures or skips |
| `npm run build` | Passed; TypeScript check, Vite production bundle and generated service worker |
| `npm run test:web` | Passed: 36 real Chromium application workflows in the final full run, zero failures (1.8 minutes) |
| Development server | Passed; HTTP 200 for the Vite page and React entry module |
| Visual review | Production Nutrition screenshot at 390 px and reminder checklist at 320 px reviewed; prior home/plan/guide/import/report reference comparison retained |
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

Decimal-entry regressions type both `12.5` and `12,5` with real keystrokes,
preserve intermediate separators, reload the stored fractional value and verify
12.5 kg × 8 reps produces 100 kg of volume. Invalid and empty mandatory weights
cannot reuse a prior value or complete a set; zero and optional bodyweight loads
are handled separately.

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
work while the Nutrition view is open, in Berlin time. No background push or
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
bundle is 1,076.27 kB (322.69 kB gzip), the lazy FIT decoder is 431.69 kB
(64.30 kB gzip), and CSS is 197.45 kB (31.82 kB gzip). Vite
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

## Practical limits

- Chromium checks emulate phone-sized screens. A physical iPhone/Safari
  installation has not been tested in this workspace.
- Vercel deployment is configured, but no live Vercel deployment is claimed.
  Import/connect the repository to Vercel as described in `README.md`.
- Optional automatic meal-photo analysis needs a separate AI service and is
  visibly unavailable. Manual nutrition logging works locally and offline.
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
