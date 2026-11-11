# Exercise media, demonstrations and iPad experience

Baseline: Setline V18 / Volleyball Performance Plan V9, main `4d1652a`.
This is an adaptive presentation and optional-content update. Exercise IDs,
training prescriptions, history, settings, local storage and backup schemas
are retained. No data migration or new dependency is needed.

## Media actually delivered

**Zero third-party photographs were imported.** The supplied 65-page BODYCRAFT
guide was accessible and inspected in full. It contains 54 named exercise plates
(the introduction separately claims 52 exercises). Sixteen current Setline IDs
have conditional candidate plates; 165 have no compatible plate. Downloadable
vendor content does not establish a redistribution grant.

The enabled image registry has **seven files across five exercise IDs**:

| Movement | Images | Rights |
| --- | --- | --- |
| Two-Hand Medicine Ball Overhead Slam | One original directional SVG | Setline original |
| Medicine Ball Overhead Forward Throw | One separate original directional SVG | Setline original |
| Drop Jump | One original sequence SVG | Setline original |
| Leg Extension | Two lossless WebP start/end illustrations | Everkinetic / Greg Priday, CC BY-SA 4.0 |
| Seated Calf Raise | Two lossless WebP start/end illustrations | Everkinetic / Greg Priday, CC BY-SA 4.0 |

All are illustrations/schematics, not photographs. Machine examples do not claim
to show the user's actual equipment. No BODYCRAFT, ACE, MuscleWiki or Google
photograph was copied. The four licensed files total 122,426 bytes; their source
commit, individual URLs, original dimensions, output hashes and full license
accompany them. Attribution and source/license links also appear in the guide.
Original drawings remain available as inline technique diagrams offline.

**176 exercise IDs still have no approved image; all 181 lack an approved
photograph.** Every exercise has a row with exact name/ID, required equipment,
camera brief, candidate source route, rights status and actual added-media status:

- [Complete missing-image register](EXERCISE_PHOTO_MAPPING.md)
- [Machine-readable 181-ID register](EXERCISE_PHOTO_MAPPING.json)
- [Complete physical-PDF page inventory](BODYCRAFT_PDF_INVENTORY.md)
- [Source and permission decisions](EXERCISE_MEDIA_RIGHTS.md)
- [Licensed asset notice](../public/exercise-media/licensed/everkinetic/README.md)

The registry requires commercial-use and redistribution approval, attribution,
evidence, exact-variation review and meaningful alt text before displaying an
asset. Retained IDs on unrelated custom names do not attach an old picture.
Incorrect/cropped source candidates were rejected instead of filling gaps.

## Demonstration actions

Every exercise guide exposes separate **Search Google** and **YouTube
Demonstration** links. Google uses canonical variation metadata, safe encoding
and a normal external link; no Google API key or scraping is involved. Slams
search for downward floor release, forward throws remain forward, supported
rows retain the chest-pad distinction, and landmine stances remain separate.

Existing YouTube URLs are preserved. The helper retains an assigned verified
direct URL when supplied; otherwise it keeps the existing search fallback.
Ambiguous/custom names are identified as unconfirmed, with a research query
rather than invented variant verification. Search results are explicitly
unreviewed. Both links have external indicators and safe new-window attributes.

## Adaptive workspaces

Layout follows window width, with no iPad user-agent detection or duplicated
application state:

- Below 768px, the established phone layout and bottom navigation remain.
- At 768–1023px, a bounded, spacious single column retains bottom navigation;
  the exercise library uses a two-column catalogue where space permits.
- At 1024px and wider, the same four tabs become a keyboard-accessible sidebar.
  Today separates its session/full reference list from actual progress,
  consistency and one insight. Train puts the calendar/session/list beside the
  selected exercise's saved prescription, previous performance and guide.
- Active Focus/Quick Log retain one session. A persistent exercise navigator is
  enabled only when the window and actual content container can fit both panes.
  Invalid local weight drafts remain mounted until corrected. Rest occupies
  a reserved band instead of covering the logger; keyboard scrolling targets
  the real scroll container.
- The library uses a responsive grid plus adjacent detail pane on wide windows;
  query, filters and selection survive narrowing. Equipment/muscle filters and
  explicit Add/Replace confirmation remain available.
- Progress keeps one readable main chart/selector beside truthful supporting
  metrics. Settings keeps the same mounted forms beside its group list;
  unsaved values and original save behavior are retained.

The application and training-plan versions remain V18 and V9. Medical guidance
and the existing pre-workout check are unchanged by the layout choice.

## Loading and offline behavior

Images use independent static files, `loading="lazy"`, asynchronous decoding and
`object-fit: contain`; no large PDF screenshots or full image library enters the
initial JavaScript bundle. Unavailable images disappear into a concise text
fallback. Missing images leave the precise written instructions fully usable.

The PWA still precaches its 26 shell files. Optional media is excluded from
installation and cached only after use: known same-origin image files no larger
than 256,000 bytes, capped at 24 entries (at most about 6.2 MB). Cache denial/quota
failure does not prevent an online image response or training. An uncached image
may remain unavailable offline; recorded workouts and the shell remain separate.
No third-party media is automatically requested during logging.

## Screenshots and verification

All screenshots use isolated synthetic localhost fixtures, **not the owner's
actual measurements or history**. They are Chromium window emulation, not
physical iPhone/iPad testing. The screenshot tool records its built HTML hash.
Baseline phone captures were made before source/build changes.

[iPhone Today before](screenshots/exercise-ipad/iphone-today-before.png) ·
[after](screenshots/exercise-ipad/iphone-today-after.png) ·
[iPhone Focus before](screenshots/exercise-ipad/iphone-focus-before.png) ·
[after](screenshots/exercise-ipad/iphone-focus-after.png)

[iPad portrait Progress](screenshots/exercise-ipad/ipad-portrait-progress.png) ·
[portrait library](screenshots/exercise-ipad/ipad-portrait-library.png) ·
[landscape Train](screenshots/exercise-ipad/ipad-landscape-train.png) ·
[landscape library/detail](screenshots/exercise-ipad/ipad-landscape-library.png) ·
[landscape Settings](screenshots/exercise-ipad/ipad-landscape-settings.png)

The complete local capture sets cover 38 before and 129 after states, light/dark,
375×812, 390×844, 430×932, 768×1024, 820×1180, 1024×768, 1194×834,
1366×1024, 700×900 and 540×900, plus enlarged text. A stable settings frame was
recaptured after detecting an unfinished sheet transition. Of 32 non-guide
phone comparisons, 30 are pixel-identical and two differ by at most 55 edge
pixels; six guide comparisons intentionally change with images/new actions.
No captured document has horizontal overflow.

Reproduce with `node --experimental-strip-types scripts/capture-exercise-ipad.mjs
before` or `after`, while serving the appropriate production bundle on localhost.
The script accepts no remote origin or personal store.

Final test results belong in [VALIDATION.md](../VALIDATION.md). Physical Safari,
Stage Manager gestures, native on-screen keyboards, VoiceOver, Dynamic Type and
locked-screen audio require actual-device verification. Production status must
be checked against the merged SHA; a successful local build or preview alone
does not establish a production deployment.
