# Standalone app validation

Validation performed in the Linux cloud workspace on 2026-10-07. This repository
contains the full React + Vite Setline gym app and an installable PWA. The previous
website/iPhone wrapper and native build configuration have been removed.

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed; 123 packages installed, resolved dependencies recorded in `package-lock.json` |
| `npm run typecheck` | Passed |
| `npm test` | Passed: 31 tests, zero failures or skips |
| `npm run build` | Passed; TypeScript check, Vite production bundle and generated service worker |
| `npm run test:web` | Passed: 13 real Chromium application workflows in 57.2 seconds, zero failures |
| Development server | Passed; HTTP 200 for the Vite page and React entry module |
| Visual comparison | Home and plan screenshots reviewed; original appearance retained with local app icon |
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

Browser tests use the built standalone application with real local storage and
service-worker caching. They cover all five views at 390 px and 320 px widths;
logging, finishing, editing, deleting and restoring workouts; paused workout
reload/resume; editable plans; progress charts; jump/timed movements; meal/weight/
target logging; preferences; iPhone installation instructions; manifest/icons;
offline app reload and workout saving; and backup export/import/reset. Tests also
check for browser runtime errors, iframes and requests to the former backend.

The production worker precaches the complete local app, including charts and
exercise data. Failed installs do not activate a partial cache. Updates wait for
older app tabs to close, and cleanup removes only Setline app caches. Workouts,
plans and nutrition use the local storage key `setline.gym.v1`; network access is
not required to save them.

The final production output contains 12 precached files. The main JavaScript
bundle is 883.49 kB (259.94 kB gzip), and CSS is 176.41 kB (27.99 kB gzip). Vite
reports its standard large-chunk advisory; the build completes successfully.

The reusable cloud install/start configuration was saved as a draft. Publishing
that environment draft is separate from running the validated app or deploying
the repository to Vercel.

## Practical limits

- Chromium checks emulate phone-sized screens. A physical iPhone/Safari
  installation has not been tested in this workspace.
- Vercel deployment is configured, but no live Vercel deployment is claimed.
  Import/connect the repository to Vercel as described in `README.md`.
- Optional automatic meal-photo analysis needs a separate AI service and is
  visibly unavailable. Manual nutrition logging works locally and offline.
- Existing logs from the original site's cloud account are not copied. Saved data
  stays on the current device and origin; use Settings backups to move it.
- Browser storage availability and quotas still apply. Failed saves produce an
  error, and invalid backups do not overwrite existing data.

No Apple signing account, native iOS wrapper or weekly certificate renewal is
required for the PWA. Install the deployed HTTPS app using Safari's **Share → Add
to Home Screen** action.
