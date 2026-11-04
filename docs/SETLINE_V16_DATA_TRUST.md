# V16 data trust and release boundaries

## Current implementation

Setline remains local-first. Training data lives in `setline.gym.v1` in the current
browser and website origin. The service worker caches the app shell. This release
does not add accounts, automatic cloud backup, remote training-data collection, or
a support-submission backend. Normal hosting requests may expose network metadata
to the hosting provider. External links have separate service policies.

Manual backups remain version-1 JSON, validated completely before replacement.
Existing backup files remain importable. Current records are retained as a local
pre-restore safety copy before a valid restore replaces the main state. Running
clients reject stale writes after a restore. Users must still close old tabs,
especially older app versions, before restoring.

Backup UI dates are advisory browser-local metadata under
`setline.gym.backup-status.v1`. They do not rewrite profiles, plans, sessions,
nutrition or performance data and are not part of portable training backups.
“Download requested” and “Sharing completed” record actions, not durable storage.
“You confirmed a saved file” is explicit user self-report; the browser cannot
verify external files. A confirmation can predate later training changes.
Recovery-file and pre-restore-copy exports do not count as current-data exports.
Cancelled sharing records no successful action. Metadata failures do not turn a
successful export action into a false failed-export claim.

A reminder becomes due 30 days after the last explicit file confirmation, or 30
days after this browser first observes V16 backup status. Its timing does not
invent an earlier installation/export date for an existing user. Dismissal lasts
seven days. These dates cannot guarantee recovery or detect deletion of an
external copy. Successful restore invalidates an old confirmation when metadata
storage is available; deleting local data also removes this status key.

## Safe transfer

1. Open the existing app at its exact current address and export a backup.
2. Check that the JSON file is present in Files/Downloads or chosen private storage.
   Preserve a second copy if possible.
3. Open the intended Setline address on the destination device/browser. Separate
   addresses and devices have separate local storage.
4. Export destination records first if they matter. Import the source backup,
   review its date/counts, and explicitly confirm replacement.
5. Verify history, plan, measurements and active workout on the destination.
   Keep the source data and backup until satisfied. Nothing copies or clears
   the old origin automatically.

The user-confirmed existing origin is `https://gym-kveq.vercel.app`. GitHub
deployment status can prove a particular commit deployed to the `gym-kveq`
Vercel project. It does not prove the stable domain's alias binding. This
environment's current permitted network/tools cannot independently read that
binding or the live domain; release reporting must distinguish those claims.
Never send an existing user to a preview origin as a substitute for their data.

## Reports, privacy and operational limits

Report a Problem prepares a visible, local JSON report. Diagnostics are opt-in
and rebuilt from a fixed allowlist: app version, browser family/major version,
viewport size, online status, installed/browser presentation, service-worker
support, and local-storage read accessibility. No URL, raw user-agent, profile,
record count, session, nutrition, medical record, storage content, token or
exception object is automatically attached. User-entered report text is included
after trimming/length limits; users are advised to avoid sensitive details.

Copy/export does not send a report. No contact address or delivery service is
invented. The in-app privacy disclosure describes this implementation; before a
public commercial launch the operator must supply an accurate identity and
contact, decide applicable terms/age/accessibility obligations, review hosting
retention and actual processors, and obtain professional review where needed.
There is no compliance certification. Backup JSON is readable, not encrypted;
device/browser access and exported-file handling remain relevant.

## Deferred authenticated cloud-backup architecture

This is a proposal, not an enabled service. Local workout logging remains usable
without it. Implement only after an operator, secure backend, authentication,
deployment credentials and access/retention decisions are available.

- **Identity:** established authentication provider with verified ownership and
  secure session handling. Never embed privileged API/database secrets in the
  frontend. Permit authenticated users to export and delete their own data.
- **Authorization:** private per-user namespace with server-enforced ownership
  on every read/write. Test cross-account denial. No public bucket/table of
  personal workout information, and no trust in a frontend-supplied owner ID.
- **Snapshots first:** upload a fully validated versioned backup to private
  storage over TLS. Persist a checksum, schema version, server receipt, size,
  client-generated operation ID and timestamp. Mark a backup received only after
  authenticated server acknowledgement and verify it with a read/restore check.
  Define retention, deletion and disaster-recovery policies before launch.
- **Offline outbox:** queue retryable operations locally, deduplicate by operation
  ID and never erase local data on upload failure. Track local edits and remote
  versions explicitly; surface conflicts rather than overwriting history.
  Preserve deletion tombstones and prevent an old device resurrecting records.
- **Recovery:** download into a separate validated candidate, display a preview,
  preserve the current local safety copy, and commit atomically. Keep backward
  compatibility with portable v1 files. Do not replace a live workout without
  a deliberate conflict/restore decision.
- **Privacy/security operations:** encryption at rest with managed keys, least
  privilege, auditable administrative access, redacted diagnostics, rate limits,
  data processing/retention documentation, account deletion and recovery policy.
  Evaluate whether end-to-end encryption is appropriate before promising it;
  key-loss and multi-device recovery need a real design.
- **Release gates:** auth expiry, network interruption, duplicate retries,
  concurrent devices, malicious ownership changes, quota, corrupted snapshots,
  interrupted restore, deletion propagation, schema rollback, operator recovery,
  and full offline operation must pass before enabling synchronization.

Apple Health, AI nutrition photography and a video library remain separate
integrations requiring real services/permissions. None is simulated in V16.
