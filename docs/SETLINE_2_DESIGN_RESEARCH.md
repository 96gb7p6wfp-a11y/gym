# Setline 2.0 — native interaction audit

## Research access

The design brief requests Apple's current Human Interface Guidelines. The following official pages were attempted through the managed environment's configured network path during the initial research pass:

- https://developer.apple.com/design/human-interface-guidelines/
- https://developer.apple.com/design/human-interface-guidelines/tab-bars
- https://developer.apple.com/design/human-interface-guidelines/sheets
- https://developer.apple.com/design/human-interface-guidelines/typography
- https://developer.apple.com/design/human-interface-guidelines/layout

Each request was rejected with a proxy CONNECT 403. These pages were therefore **not read live**. The implementation applies established iOS interaction principles and the user's explicit requirements; it does not claim verified compliance with the latest online wording. No network restriction was bypassed.

## Existing presentation audit

The previous screen system used layered themes, prominent session containers, stacked metric panels, numerous rounded sections and desktop-style expanded guidance. Today exposed a full week selector alongside the main workout. Progress displayed multiple visualisations and separate controls at once. Exercise selection performed mutations immediately, while detailed guidance expanded within long pages. The top-level bottom navigation and repeated session controls competed with the workout itself.

Useful functionality was distributed across Train, Progress, Nutrition and More. The reset keeps those capabilities but gives each primary screen one job. History and reports stay within Progress; weekly configuration, library browsing, routines and data tools are grouped under More. Detailed editing is contextual.

## Native patterns applied

- Large system-font titles and compact date context.
- Full-width integrated five-tab navigation with persistent selection and keyboard focus.
- Open exercise stages and indexed movement lists instead of nested cards.
- Bottom sheets with pinned dismissal, a single scroll region and safe-area constraints.
- Search-first library with secondary filters and explicit add/replace confirmation.
- Grouped secondary lists and short disclosure rows.
- Large current values, previous performance nearby and restrained stepper controls.
- One progress chart at a time, avoiding incomparable measurements.
- Independent dark tokens for surfaces, text, dividers and portals.
- Reduced motion, visible keyboard focus and minimum touch targets.

## Safety-sensitive UI retained

The old theme layers also contained important behaviour-related styling. Replacing them requires retaining the visible-viewport dialog geometry, scroll containment, decimal input feedback, stacked small-phone set controls, pinned close buttons, dropdown scrolling, touch hit areas and readable portal colours. These are verified as functional requirements, not decorative choices.

The interface must never invent recovery quality, records, strength percentages or charts. Display only metrics supported by the recorded data; keep empty states useful and quiet.
