import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKUP_STATUS_KEY, BACKUP_REMINDER_AFTER_MS, BACKUP_REMINDER_DISMISS_MS, backupReminderDue, clearBackupStatus, confirmExternalBackup, dismissBackupReminder, invalidateBackupConfirmation, readBackupStatus, recordBackupAction, writeBackupStatus, type BackupStatus } from '../src/backup-status.ts';
import { createSupportReport, supportDiagnostics } from '../src/support-report.ts';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const start = Date.UTC(2026, 0, 1);

test('backup status reads never initialize, rewrite or inspect existing training records', () => {
  const storage = new MemoryStorage();
  storage.setItem('setline.gym.v1', 'private original bytes');
  const before = [...storage.values];
  assert.deepEqual(readBackupStatus(storage, start), { version: 1, firstSeenAt: start });
  assert.deepEqual([...storage.values], before);
  writeBackupStatus(storage, readBackupStatus(storage, start));
  clearBackupStatus(storage);
  assert.deepEqual([...storage.values], before);
});

test('download and share actions never certify an external copy or postpone its reminder', () => {
  const storage = new MemoryStorage();
  let status = readBackupStatus(storage, start);
  for (const method of ['download-requested', 'share-completed'] as const) {
    status = recordBackupAction(status, method, start + BACKUP_REMINDER_AFTER_MS);
    assert.equal(status.externalCopyConfirmedAt, undefined);
    assert.equal(backupReminderDue(status, start + BACKUP_REMINDER_AFTER_MS), true);
    assert.equal(status.lastExportAction?.method, method);
  }
});

test('only explicit user confirmation postpones a due reminder for thirty days', () => {
  const status: BackupStatus = { version: 1, firstSeenAt: start };
  assert.equal(backupReminderDue(status, start + BACKUP_REMINDER_AFTER_MS - 1), false);
  const checkedAt = start + BACKUP_REMINDER_AFTER_MS;
  const confirmed = confirmExternalBackup(status, checkedAt);
  assert.equal(backupReminderDue(confirmed, checkedAt + BACKUP_REMINDER_AFTER_MS - 1), false);
  assert.equal(backupReminderDue(confirmed, checkedAt + BACKUP_REMINDER_AFTER_MS), true);
  assert.equal(status.externalCopyConfirmedAt, undefined);
});

test('reminder dismissal survives reload and expires after seven days without claiming a backup', () => {
  const storage = new MemoryStorage();
  const dueAt = start + BACKUP_REMINDER_AFTER_MS;
  const dismissed = dismissBackupReminder({ version: 1, firstSeenAt: start }, dueAt);
  writeBackupStatus(storage, dismissed);
  const reloaded = readBackupStatus(storage, dueAt);
  assert.equal(reloaded.externalCopyConfirmedAt, undefined);
  assert.equal(backupReminderDue(reloaded, dueAt + BACKUP_REMINDER_DISMISS_MS - 1), false);
  assert.equal(backupReminderDue(reloaded, dueAt + BACKUP_REMINDER_DISMISS_MS), true);
});

test('malformed metadata and future clock values cannot certify files or indefinitely suppress reminders', () => {
  const storage = new MemoryStorage();
  for (const value of ['{', 'null', JSON.stringify({ version: 2, firstSeenAt: start })]) {
    storage.setItem(BACKUP_STATUS_KEY, value);
    assert.deepEqual(readBackupStatus(storage, start), { version: 1, firstSeenAt: start });
  }
  storage.setItem(BACKUP_STATUS_KEY, JSON.stringify({ version: 1, firstSeenAt: start * 2,
    externalCopyConfirmedAt: start * 2, reminderDismissedUntil: start * 2,
    lastExportAction: { at: start * 2, method: 'download-requested' } }));
  assert.deepEqual(readBackupStatus(storage, start), { version: 1, firstSeenAt: start });
});

test('restored-record invalidation retains the known action but clears its old external-file confirmation', () => {
  const storage = new MemoryStorage();
  const status = confirmExternalBackup(recordBackupAction(readBackupStatus(storage, start), 'download-requested', start), start);
  writeBackupStatus(storage, status);
  invalidateBackupConfirmation(storage, start + 1);
  const restored = readBackupStatus(storage, start + 1);
  assert.deepEqual(restored.lastExportAction, status.lastExportAction);
  assert.equal(restored.externalCopyConfirmedAt, undefined);
});

test('metadata storage failures are explicit and never attempt to write training storage', () => {
  const keys: string[] = [];
  assert.throws(() => writeBackupStatus({ setItem(key) { keys.push(key); throw new Error('Quota'); } }, { version: 1, firstSeenAt: start }), /Quota/);
  assert.deepEqual(keys, [BACKUP_STATUS_KEY]);
  assert.throws(() => readBackupStatus({ getItem() { throw new Error('Denied'); } }, start), /Denied/);
});

const environment = {
  appVersion: 'Setline V16', userAgent: 'Mozilla/5.0 private-token Safari/605.1.15 Version/18.1 Safari/605.1.15',
  width: 390, height: 844, online: true, standalone: true, serviceWorker: true, localStorageAccessible: true,
};

test('support reports exclude diagnostics by default and preserve explicit partial issue text', () => {
  assert.deepEqual(JSON.parse(createSupportReport('  Timer stopped  ')), { app: 'Setline', reportVersion: 1, description: 'Timer stopped' });
});

test('optional support diagnostics only expose a fixed non-sensitive allowlist', () => {
  const diagnostics = supportDiagnostics({ ...environment, profile: { bodyWeight: 87 }, href: 'https://example.test/?secret=token', sessions: ['private workout'] } as typeof environment);
  assert.deepEqual(diagnostics, {
    appVersion: 'Setline V16', browser: 'Safari 18', viewport: '390 × 844', connection: 'online',
    presentation: 'installed', serviceWorker: 'supported', localStorage: 'accessible',
  });
  const report = createSupportReport('Rest timer', { ...diagnostics, workoutHistory: 'private history' } as typeof diagnostics);
  for (const secret of ['private-token', 'bodyWeight', 'secret', 'sessions', 'workoutHistory', 'private history']) assert.equal(report.includes(secret), false);
});

test('diagnostic families do not pass unknown agent strings, invalid dimensions, or caller-supplied version secrets', () => {
  const diagnostics = supportDiagnostics({ ...environment, userAgent: 'private device ID', appVersion: 'Secret account name', width: NaN, height: Infinity });
  assert.equal(diagnostics.browser, 'Other browser');
  assert.equal(diagnostics.appVersion, 'Setline');
  assert.equal(diagnostics.viewport, '0 × 0');
  assert.equal(createSupportReport('x'.repeat(10_001)).includes('x'.repeat(10_001)), false);
});
