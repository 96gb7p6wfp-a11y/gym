# Setline V14

Base: `c086944a6cdd4e9f4979887fb25fb451f9256d0b`, the V13.1 commit on main.
V14 improves the app; it does not replace the V13.1 training prescription.

## Data and restoration

Settings keeps version-1 JSON export/import and adds a fully validated restore
preview. Choosing a file does not change records. Restore requires a separate
action and confirmation, flushes pending workout changes, and saves the exact
previous local bytes before replacement. Invalid files, failed pending saves,
and safety-copy quota failures abort replacement. A failed main write attempts
to restore the prior safety-copy slot, while leaving main records intact.
Settings can export the pre-restore copy after reload; unreadable prior data is
exported as a recovery file rather than presented as a restorable backup.

Restoring deliberately replaces current records with the reviewed backup; it is
not a merge. Export current data first for a separate durable copy. The local
safety slot holds one pre-restore state and another successful restore replaces
it. Deleting local data explicitly deletes this slot too. Browser storage is not
cloud backup and can still be cleared by the device.

A restore writes a new local generation marker in the same main-state write.
Already-open V14 clients reject subsequent stale mutations even if older record
versions happen to match. Portable exports omit this internal marker. Close
other Setline tabs before restoring: a previously loaded V13.1 app cannot enforce
the new guard. The storage key, schema version, existing record identifiers,
V13.1 snapshots, plans, history, reminders and nutrition remain compatible.

Download requests do not prove a file was saved; check Files/Downloads. Native
file sharing is offered where supported, cancellation is explicit, and completion
asks the user to verify the saved file. The running origin is visible/copyable,
since different origins have separate local data.

## Workout logging

The focused set offers explicit reuse of its ordinal from the latest completed,
comparable movement. It copies only weight/reps; it does not complete work, copy
RIR/measurements, start timers, or alter history. Timed, ambiguous,
preparation-only and clearance-limited zero-default bodyweight movements do not
reuse loaded work. Decimal and zero weights remain distinct from missing data.
Quick RIR buttons record exactly 0–5; Clear returns to unknown. Manual 0–10 entry
remains in set details.

## Volleyball insight and contact sources

Approach Advantage is approach jump height minus standing jump height, with the
percentage relative to standing height. New reach-and-touch pairs share a test
identifier. Comparisons require measured heights on the same date with matching
recorded reach/setup; video estimates, unrelated tests, absolute touch heights,
and ambiguous multiple same-day pairs are excluded. Legacy reach pairs are used
only when unambiguous; their records are not rewritten. Changes require comparable
setups and two dates in the last 30 days. This describes tests, not a diagnosis,
recovery assessment or proof of a training effect.

Counted sport contacts, estimates and source-unclassified entries stay separate.
Zero is a real entered count; missing is unknown. Gym contacts are derived from
completed exercise reps and labeled accordingly. Deleted/active records and
repeated record IDs are excluded from completed exposure totals. The app cannot
detect two separately created records describing the same real-world session;
log PE/volleyball only once. Legacy records whose saved source is already
`recorded` retain that classification; V14 cannot reconstruct whether an earlier
UI default or a deliberate choice produced it.

## Version status and phone runtime

Today, Train and Training plan distinguish the V14 app from the saved plan
revision, current/upcoming/completed block, selected-date preview and available
previous version. Train also identifies the workout's saved snapshot separately.
No automatic plan upgrade or new eight-week block is started.

The chart engine, detailed performance screen, weekly report, nutrition screen
and activity importer are separate JavaScript chunks. The existing service
worker precaches every generated chunk, including first-use offline screens.
The visible app clock ticks each second only when a live workout/movement/rest
timer needs it; otherwise it ticks each minute and stops while hidden.

This tab's rest deadline survives refresh in session storage; expiry/resume uses
absolute time. Page suspension and callbacks more than five seconds late resolve
silently rather than emitting a stale beep. Adjustments can unlock audio again
after refresh. Session storage restrictions leave the in-memory timer working.
Audio gesture authorization does not survive reload, and physical iPhone
speaker/music/locked-background behavior still requires device verification.
No guaranteed background notification is introduced.

## Relationship to PR #1

PR #1 (`audit/data-portability-20261103`, reviewed at `57d2ef6`) remains open and
untouched. Its audit and CI changes are not included. Its origin/copy and native
backup-sharing work overlaps `DataSettings.tsx`; V14 preserves that intent in the
expanded backup flow independently. These branches will need deliberate conflict
resolution if both are later merged. V14 does not merge or overwrite PR #1.

Observed validation and bundle measurements are recorded in `VALIDATION.md`.
