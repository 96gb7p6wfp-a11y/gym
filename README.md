# Setline — Performance PWA

A complete React + Vite workout tracker and installable PWA, rebuilt from the
hosted Setline app's delivered React code, styles, and visual reference. The app
runs on its own: no iframe, sign-in service, old website, external workout API,
or native iPhone signing is required.

## V17 — Calm Performance

V17 refines the existing Setline Soft interface around faster workout logging:
clearer Progress actions, two-level warm-up actions, quieter Focus controls,
exercise-specific Quick Log inputs, compact previews and grouped settings.
The forest/sage palette and existing training features remain in place.
See the [V17 implementation notes](docs/SETLINE_V17_RELEASE.md) for the exact
changes, preservation boundaries and device-verification limits.

## Setline Soft design

The latest design follows the user’s five visual references: rounded native controls,
layered cards and a monochromatic Morandi sage palette with gentle wash tones.
System rounded titles, large readable numbers, circular steppers and a floating
four-tab capsule replace the flat serif journal presentation. Today keeps one
obvious training action. Progress uses one real measured chart at a time.

Nutrition, exercise details, the weekly plan, Routine, history and settings share
the same light/dark surfaces. Exercise details include an original optional muscle
schematic; no third-party photos or remote assets are required.

Existing `setline.gym.v1` data, plans, session snapshots, imports, backup format and
PWA identity are unchanged. No migration or reset is needed.

[Current design system](docs/SETLINE_SOFT_DESIGN.md) · [Reference research](docs/SETLINE_REINVENTION_RESEARCH.md)

## Features

- **8-week volleyball-first plan:** in You → Training plan, open
  **Programme & customization**, choose a start Monday, mark Sunday match weeks,
  then tap **Use this plan**. The prior weekly plan is
  kept for restoration. Match weeks use Saturday's short primer; other weeks use
  Reactive + Hard Lower B. Week 4 deload and week 8 peak/retest adjust new session
  doses. Date-specific readiness moderates jumping; Saturday requires a check.
  Running and school PE remain scheduled cues until you log them. Optional arms
  and Tuesday pogos start off. [Plan details](docs/VOLLEYBALL_MASTER_PLAN.md).
- **Personal training:** purpose-led strength and power sessions around Tuesday/Friday
  volleyball, with fast controls, quiet exercise intent and deliberate light/dark modes.
- **Exercise library:** 158 local movements, search-first selection and optional muscle,
  goal, equipment, movement and training-type filters. Alternatives rank similar stimuli
  and explain tradeoffs in one line.
- **Change today:** add, replace, move or remove remaining work without rewriting the
  weekly plan. Completed sets stay in the log. Quick effort/load adjustments and an
  optional energy/leg-soreness check-in remain behind workout options.
- **Custom workouts:** create, edit and start reusable sessions; save the current workout
  as a template. Customize or swap weekly days, assign templates, and explicitly restore
  the recommended plan without losing history or preferences.
- **Progression:** comparable completed sets and effort guide conservative rep or load
  suggestions. Applying a suggestion is explicit and affects only the current set.
  Explosive work prioritizes quality; volleyball timing and recorded readiness moderate
  advice. Renamed, retyped and differently measured movements have separate baselines.
- **Performance:** separate standing/approach/block jump height and highest-touch records,
  weekly weight averages, suitable strength/repetition/estimated-1RM/volume records, and
  concise load insights. Stable multi-week weight can suggest a small food increase;
  saved calorie targets never change automatically.
- **Today:** the workout, its goal, one main action and weekly gym progress first;
  next volleyball, day selection in a sheet and a Fuel shortcut stay quiet.
- **Train:** focused exercise and current-set controls, previous performance,
  quick completion and automatic advancement. All-set editing and the original
  seven-day gym/volleyball/recovery plan remain available, including the Tuesday jump
  primer, week/day navigation, warm-up and cool-down checklists, exercise cues,
  weights/reps/time/RIR, jump measurements, session and movement timers, automatic
  rest timer, notes, intensity and calorie estimates/watch calories.
  Complex pairs alternate by round in one view while keeping prescribed rest.
  **[Volleyball Performance Master Plan V13.1](docs/VOLLEYBALL_MASTER_PLAN.md)**
  is the current opt-in recommendation: review and apply it from Train or
  You → Training plan. It preserves the running cycle, V8.1 restore version and records.
  Thursday supersets retain unequal set counts; Saturday Lower B can explicitly
  move to Sunday once, while Sunday matches take priority. Clearance and readiness
  adapt future preparation without rewriting active or historical workouts.
  Today → View workout opens the complete date-specific plan without starting a
  timer or writing history. Its exercise options edit that date only; the weekly
  plan remains separate. Start workout opens compact, session-specific quick prep
  (usually 3–5 minutes) with individual drill checkboxes, a primary **Start workout**
  and secondary **Skip warm-up**. **I warmed up elsewhere** is available under
  **Full preparation**. Starting does not mark unchecked drills complete.
  Start workout stays available without checklist gates. Specific lifting/jump preparation follows
  when needed; full saved preparation remains available. Checks survive refresh
  and are saved honestly with the session, including unrecorded preparation.
  Rest alerts use a local two-tone chime, absolute deadlines and ±15-second controls.
  Settings → Appearance & Sound has Timer sounds, alert volume and Test sound. The same
  local double-beep is used for the test and real alerts, with gesture initialization
  and bounded foreground audio recovery. Only the listener can confirm audibility.
  Locked/background iPhone playback is not promised; overdue rests update silently
  on return. See [the audio findings and exact iPhone verification steps](docs/AUDIO_AND_QUICK_PREP_VERIFICATION.md).
  Short timed movements have a per-set countdown with quick duration adjustment,
  pause/resume/reset and explicit completion; longer activities retain manual minutes.
- **Progress:** an overview with one selected Jump / Body weight / Strength chart with real dated trends, weekly body-weight
  averages, comparable strength and recovery-aware training cadence. Detailed charts,
  personal bests, History with editing/deletion/restoration, and weekly reports remain available.
  Empty Strength offers a strength-workout action; **Log body weight** opens the
  separate body-weight entry and returns to the originating Progress view on save or cancel.
- **Nutrition:** calories and protein remaining, quick multi-food meals, recent
  meals, saved foods, daily weight entries and targets.
  Daily targets offers a separate, confirmed V13.1 starting estimate of 3,050 kcal,
  130 g protein, 420 g carbs and 95 g fat. Existing targets and food logs stay until
  explicitly changed. Optional meal reminders reuse Routine; supplement doses stay.
- **Daily nutrition estimate:** editable age, height, body weight, activity and
  surplus calculate a gradual weight-gain starting target. Calculation details
  and daily targets save separately; existing meals, weight logs and chosen
  targets are preserved until explicitly changed. A genuinely new installation
  starts with unknown body weight, neutral preferences and optional setup; it does
  not inherit the owner's age, height, nutrition details or volleyball schedule.
- **Volleyball schedule:** established personal plans retain their saved schedule,
  including Tuesday/Friday sessions where configured, with editable times and
  short meal guidance that follows the selected date.
- **Routine:** supplement and medication instructions in You, with separate
  Taken/Later/Undo records for each date. Saving a meal prompts relevant pending
  reminders without marking a dose taken. Confirmed clock reminders show a cue
  while Routine is open. Optional dosage text and before/with/after-food timing
  preserve older records. Reminders, history and settings are included in backups.
- **Training plan:** in You or via Today/Train; edit days and movements,
  sets/targets/rest, logging mode and preparation.
- **Settings:** grouped into **Training**, **Appearance & Sound** and **Data & Backup**.
  Body weight/default rest use **Save training defaults**; mode, appearance and
  sound controls label their automatic saving separately. Existing home-screen
  installation, validated backup export/import, recovery export and confirmed
  local-data reset remain available. App-version details live under Data & Backup
  → App & training plan.
- **Extra activities:** dated runs, rides, walks, swimming and custom activities
  outside the recurring plan. Log distance, duration and effort, preview active
  calories, edit/delete/restore and include them in History and weekly Progress.
  Activities can also be added while editing a saved workout for that workout's date.
- **Training and nutrition guidance:** expandable recommendations based on the
  selected day's plan and logged activity, including leg/jump/volleyball load,
  recovery, protein/carbohydrate ranges, long-session fueling and hydration.
- **Before and after training:** two short reminders with food examples, meal
  timing, hydration, cool-down and sleep, including a lighter recovery-day version.
- **Exercise guides:** native-feeling sheets with local instructions for every original exercise,
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

Workout data, extra activities, custom workouts, jump/readiness records, plans, preferences and nutrition are stored in this browser/device
under `setline.gym.v1`. They persist across reloads and can be used offline after
one successful online load. No demo workout history is inserted.

Workout weights accept typed decimal dots or commas (`12.5` or `12,5`), keep the
separator while typing, and save the fractional value. Invalid entries cannot
reuse an old weight or complete a set. Zero and an empty input remain distinct.

The nutrition calculator uses Mifflin–St Jeor resting energy × usual activity +
an editable surplus, rounded to 100 kcal. Calculations require the user's own
confirmed inputs; new installations do not receive a personal calorie estimate.
The calculation includes habitual
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

In **You → Import activities** or **Train → Session tools → Activities**, choose exported GPX, TCX, FIT or CSV files,
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
The optional photo workflow stays hidden until that service is available;
all manual meal/weight/nutrient logging works offline.

## V14 app improvements

[V14](docs/SETLINE_V14.md) adds validated restore previews with a pre-restore
safety copy, explicit previous-set reuse, quick RIR, compatible-test Approach
Advantage, separate counted/estimated/unclassified jump contacts, saved-plan
version status, deferred screen loading and rest-deadline recovery after refresh.
Your V13.1 training plan remains an opt-in prescription; installing V14 does not
replace it. Close other Setline tabs before restoring and verify backup files in
Files/Downloads. Physical iPhone background audio remains unverified.

## V15 results and usability

Progress → **Training journey** shows real dated results over 4 weeks, 12 weeks
or all history, with movement/rep selection, recorded effort, weekly work and links
to original workouts. It does not invent fitness scores or apply today's plan to
historical adherence. Previous set context appears in workout previews; older
jump entries remain reachable; available updates appear in You. The V13.1
prescription and local data remain unchanged.

Read the [product audit](docs/SETLINE_V15_AUDIT.md),
[public user-feedback research](docs/SETLINE_V15_USER_FEEDBACK.md) and
[V13.1 plan review](docs/V131_TRAINING_REVIEW.md).

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
copied. Established local installations retain their saved plans and records;
new installations start with neutral setup and no synthetic workout history.

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

`src/App.jsx` coordinates the four destinations and preserves the original workout
mutations. `TodayView.jsx`, `FocusedWorkout.tsx` and `ProgressOverview.tsx` provide
the focused views. `QuickWorkoutLog.tsx` shares the active session;
`exercise-input.ts` derives field presentation from saved logging metadata.
`SettingsExperience.tsx` groups existing controls without owning persistence.
`components/design.tsx`, `native-system.css`, `native-shell.css`
and the screen styles provide the shared visual system; see the
[current design system](docs/SETLINE_SOFT_DESIGN.md).
`NutritionView.jsx` and `domain.js` retain the existing nutrition and training rules.
`storage.ts` provides validated local persistence; `DataSettings.tsx` provides
backups and reset; `activities.ts` and `ExtraActivities.tsx` implement dated extra
activity logging; `coaching.ts` and `DailyGuidance.tsx` provide general sports
guidance; `main.tsx` mounts React. `public` contains local icons, manifest
and worker registration, and `scripts/finalize-web.mjs` generates the production
service worker. The prior iPhone/website wrapper has been removed.
`activity-import.ts`, `fit-import.ts` and `ActivityImport.tsx` handle local activity
files; `exercise-guides.ts` and `ExerciseGuide.tsx` provide movement instructions;
`weekly-report.ts` and `WeeklyReport.tsx` generate reports from saved data.

## Product review

The current visual direction and verified public UX benchmarks are recorded in
[the current design rationale](docs/SETLINE_SOFT_DESIGN.md) and
[the research record](docs/SETLINE_REINVENTION_RESEARCH.md). Accessible official
pages and screenshots are distinguished from destinations the cloud proxy blocked.

## V16 product maturity

V16 adds safe, targeted set completion with Undo, neutral/skippable onboarding, Simple and Athlete presentation, shared Focus/Quick Log, optional machine identity, evidence-qualified progress, quick partial nutrition, searchable history and truthful backup/support controls. Existing V15/V13.1 records and local-first storage remain in place.

See the [release and validation notes](docs/SETLINE_V16_RELEASE.md), [measured long-term performance](docs/V16-PERFORMANCE.md), and [data trust / future cloud architecture](docs/SETLINE_V16_DATA_TRUST.md). Physical iPhone behavior and legal/operator requirements are explicitly distinguished from automated verification.
