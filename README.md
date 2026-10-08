# Setline — standalone Gym app

A complete React + Vite workout tracker and installable PWA, rebuilt from the
hosted Setline app's delivered React code, styles, and visual reference. The app
runs on its own: no iframe, sign-in service, old website, external workout API,
or native iPhone signing is required.

## Features

- **Workout:** original seven-day gym/volleyball/recovery plan, extra Tuesday jump
  primer, week/day navigation, warm-up and cool-down checklists, exercise cues,
  weights/reps/time/RIR, jump measurements, session and movement timers, automatic
  rest timer, notes, intensity and calorie estimates/watch calories.
- **History:** completed workout summaries, editing, deletion, undo and restoration.
- **Progress:** exercise comparisons, personal bests and charts from your own logs.
- **Nutrition:** multi-food meals, calories/macros, daily weight entries and targets.
- **Daily nutrition estimate:** editable age, height, body weight, activity and
  surplus calculate a gradual weight-gain starting target. Calculation details
  and daily targets save separately; existing meals, weight logs and chosen
  targets are preserved until explicitly changed. The confirmed new-install
  profile is 18, male, 180 cm and 64 kg, with four gym and two volleyball sessions.
- **Volleyball schedule:** Tuesday and Friday, 20:00–22:00 Europe/Berlin, with
  editable times and short meal guidance that follows the selected date.
- **Reminders:** supplement and medication instructions in Nutrition, with separate
  Taken/Later/Undo records for each date. Saving a meal prompts relevant pending
  reminders without marking a dose taken. Confirmed clock reminders show a cue
  while the view is open. Reminders, history and settings are included in backups.
- **My plan:** edit days and movements, sets/targets/rest, logging mode and preparation.
- **Settings:** body weight, default rest, home-screen installation, validated backup
  export/import, recovery export and confirmed local-data reset.
- **Extra activities:** dated runs, rides, walks, swimming and custom activities
  outside the recurring plan. Log distance, duration and effort, preview active
  calories, edit/delete/restore and include them in History and weekly Progress.
  Activities can also be added while editing a saved workout for that workout's date.
- **Training and nutrition guidance:** expandable recommendations based on the
  selected day's plan and logged activity, including leg/jump/volleyball load,
  recovery, protein/carbohydrate ranges, long-session fueling and hydration.
- **Before and after training:** two short reminders with food examples, meal
  timing, hydration, cool-down and sleep, including a lighter recovery-day version.
- **Exercise guides:** expandable local instructions for every original exercise,
  warm-up and cool-down, with technique, working muscles, common mistakes,
  precautions and a link to find a video demonstration. Custom movements receive
  a general checklist and keep your saved coaching cue.
  Load and rep advice distinguishes main lifts, controlled accessories, power,
  core and mobility while preserving each exercise's actual prescribed target.
- **Activity imports:** GPX, TCX, FIT and Strava CSV exports, with editable previews,
  duplicate checks and local batch saving. Imported activities join your daily
  totals, History and Progress without changing the recurring plan.
- **Weekly report:** completed workouts, planned gym days, sets, volume, extra
  running/cycling distances, active energy, comparisons with the previous week,
  short analysis and next-week suggestions. Logged meals show a partial protein
  summary; unrecorded meals are unknown. Reports can be downloaded as JSON.

Workout data, extra activities, plans, preferences and nutrition are stored in this browser/device
under `setline.gym.v1`. They persist across reloads and can be used offline after
one successful online load. No demo workout history is inserted.

Workout weights accept typed decimal dots or commas (`12.5` or `12,5`), keep the
separator while typing, and save the fractional value. Invalid entries cannot
reuse an old weight or complete a set. Zero and an empty input remain distinct.

The nutrition calculator uses Mifflin–St Jeor resting energy × usual activity +
an editable surplus, rounded to 100 kcal. The initial personal estimate is about
3,000 kcal, 128 g protein, 80 g fat and 442 g carbs daily. It includes habitual
training; imported or logged activity calories are not added again. Protein uses
2 g/kg, fat approximately 24% of energy, and carbs the remainder. These are
adjustable adult starting estimates. Compare weekly average morning weights over
2–3 weeks before changing intake by roughly 100–150 kcal/day. Older saved profiles
and historical logging weights are retained; shared setup details can be loaded
and explicitly saved in the calculator.

Reminders record label or prescribed instructions, rather than recommend doses.
The zinc product is user-confirmed once daily (15 mg zinc, 100 mg histidine and
19 mg cysteine). D3 + K2, omega-3 and Magnesium 500 remain awaiting exact label
confirmation, with the known information in their editable instructions. Brand
names and pack strengths do not establish a daily serving. Other medication
frequencies stay as instructions; confirmed once-daily schedules can be tracked.
Changing instructions or frequency clears confirmation. No medicines are invented.
The checklist works locally and offline; background iPhone alerts/Web Push are
not configured. Service-worker timers are not used to promise closed-app alerts.

Running with a distance uses approximately 1 active kcal per kilogram per kilometre
for level continuous running. Other entries use effort-based MET assumptions minus
resting energy. An entered watch active-energy reading replaces the estimate,
including zero. Each activity stores its logging body weight, so later preference
changes do not rewrite old estimates. Log additional time only once: activity
calories should not duplicate a workout or a watch reading covering that workout.

Guidance references ISSN/ACSM sports nutrition, the CDC talk test and concurrent
training research. These are general starting ranges for adults who train; they
do not automatically change saved calorie or macro targets. Sources and estimate
methods are visible in the app and all calculations work offline.

## Import from Strava or Adidas Running

In **Workout → Import activities**, choose exported GPX, TCX, FIT or CSV files,
review the date, moving minutes, distance, effort and body weight, then import.
Strava provides GPX/original-file exports per activity and an activities CSV in
its account archive. For Adidas Running, request your account data export and
choose supported activity files from it. Export formats vary; JSON and ZIP files
are not supported. Extract archives first. Generic CSV files need explicit time
and distance units, such as `duration_minutes` and `distance_km`.

Files are processed entirely on this device, including offline. No account login,
OAuth connection or automatic synchronization is configured. Up to 10 files of
10 MB each and 500 activities can be reviewed in one batch. GPS route points are
used to calculate summaries but are not stored. GPX elapsed time can include stops;
adjust the preview to match moving time. Exact duplicates are skipped; similar
manual entries require review. Deleted imports can be restored in History.

Unlabelled source calories can include resting energy and remain informational.
Only explicitly labelled active calories replace the app's active-energy estimate.
Import each activity once and avoid adding a separate record for time already
included in a workout. Import details survive editing and local backup export.

Automatic meal-photo analysis is not configured: it requires a separate AI service.
The original optional photo workflow is retained with an explicit availability
message; all manual meal/weight/nutrient logging works offline.

## Run and build

Use Node.js 24 LTS from the repository root:

```sh
npm ci
npm run dev
npm run build
npm run preview
```

`npm run build` checks TypeScript, creates the production Vite bundle in `dist`,
and generates the service worker. The worker caches all local app assets, including
exercise data and charts. It does not need or contact the old website. Updated
workers activate when prior app tabs close to avoid changing assets mid-workout.

## Deploy directly to Vercel

1. Import `96gb7p6wfp-a11y/gym`, branch `main`.
2. Root directory: repository root. Node.js version: 24.
3. `vercel.json` sets Vite, `npm ci`, `npm run build`, and output directory `dist`.
4. Deploy. No environment variables or credentials are required.

To install on iPhone, open the deployed HTTPS URL in Safari, tap **Share → Add to
Home Screen**, enable **Open as Web App** if shown, and tap **Add**. The manifest,
app icons, service worker, standalone display mode and safe-area layout are included.
No weekly certificate renewal is involved.

A Vercel deployment is not created by a Git push alone; import/connect the
repository in your Vercel account to deploy it.

## Your data

Data stays on the current device and origin; changing the domain or clearing
browser storage can remove access to it. Export a backup in Settings before moving
phones, changing deployment domains or clearing site data. Import replaces current
local data only after confirmation and validation. Invalid backups never overwrite
saved data. If saved data is damaged, a recovery copy can be exported before reset.
Existing version-1 data and backups without extra activities remain compatible.
Browser storage quotas/private browsing rules still apply; save failures are shown
rather than silently reported as saved.

Logs previously saved by the original site's cloud account are not automatically
copied. This app begins with the original training plan and an empty personal log.

## Verify

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:web
```

Browser checks exercise real local workflows and offline persistence, without
mocking a hosted gym. Linux cloud checks can use
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:web`.
See `VALIDATION.md` for the performed checks and limitations.

## Structure

`src/App.jsx`, `NutritionView.jsx`, `domain.js`, `components/ui.jsx` and
`reference.css` preserve the reference's application behavior and appearance.
`storage.ts` provides validated local persistence; `DataSettings.tsx` provides
backups and reset; `activities.ts` and `ExtraActivities.tsx` implement dated extra
activity logging; `coaching.ts` and `DailyGuidance.tsx` provide general sports
guidance; `main.tsx` mounts React. `public` contains local icons, manifest
and worker registration, and `scripts/finalize-web.mjs` generates the production
service worker. The prior iPhone/website wrapper has been removed.
`activity-import.ts`, `fit-import.ts` and `ActivityImport.tsx` handle local activity
files; `exercise-guides.ts` and `ExerciseGuide.tsx` provide movement instructions;
`weekly-report.ts` and `WeeklyReport.tsx` generate reports from saved data.
