# Setline 2.0 — presentation reset

## Product and priorities

Preserve the volleyball-first programme, workout engine and all local records. Replace the presentation layer with an iPhone-first application built around one useful question per screen. The priority order remains volleyball, approach jump, explosive power, strength, gradual muscle gain and recovery.

## New visual language

Warm paper (`#f7f5f1`), ink (`#1c2428`) and a controlled petrol accent (`#286975`). Dark appearance uses a separately chosen deep neutral (`#141a1d`), warm raised surfaces and a muted light petrol accent (`#7ebbc1`). Use the iOS system font stack, large aligned numbers and short labels. Colour indicates actions, selection and recorded progress.

Use open composition instead of a card grid. Sections are separated by whitespace, type scale and hairlines. Grouped surfaces represent actual collections or controls. Buttons, forms, sheets, chart labels and list rows share semantic tokens. Component styles must also work in portals outside the app shell.

## Screen map

- **Today:** native large title and date, open workout title and purpose, one primary action, a compact real progress strip and the next volleyball event. Day selection lives in a sheet.
- **Train:** a brief session overview before starting; during training, one exercise stage with prominent weight and reps, previous performance, set position and a clear completion action. Complex pairs remain connected. Technique, effort, editing and the full movement list appear on demand.
- **Week:** compact day timeline, with session purpose and contextual editing. Programme controls and plan tools are disclosed together.
- **Exercises:** searchable native list, quick filters, concise rows and an in-place detail sheet. Adding or replacing requires an explicit confirmation. Browsing from More does not change a workout.
- **Progress:** real, comparable metrics and one selectable chart at a time. Height and absolute highest touch remain separate. Check-ins, history and weekly reports are available as list actions.
- **Nutrition:** calories remaining first; protein, carbs and fat form a quiet aligned ledger. Meals use a simple indexed list. Calculations, weight, saved foods and meal guidance remain accessible below or in sheets.
- **More:** grouped lists for training, performance, routine and data tools, rather than another dashboard.

## Interaction system

The integrated tab bar spans the phone and reserves home-indicator space. Sheets have a drag-handle visual, a pinned 44-point close action and a single independent scrolling body. Keep input text at least 16 pixels and controls at least 44 points. Respect visible-viewport changes when the keyboard opens. Enter dismisses a workout field without silently completing a set. Motion is short, restrained and respects reduced-motion preferences.

## Compatibility

The reset does not change the `setline.gym.v1` key or stored schema. History, set identifiers, decimals, nutrition, jumps, imports, programme choices, routines, appearance and backups continue through the existing domain and storage paths. Keep the manifest identity, start URL, cache strategy and offline support. Only brand colours and presentation assets change.

## Verification

Run the complete unit and browser suites plus the production build. Browser coverage includes 320 × 568, 390 × 844 and 430 × 932 viewports in light and dark mode; simulated safe areas; real touch hit-testing; keyboard behaviour; library browsing and confirmation; chart separation; persistence; and all existing product flows. The release report records actual results rather than assuming a pass from this document.
