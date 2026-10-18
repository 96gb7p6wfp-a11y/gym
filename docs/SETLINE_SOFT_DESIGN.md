# Setline Soft

## Reference interpretation

The user’s five screenshots supersede the previous journal direction. They request
Apple-like rounded, smooth interactions, Morandi colors with watercolor wash tones,
a monochromatic strategy, layered cards and approachable luxury.

The references inform these patterns:

- One clear exercise action and large values during training.
- Circular step controls and pill completion actions.
- Rounded grouped records, compact secondary information and quiet navigation.
- Technique and muscle information inside a dedicated detail sheet.
- Consistent imagery rather than a mixture of unrelated stock photographs.

No third-party branding, photographs or layouts are copied. A small original SVG
muscle schematic uses the catalogue’s existing broad muscle-group labels. It is
secondary inside About this exercise and explicitly identified as schematic.

## System

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#f1f4ef` | `#171d1a` |
| Surface | `#ffffff` | `#232c27` |
| Secondary surface | `#e9eee7` | `#2c3730` |
| Raised surface | `#f8faf6` | `#313f35` |
| Wash | `#dce6db` | `#304137` |
| Primary text | `#24322b` | `#edf2e9` |
| Supporting text | `#58675e` | `#b5c2b8` |
| Accent | `#476159` | `#bbcec0` |
| Text on accent | `#ffffff` | `#21332a` |
| Divider | `#d9e0d7` | `#3d4c42` |

Use the system sans font for controls and `ui-rounded` with system fallbacks for
headings and key numbers. No remote font is required. Page titles are 30–32px,
session names 28–36px, row names 15–18px, supporting text 12–14px. Numbers are
tabular. High-level labels can be small; primary instructions and inputs stay large.

Card radii are 24–30px; actions/segmented controls use full pill ends. Increment
controls are circles with at least 44px hit areas. A restrained surface shadow adds
separation; the background and Today card use subtle wash tones. Glass treatment
is limited to navigation and modal separation. Do not add unrelated colored badges.

## Screen hierarchy

- **Today:** a large native title/date, one soft session card with purpose and Start,
  real weekly gym progress and a small next-event/Fuel group.
- **Train:** compact week selection, one session overview, contextual workout tools.
  Active training centers the exercise name and one working-set card. Previous
  performance, decimal entry, circular steppers and completion stay fast.
- **Progress:** a pill lens selector and one measured chart card. Other records are
  grouped below. Empty states invite a real entry and never invent measurements.
- **Nutrition:** remaining intake and protein in a layered card, rounded meal rows
  and a clear Log meal action. Settings/calculation tools remain secondary.
- **You:** grouped utility cards for the complete existing feature set.
- **Library/details:** search first, pill filters, rounded rows, numbered technique
  cues, on-demand alternatives and a consistent broad muscle schematic.
- **Plan/history/routine/settings:** the same surfaces and controls; no legacy
  hardcoded white containers with inherited dark-mode text.

Four primary destinations remain Today / Train / Progress / You. Nutrition remains
one tap from Today’s Fuel row or You. The nav itself is an inset rounded capsule,
14px clear of horizontal edges and 12px above the bottom safe area. Rest and meal
logging actions sit above it rather than covering it.

## Product and implementation constraints

This release changes presentation only. Storage key `setline.gym.v1`, schemas,
version handling, workout mutations, training prescriptions, progression rules,
backups and installation identity remain unchanged. No migration is required.

Preserve decimal-dot/comma entry, complex-pair sequencing, set timers, explicit
completion, custom workouts, plan editing, imported activity records, nutrition,
routines, offline use and all existing data tools. Height/touch protocols and
measured versus estimated progress remain distinct.

Touch, keyboard and scrolling behavior are verified in production browser tests.
Visual review includes 320/390/430px portrait, landscape and desktop in both themes.
Shared sheets keep one transform and one scroll body with a fixed Close control.
Respect reduced motion and avoid animations that delay set logging.
