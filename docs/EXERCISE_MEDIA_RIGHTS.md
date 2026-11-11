# Exercise media: sources, permissions and release decisions

Reviewed **11 November 2026** using the supplied BODYCRAFT PDF and the official
sources linked below. A source being readable or downloadable is not a grant to
redistribute its photographs in Setline or a public Git repository. This is an
implementation evidence record, not a legal compliance certification.

## Release decision

No BODYCRAFT, ACE or MuscleWiki photograph has an established redistribution
grant for this Setline release. Do not publish extracted PDF pages, crops,
thumbnails or downloaded vendor media. The application can ship its optional
media infrastructure, exact-ID mappings, original direction schematics and
external demonstration searches while those photographs remain unavailable.

License approval and movement verification are separate checks. Even a legally
reusable photograph must show the correct equipment, stance, support, release
direction and prescribed variation before it is enabled. A machine photograph
does not identify the user's own machine or make its strength results comparable.

Four lossless WebP frames from the original Everkinetic collection have now been
added for two individually reviewed exercise IDs. They are illustrations, not
photos. Their exact source, permission and exclusions are recorded below. The
final enabled-asset count belongs to `src/exercise-media.ts` and the release
report; the other candidates remain research leads.

## Requested vendors

| Source | What was actually checked | Permission established for Setline? | Release treatment |
| --- | --- | --- | --- |
| Uploaded 65-page BODYCRAFT Exercise Guide; [official support page](https://www.bodycraft.com/support-page/) and [exercise guide archive](https://www.bodycraft.com/document-type/exercise-guides/) | The PDF is accessible and is inventoried separately. Official pages provide manuals/guides and display an all-rights-reserved notice; no public redistribution license or Setline-specific written grant was found. | **No.** Providing a PDF for inspection does not establish the right to republish its photos. | Metadata mapping only. Extracted inspection material stays outside tracked/public files. Obtain a written grant covering the exact photos, public web/PWA delivery, repository distribution, resizing and attribution before enabling any. |
| [ACE Exercise Library](https://www.acefitness.org/resources/everyone/exercise-library/) and [ACE Terms of Use](https://www.acefitness.org/legal/terms-of-use/) | The library provides movement descriptions and photos. Terms §1 limit the general access/display license to personal use and require prior written consent for commercial reproduction. Terms §5 do not grant implied copyright rights. | **No.** No ACE permission agreement for this application was supplied or obtained. | Keep educational reference links; do not copy, frame or hotlink the photo collection as app media. ACE has advertised [content licensing](https://contentcdn.eacefitness.com/assetportfoliodownloads/ACEFit_ContentResourceLicensing.pdf), but that brochure is a licensing route, not an executed grant. |
| [MuscleWiki API](https://api.musclewiki.com/), [API Terms](https://api.musclewiki.com/api-terms) and [official FAQ](https://api.musclewiki.com/faq) | Paid plans include commercial API use. The terms, updated 8 October 2026, govern media separately: no bulk export, rehosting or permanent media storage. The FAQ distinguishes client thumbnail caching from shared/CDN caching and explains required credit. | **No subscription or agreement for Setline is established.** A commercial API plan would still not permit copying its media into this public repository under the standard terms. | Do not scrape the public site, buy a plan, provision a key, copy API media or add a fake integration. A future licensed streaming integration needs a secure credential boundary, the provider's cache rules and a separate implementation review. |

For MuscleWiki, the inspected terms allow text metadata caching for up to 30
days, thumbnail caching for up to 24 hours and only transient video buffering;
the FAQ specifies private client thumbnail caching and no shared edge retention.
It requires the provider's prescribed legal-document credit and intact video
branding. Permanent offline media packs and repository image files are a
different use from licensed API playback. No service was purchased or contacted.

The ACE licensing brochure was opened as a 12-page PDF. Its existence establishes
an inquiry route, not the current price, availability or terms of an agreement.
Its images are not release assets.

## Open or public-domain candidates investigated

These sources offer a more suitable route for redistributable media than copying
the requested vendor photos. Availability of a license does not establish that
an asset has passed Setline's exact-movement visual review.

| Candidate | Rights evidence | Matching and verification status | Added by this rights research? |
| --- | --- | --- | --- |
| CDC PHIL [14128](https://wwwn.cdc.gov/phil/Details.aspx?pid=14128), seated machine leg extension, flexed starting position; companion [14127](https://wwwn.cdc.gov/phil/Details.aspx?pid=14127), extended position | The item identifies CDC / Amanda Mills (2011), says permission is not required for its public-domain image, and permits redistribution with attribution and identification of CDC as the free source. [CDC agency material conditions](https://www.cdc.gov/other/agencymaterials.html) also require prominent nonendorsement wording and preservation of substantive content. | Candidate for the generic seated **Leg Extension** only, not every knee-extension variation. The description identifies a Pulse machine, not the user's equipment. The binary image fetch was blocked by the environment's CONNECT 403 policy; the text-search tool did not expose viewable pixels. **No visual approval has been claimed.** | **No.** Candidate and rights evidence only. |
| [Everkinetic original repository](https://github.com/everkinetic/data) | The official project identifies Greg Priday / Everkinetic and publishes a CC BY-SA 4.0 license. The source license and selected files were retrieved from pinned commit `446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6`. | The four selected start/finish illustrations were actually inspected: seated machine leg extension and seated machine calf raise. Full athlete and essential equipment remain visible. Other source images are not automatically approved. | **Yes: four WebP frames for two exercise IDs.** See the selected-asset record below. |
| [Workout Guide asset license](https://github.com/bryllim/workout-guide/blob/main/LICENSE-ASSETS) and [attribution](https://github.com/bryllim/workout-guide/blob/main/ATTRIBUTION.md) | The publisher explicitly permits commercial sharing/adaptation under CC BY-SA 4.0 and identifies Everkinetic-derived poses separately from code licensing. | Candidate illustrations must be inspected for the exact variant. A repository's MIT code license is not the artwork license. | **No.** No package dependency or bulk asset import was added by this research. |
| Wikimedia Commons [Romanian-deadlift-1.png](https://commons.wikimedia.org/wiki/File:Romanian-deadlift-1.png) | File page credits Everkinetic and identifies CC BY-SA 3.0. | Illustration candidate for a barbell hip hinge. The name alone does not establish its knee position/range matches Setline's RDL. Binary pixels were not independently inspected here; not approved. | **No.** |
| Wikimedia Commons [Leg-extensions-1-672x1024.png](https://commons.wikimedia.org/wiki/File:Leg-extensions-1-672x1024.png) | File page credits Everkinetic and identifies CC BY-SA 3.0. | Candidate illustration for a seated machine leg extension; exact apparatus and visible body/equipment coverage still need review. Not approved. | **No.** |
| Wikimedia Commons [Back Pull down.jpg](https://commons.wikimedia.org/wiki/File:Back_Pull_down.jpg) | File page identifies Aliva Sahoo's own photograph, dated 15 December 2025, and CC BY-SA 4.0. | Candidate for a front lat pulldown only after inspecting grip, bar path and apparatus. A Commons caption is not a technical review or proof of a model release. Not approved. | **No.** |

The [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) summaries permit
commercial sharing/adaptation subject to their conditions. Preserve the correct
version per asset, creator/title/source credit, license link, notices and a
record of changes. Adapted media must retain the required share-alike license;
do not present the application's general code license as replacing it. The
licenses also identify limits concerning publicity, privacy and similar rights.
Their availability is not a promise that a candidate is suitable for every use.

## Selected licensed illustrations actually added

| Stable Setline ID | Exact illustrated variation | Original images | Local files |
| --- | --- | --- | --- |
| `leg-extension` | Supported seated machine leg extension, flexed start then knee extension with shin roller | Everkinetic `0142-relaxation` / `0142-tension` | `leg-extension-start.webp`, `leg-extension-extended.webp` |
| `seated-calf-raise` | Seated **machine** calf raise with bent knees, thigh restraint and lowered/raised heels | Everkinetic `0279-relaxation` / `0279-tension` | `seated-calf-raise-lowered.webp`, `seated-calf-raise-raised.webp` |

Files are in `public/exercise-media/licensed/everkinetic/`, together with the
full upstream CC BY-SA 4.0 license, attribution/readme and a per-file source/hash
manifest. They total 122,426 image bytes. Conversion to WebP is lossless and
decoded-pixel equality was checked against each original PNG; dimensions and
poses were not changed or cropped. The converted assets retain CC BY-SA 4.0.
The illustrations do not assert the user's machine brand, load or recorded
performance. The seated-calf image must be labeled as a machine example, not a
dumbbell variation.

Review rejected cropped original RDL and biceps-curl images because the feet or
bar were missing from the source frame. The lateral-raise pair was excluded
after a second reviewer identified an incomplete foot in the original artwork.
A newer Workout Guide RDL candidate
showed a substantially different knee/torso configuration and was also excluded.
Its available license did not override the need for an accurate illustration.
No BODYCRAFT, ACE, MuscleWiki or CDC photograph was added.

## Original and commissioned media

Setline's original overhead-slam, forward-throw and drop-jump direction schematics
can be represented as approved **illustrations**, with their original source,
license statement and exact supported variation recorded. They must not be
reported as imported BODYCRAFT photos, complete anatomical models or verified
videos. Do not assign a forward-throw image to the downward slam.

For remaining exercises, an independently photographed or commissioned set can
provide the exact required support, equipment and camera angles. Keep an asset
record containing the photographer's identity, written commercial web/PWA and
repository redistribution rights, permitted transformations, required credits,
applicable model/location releases and review date. A commissioning payment by
itself should not be treated as an unlimited copyright transfer. No photograph
has been commissioned or photographer/model contacted during this task.

## Approval record required before publication

For each enabled asset, retain:

1. Stable Setline exercise ID and exact demonstrated variation.
2. Original source URL or internal creation record, creator and source date.
3. Explicit license or written permission reference, scope and any expiry.
4. Required in-app attribution, license link and transformation notes.
5. Useful alternative text and a visual review of the full athlete/equipment.
6. Distinct license-approval and movement-verification states.
7. Optimized local asset path, intrinsic dimensions and any additional frames.

Use `object-fit: contain` rather than cropping away hands, feet, machine contact
points or movement direction. Unapproved, unverified or unavailable media should
leave the accurate written guide usable. Avoid adding unknown remote photo URLs
to the workout path or pre-caching a large unreviewed collection.

The full source-to-exercise inventory and every currently missing image are in
[BODYCRAFT_PDF_INVENTORY.md](BODYCRAFT_PDF_INVENTORY.md) and
[EXERCISE_PHOTO_MAPPING.md](EXERCISE_PHOTO_MAPPING.md). A candidate page in those
documents is not proof that an image is installed.

## Search links and verification limits

Opening an encoded Google or YouTube search is an external navigation action,
not a media import and not a license to copy the search results. It requires no
Google API key. Preserve a verified direct YouTube URL when one exists; label
general searches honestly rather than presenting a result as a reviewed video.

No vendor was emailed, no account or paid subscription was created, no API key
was requested and no Google/third-party photo scrape was performed. Only the
selected licensed illustrations were downloaded for publication; the official
pages above were read as public documentation. This review does not assert that
every candidate photo was visually inspected. Public terms can change, so review
the exact grant again before a future licensed-media release.
