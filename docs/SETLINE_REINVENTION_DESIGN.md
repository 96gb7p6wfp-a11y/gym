# Setline — Athlete’s Journal

## Decision

The existing presentation is rejected. This is a replacement of its composition and interaction hierarchy, preserving the product and all stored records.

Three directions were compared before implementation:

1. **Athlete’s Journal:** a dated session cover, a focused training workspace, and one measured progress lens. Selected for a clear personal identity and fewer competing decisions.
2. **Courtline Agenda:** a chronological date rail with sport, gym and activities. Useful scheduling, but it makes the calendar too prominent.
3. **Precision Bench:** a dense set ledger with direct inputs. Fast, but too close to a technical dashboard.

The selected direction changes more than styling: four primary destinations, Nutrition as a secondary route, a centered session cover without the home metric grid, a new set-control composition, a single dominant progress metric, and quieter utility navigation.

## Identity and system

Quiet luxury, athletic purpose, native operation. No decorative imagery, gradients, invented readiness scores, motivational filler or collections of cards.

- **Body/controls:** system sans (`-apple-system`, BlinkMacSystemFont, Helvetica Neue).
- **Session identity and page titles:** `ui-serif`, Iowan Old Style, Palatino, Georgia; regular weight. Used selectively, never for form fields.
- **Numbers:** system sans, tabular, light-to-medium weight. One dominant number at a time.
- **Sizes:** session cover 44–52px; page title 30–34px; active exercise 28–34px; primary metric 60–68px; row title 16px; body 15px; support 13px; labels 11px.
- **Rhythm:** 4 / 8 / 12 / 18 / 24 / 32 / 48 / 64px. Mobile outer inset 24px, 20px on small phones.
- **Radius:** 8px controls, 12px contextual grouped inputs, 24px sheets. Content sections are open, rather than cards.
- **Light:** canvas `#f4f1eb`, surface `#fffcf7`, secondary surface `#eae5dc`, ink `#28252a`, support `#6e6367`, accent `#824a50`, on-accent `#fffbf4`, divider `#d9d1c9`.
- **Dark:** canvas `#1a1b20`, surface `#24252c`, secondary surface `#2e2f37`, ink `#f1eee7`, support `#b4acb0`, accent `#d6a4a4`, on-accent `#301e24`, divider `#3b3a42`.
- Accent indicates a primary action, selection or measured chart. It does not color every icon or category.
- Touch targets are at least 44px. No transient text-color crossfades. Press feedback changes a semantic surface or scale subtly.

## Navigation and placement

Four primary destinations: **Today / Train / Progress / You**. The internal `more` route remains to avoid changing stored behavior.

- Nutrition is one tap from Today’s Fuel row, and in You’s first utility group.
- Plan, saved workouts and exercise library are in You and relevant training actions.
- History, body weight, jump tests and weekly reports remain in Progress or You.
- Routine, settings, supplements, imports and backup/restore remain accessible through You and contextual actions.
- Nutrition is a real secondary screen under You, not a hidden fifth tab.

## Screen compositions

### Today — session cover

Compact brand/date masthead. A centered, proper-case serif session name is the main visual identity, with one purpose line and a quiet duration/exercise baseline. One obvious Start/Continue/View action. A compact next-event agenda row and Fuel/weekly-progress access replace the equal-weight three-metric dashboard. Do not display recovery values without actual check-ins.

### Train — prepare, then perform

Compact day selection; session purpose and summary. Workout choice/creation are contextual, rather than persistent peer actions. A numbered sequence opens full exercise details. Keep Edit discoverable. Preparation, activity tools and fuel stay secondary.

During training: compact chapter header, adjacent previous performance, current set, two large numeric rails with integrated −/+ controls, one Complete action. Preserve automatic rest, decimal/comma entry, complex-pair sequencing and timed actions. Technique and adaptation remain on demand. Do not replace the validated state transitions.

### Progress — a measured lens

One selected metric leads: its real value/change, a restrained full-width plot, and one short supported insight. Other metrics are quiet selectable rows, not a four-up dashboard. Keep height/touch protocols separate and label profile values/estimates clearly. No fabricated empty-state charts or percentages.

### Nutrition — remaining intake

An intentional remaining-calorie composition, protein as the primary supporting measure, carbs/fat subordinate. Meal logging stays quick. Hide target configuration and saved/recent food tools until requested. Use a human-readable date control. Empty targets invite setup without showing a large empty dashboard.

### You / plan / utilities

Typography-led utility groups, selective icons, no oversized grouped cards. Week timeline first in Plan; schedule/programme configuration below. Keep day editing, reset and recommended programme reversible.

### Library and details

Search first, compact category selection, minimal result metadata. Details show benefit and initial technique cues before setup metadata. Alternatives, loading guidance and demonstrations remain available. Use one accessible sheet with fixed Close and one scrolling body.

## Engineering constraints

- Replace `native-system.css` and `native-shell.css`; do not append another redesign overlay.
- Replace owned screen markup and CSS consistently. Retain shared semantic tokens for secondary components.
- Keep `app.css` safe-area/visible-viewport/select mechanics and `mobile-interactions.css` keyboard behavior.
- Keep one transform system for sheets; no independent CSS translate plus centering transform.
- Preserve `setline.gym.v1`, schema and record versions, all storage handlers, workout snapshots and programme resolution. No migrations or resets are needed.
- Update theme metadata and manifest colors without changing installation identity, scope or start URL.
- Judge actual screenshots in light and dark at 320/390/430px, plus landscape/desktop. Automated checks support, rather than replace, visual review.
