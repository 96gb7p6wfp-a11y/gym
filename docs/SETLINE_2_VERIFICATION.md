# Setline 2 verification

Release checks run on 17 October 2026 against the generated production app.

- `npm test`: 261 tests for storage, calculations, imports, programme and training behavior.
- `npm run build`: TypeScript, Vite output and content-versioned service-worker generation.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:web`: complete browser suite, including ten native-reset cases.
- `git diff --check`: whitespace validation.

The browser suite covers decimal dot/comma weights; focused and All Sets logging; complex pairs; per-set timers and rest; exercise add/replace/remove/reorder; custom workouts; weekly-plan editing and reset; the reversible eight-week programme; history; separate jump-height and highest-touch records; adequately sampled weight trends; nutrition; routines; imports; backup/restore; refresh persistence; and offline recording.

New cases exercise 320×568, 390×844 and 430×932 viewports in both themes with simulated 47px top and 34px bottom safe areas. They check full-width tab geometry, reachable Today/Train actions, one selected chart, read-only library browsing with search/focus restoration, initial workout completion visibility and meal logging clear of the rest timer.

Existing keyboard coverage includes shortened and panned Visual Viewports, fallback without that API, long dropdown touch scrolling, native plan controls and focus restoration. Sheet Close targets remain fixed outside the single scrolling body and at least 44×44 pixels. Complete and Undo contrast is checked after repeated taps.

Visual review covers Today, session preview, focused logging, Progress, Nutrition, More, the weekly timeline, Routine and Settings at small/standard/large iPhone widths and desktop, in both appearances. These are Chromium browser checks with iPhone-sized viewports and touch input, not a claim of physical-device Safari/WebKit testing. The live Apple HIG access limitation is recorded in the research document.

The stored schema, `setline.gym.v1`, session snapshots, backup payloads and manifest installation identity are unchanged. No migration or reset is needed. Vercel continues to install with `npm ci`, build with `npm run build` and serve `dist`. The app remains independent of the former hosted site and external accounts.
