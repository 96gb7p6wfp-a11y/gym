# Setline — native experience release candidate

This branch starts at main `693265cc96c00f198700c43634bdba8e001d3366`
(Setline V18, Volleyball Performance Plan V9). It incorporates PR #12
`8e5f30d` and PR #13 `98824e2` locally, without changing either source
branch or merging main. PR #11's earlier readiness intent is superseded by
#12's explicit original / lighter / recovery / rest decisions.

## Implementation checklist

- [x] Inspect all PR #12 changed paths and both previously failing assertions.
- [x] Retain immediate valid-edit persistence and immutable completion targets.
- [x] Confirm completion/Undo only after the primary write succeeds.
- [x] Resolve pre-V9 dates against their archived program, using current medical guidance.
- [x] Cache only exactly validated local bytes; reject intervening writes before commit.
- [x] Separate saving a reusable template from starting a one-off session.
- [x] Direct Add in search results; optional technique detail remains accessible.
- [x] Keep RIR secondary; preserve load/rep controls and shared Focus / Quick Log records.
- [x] Accumulate rest adjustments against the latest absolute deadline.
- [x] Cache-first installed launch, bounded missing-shell fallback, atomic essential chunks.
- [x] Avoid repeated historical/progression calculations while editing active inputs.
- [x] Defer unopened screens, including optional tablet-only Today preview on phones.
- [ ] Complete final clean validation and controlled before/after measurements.
- [ ] Inspect final representative screenshots and publish the isolated review PR.

## What changed

### Recording and recovery

Completion and Undo now use the same validated, versioned local client as other
workout writes, with a synchronous success boundary. A rejected quota/conflict
write cannot advance the exercise, consume an intent, create an Undo receipt or
start another rest timer. Edited drafts remain retryable. PR #12's verified start
and finish, interrupted-session restoration, explicit recovery decisions and
manual-input precedence are retained.

Quick Log keeps a stable one-action completion control for each valid pending
row. Focus retains deliberate Ready/selection after automatic advancement (or
arming by a manual edit). This protection against repeated taps is not replaced
by an arbitrary debounce; the extra selection remains an explicit UX tradeoff.

Repeated rest adjustments use the current deadline ref, so ten separate +15-second
requests add 150 seconds instead of competing with a captured render value.
Skip clears the owned timer. Absolute deadlines and current sound settings remain.

### Fewer creation steps

Train exposes **Saved workouts** and **Create workout** directly. Search results
have a direct **Add** action; **Details** remains optional. Recorded recent
exercises are available without manufacturing history or guessing custom IDs.
A fine pointer/physical-keyboard presentation focuses search, while touch phones
do not force the keyboard to appear unexpectedly.

The builder distinguishes **Save template** from **Start workout now**, retaining
order, sets, target, load, RIR/RPE, rest and replacement controls. A template save
changes the template collection, not weekly/match prescriptions. Starting a saved
or one-off workout uses transient preparation with mandatory medical guidance;
it does not overwrite an intentional date draft or recurring plan. Cancelling
one-off preparation returns the uncommitted builder draft.

### Less repeated work

The storage client still checks actual primary bytes on each request, but unchanged
validated records are not parsed and schema-validated again for every keystroke.
It publishes its cache only after a successful primary write. A precommit exact-byte
check rejects a detected intervening save. This narrows races; localStorage does
not provide an atomic multi-renderer compare-and-swap transaction.

An immutable completed-history projection stabilizes historical inputs when only
an active workout changes. A bounded comparable-performance index and memoized
existing progression engine avoid scanning all recorded sets while typing.
Strength-chart-only derivations run when Strength history opens. Unopened sheets,
program configuration, guide bodies and advanced charts are separate chunks.
Essential Focus/Quick Log controls and the lightweight Progress overview remain
ready with the app: measured Suspense delays on primary tabs were a reason to
keep those surfaces eager. Guide content and exercise picking load only when
requested.
Every essential chunk remains in the atomic installed shell, so code splitting
does not make offline routes depend on the network.

### Offline and touch surfaces

Installed navigations serve their verified shell before requesting the network.
A failed new installation retains the old verified generation. Cache denial falls
back to an available online resource; an uncached hanging document has a bounded
network fallback. Update activation remains explicit and cannot reload an active
workout automatically. Optional exercise media stays independently bounded and
cannot block training. Phone tabs use a stable opaque surface; short-height Focus
spacing preserves ordinary controls without a fixed overlay covering the inputs.

## Compatibility

No primary schema/key, exercise ID, plan prescription, weight unit, production
origin, portable backup format, dependency or IndexedDB migration is introduced.
The existing primary key is `setline.gym.v1`, schema 1 / backup 1. PR #12's small
auxiliary continuity record references the authoritative session, restore
generation and owned controls; it is not another workout store or cloud backup.
V9 schedules, medical flags, legacy history, custom plans, nutrition, performance
records and backup/restore remain in the existing model.

Only synthetic localhost fixtures are used. Neither these tests nor a code merge
can read or restore the user's private iPhone local storage.

## Evidence and limitations

- [File-by-file release and storage audit](NATIVE_RELEASE_AUDIT.md)
- [Controlled benchmark methods and results](NATIVE_BENCHMARKS.md)
- Final check counts and screenshot index are appended after the frozen run.

Known architectural limits: whole-store JSON serialization and synchronous
localStorage remain; keeping a validated view trades memory for less validation.
The exact-byte fence is not a replacement for a transactional backend. There is
no cloud synchronization and no guarantee that an exported file was preserved
externally.

Browser emulation does not establish real Safari keyboard behavior, VoiceOver,
Dynamic Type, OS storage eviction, PWA suspension, audio while locked or native
haptics. An installed iOS web app can support Web Push when a genuine push service
and permission flow exist; Setline has no configured push backend. This release
does not promise a locally scheduled lock-screen alarm or add a native wrapper.

## Physical iPhone release checklist

1. On the existing domain, export a backup and confirm the file exists externally.
2. Keep an active workout, change a decimal load, switch apps, reopen and verify it.
3. Complete, Undo and recomplete one set; confirm the next set stays pending.
4. Adjust rest ±15, refresh, background/lock, then inspect recovered remaining time;
   separately record which foreground/locked audio behavior the device supports.
5. In Focus and Quick Log, check keyboard, thumb reach, safe areas and large text.
6. Verify a custom template, V9 Saturday/match Sunday, guidance and nutrition remain.
7. Once the shell is installed online, airplane-mode cold-open all four tabs,
   record/edit/Undo/finish a workout, reopen, then reconnect and verify history.
8. Check pending-update activation is offered without reloading the active workout.

Cloud sync, native Live Activities/Watch integration, social features, generative
coaching and an unverified IndexedDB migration are intentionally deferred.

No production merge or deployment is authorized in this task. Release requires
review of the isolated PR, clean checks, a verified backup and the device checks
above; then a separate explicit merge/deployment authorization.

## Interaction references checked

- [Apple buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
  and [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility):
  clear action hierarchy, usable hit regions and reduced-motion support.
- [Strong rest timer](https://help.strongapp.io/article/231-rest-timer), read on
  17 November 2026 (the page identifies its own update as February 2021): automatic
  per-exercise rest, optional expanded controls, manual adjustment and Skip.
- [Hevy](https://www.hevyapp.com/): contextual previous performance, routine planning
  and compact workout logging. Existing product-reference detail is retained in
  [the earlier benchmark notes](PREMIUM_BENCHMARKS.md).
- [Alpha Progression's published comparison](https://alphaprogression.com/en/blog/alpha-progression-vs-hevy):
  optional effort tracking and explainable targets. This is vendor-authored product
  material, not independent validation of training efficacy.
- [WebKit: Web Push for web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/):
  iOS/iPadOS Home Screen push requires a real push architecture and a permission
  request after direct interaction. It is not a guarantee for a local rest timer.

Only interaction principles and publicly documented behavior inform this change;
no third-party code, screenshots, photographs or branding are included as app assets.
