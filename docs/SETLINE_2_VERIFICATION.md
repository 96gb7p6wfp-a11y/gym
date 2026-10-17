# Setline 2 verification

Release checks run on 17 October 2026 against the generated production app.

- `npm test`: **261 passed** for storage, calculations, imports, programme and training behavior.
- `npm run build`: TypeScript, Vite output and content-versioned service-worker generation.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:web`: **105 passed**, including ten native-reset and five contrast cases.
- `git diff --check`: whitespace validation.

The browser suite covers decimal dot/comma weights; focused and All Sets logging; complex pairs; per-set timers and rest; exercise add/replace/remove/reorder; custom workouts; weekly-plan editing and reset; the reversible eight-week programme; history; separate jump-height and highest-touch records; adequately sampled weight trends; nutrition; routines; imports; backup/restore; refresh persistence; and offline recording.

New cases exercise 320×568, 390×844 and 430×932 viewports in both themes with simulated 47px top and 34px bottom safe areas. They check full-width tab geometry, reachable Today/Train actions, one selected chart, read-only library browsing with search/focus restoration, initial workout completion visibility and meal logging clear of the rest timer.

Existing keyboard coverage includes shortened and panned Visual Viewports, fallback without that API, long dropdown touch scrolling, native plan controls and focus restoration. Sheet Close targets remain fixed outside the single scrolling body and at least 44×44 pixels. Complete and Undo contrast is checked after repeated taps.

Visual review covers Today, session preview, focused logging, Progress, Nutrition, More, the weekly timeline, Routine and Settings at small/standard/large iPhone widths and desktop, in both appearances. These are Chromium browser checks with iPhone-sized viewports and touch input, not a claim of physical-device Safari/WebKit testing. The live Apple HIG access limitation is recorded in the research document.

The stored schema, `setline.gym.v1`, session snapshots, backup payloads and manifest installation identity are unchanged. No migration or reset is needed. Vercel continues to install with `npm ci`, build with `npm run build` and serve `dist`. The app remains independent of the former hosted site and external accounts.

## Contrast and training follow-up

Replaced legacy white preparation cards with open disclosure rows in Train, saved-workout details and plan previews. The exercise count and Edit day action now share one row. Warm-up and cool-down retain their checklist data, with 44px touch targets and shorter introductory text.

Five new browser cases check actual foreground/background contrast of at least 4.5:1 for preparation copy in both themes, expanded and completed states, empty History, button hover and movement/rest timers. They also verify checklist persistence after refresh. Additional production checks cover 320px, 390px and 430px portrait layouts, landscape and desktop; exercise preview and Edit day remain separately operable without horizontal overflow.

The existing landscape touch test now accepts an exact 40px reverse swipe, matching its intended minimum. Native touch scrolling, full-list traversal, selection, safe-area bounds and background scroll unlocking remain covered.
