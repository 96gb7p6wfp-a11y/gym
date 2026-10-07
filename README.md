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
- **My plan:** edit days and movements, sets/targets/rest, logging mode and preparation.
- **Settings:** body weight, default rest, home-screen installation, validated backup
  export/import, recovery export and confirmed local-data reset.

Workout data, plans, preferences and nutrition are stored in this browser/device
under `setline.gym.v1`. They persist across reloads and can be used offline after
one successful online load. No demo workout history is inserted.

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
backups and reset; `main.tsx` mounts React. `public` contains local icons, manifest
and worker registration, and `scripts/finalize-web.mjs` generates the production
service worker. The prior iPhone/website wrapper has been removed.
