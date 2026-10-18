# Setline visual reinvention — research and concept

Research performed 2026-10-18 through the configured HTTP proxy. These are public official product pages and marketing screenshots, not a hands-on review of paid native applications. No third-party branding/assets should be copied into Setline.

## Evidence inspected

- Apple Health: https://www.apple.com/ios/health/ — HTTP 200, official page text inspected. Relevant principle: connect an understandable day-to-day view with longer-term trends; keep sensitive data under user control; make interpretation depend on actual measurements. This is a marketing page, not direct HIG inspection.
- Apple Fitness+: https://www.apple.com/apple-fitness-plus/ — HTTP 200, text and official Custom Plans screenshot visually inspected. Screenshot: https://www.apple.com/v/apple-fitness-plus/ac/images/overview/custom_plans__c1z28bmt5ziq_large.jpg . Pattern: a small number of clear destinations, an immediate session/plan identity, and a direct preview/action. Do not copy its colorful promotional surfaces into Setline.
- Hevy: https://www.hevyapp.com/ — HTTP 200, page text and workout/progress screenshots visually inspected. Workout: https://www.hevyapp.com/wp-content/uploads/image-2-768x785.png . Progress: https://www.hevyapp.com/wp-content/uploads/image-4-1-768x785.png . Pattern: previous performance adjacent to current set values; automatic rest timer; explicit Add Set/Add Exercise; progress chart scoped to one exercise and one metric. Avoid reproducing the full dense ledger in a workout focus view or the large PR trophy.
- Strong: https://www.strong.app/ — HTTP 200, public page text inspected. Product positioning explicitly emphasizes a notebook that stays out of the user's way, accessible export, supersets, custom timers, and full features without front-loading them. Its screenshot CDN was denied, so no visual screenshot-review claim is supported.
- Fitbod: https://fitbod.me/ — HTTP 200, official text and Smart Tracking graphic visually inspected. Graphic: https://fitbod.me/wp-content/uploads/2024/12/Smart-tracking-hero.png . Pattern: clearly label estimated strength, show a simple trend, make recommendations conditional on history/recovery/equipment. Do not adopt its algorithm claims or imply Setline has sensor-based recovery.

## Unavailable sources

The configured network proxy explicitly denied these with HTTP tunnel 403; no bypass was attempted:

- https://gentler.app/
- https://www.whoop.com/
- https://ouraring.com/
- https://developer.apple.com/design/human-interface-guidelines/
- Strong screenshot CDN: https://cdn.prod.website-files.com/60656f5fc7baf6df6e77b7dd/607fcd328d1fce70f961eed9_iPhone%20-%20Template%20(No%20Shadow).png

Do not say these products were live-inspected or the HIG was read this session. General established iOS interaction principles can still inform the implementation, with honest scope.

## Three structural directions

### 1. Athlete's Journal — selected

Compact Setline masthead. Dated journal heading. Centered, inset-free session identity in proper case with one purpose line. A fine ruled baseline aligns duration and exercise count. One full-width Start action in the lower thumb zone. Next event is a plain agenda row. No status grid, week cards, decorative image, gauge, or fabricated recovery number.

Four primary destinations: Today, Train, Progress, You. Nutrition remains one tap from Today's Fuel row and the first group under You. Secondary features use real native-feeling grouped navigation and consistent back behavior.

Train: a compact exercise chapter header, simple set ticks, current weight/reps as generous number rails, previous set on one muted line, one completion dock. Complex pairs retain automatic ordering. Rest uses the dock's secondary context. Exercise changes reveal through Edit or one contextual menu; no options wall.

Progress: one metric lens, one large value/change, one meaningful chart. Other tracked metrics are quiet rows; History and weekly reports are contextual destinations. No invented changes if data is missing.

Nutrition: one remaining-calories statement, protein priority, understated carb/fat rows, chronological meals, clear Log Meal action.

You: native grouped list for plan/library/history/routine/settings/data tools.

System sans for body/controls and tabular performance values. Restrained system-serif identity for page and session titles, never for workout inputs. Ivory/graphite with one muted oxblood accent. A 24px mobile inset (20px on small phones), an intentional 4/8/12/18/24/32/48/64px rhythm, fine rules, and no card grid. Final implementation specifications are in SETLINE_REINVENTION_DESIGN.md. Dark mode independently uses neutral graphite and elevated charcoal, with sufficient text contrast and lighter controlled accent.

Chosen for strongest first impression, hierarchy, distinct identity, native comfort and workout efficiency without adding UI.

### 2. Courtline Agenda

A large date rail on the left and chronological day activities on the right. Three destinations: Today, Progress, You. Start opens a dedicated fullscreen session route; there is no separate Train tab. Compact chronology integrates gym/volleyball/runs naturally. During training, one set occupies the full focus canvas, with next exercise context below.

Rejected because the schedule can dominate the first impression and make the primary gym session less obvious. More complex to keep simultaneous activities visually calm.

### 3. Precision Bench

Train is the first destination. Four destinations: Train, Trends, Fuel, Plan; profile lives in the header. A compact purpose-led session recipe opens a per-exercise set ledger with current/previous rows and a fixed completion rail. Progress uses minimal measured comparisons and one chart.

Rejected because its technical type/ledger identity risks feeling like an instrument dashboard and may repeat too much of the existing fitness-tracker language, despite strong speed for experienced lifters.

## Decision constraints

- Maintain the current recommended schedule, readiness rules and stored schema.
- No decorative statistics; all numerical change requires logged evidence.
- Keep frequent actions one tap away.
- Every screen must have a single clear job and main action.
- Review real rendered small/standard/large iPhone screenshots in both themes, expanded lists, sheets, editing states and active logging. Automated tests alone cannot establish visual quality.
