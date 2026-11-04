/** Device-local UI metadata. This never changes or certifies a training backup. */
export const BACKUP_STATUS_KEY = 'setline.gym.backup-status.v1';
export const BACKUP_REMINDER_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export interface BackupStatus {
  version: 1;
  firstSeenAt: number;
  lastExportAction?: { at: number; method: 'download-requested' | 'share-completed' };
  externalCopyConfirmedAt?: number;
  reminderDismissedUntil?: number;
}

type MetadataStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 8_640_000_000_000_000;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function readBackupStatus(storage: Pick<MetadataStorage, 'getItem'>, now = Date.now()): BackupStatus {
  const fresh: BackupStatus = { version: 1, firstSeenAt: now };
  const text = storage.getItem(BACKUP_STATUS_KEY);
  if (text === null) return fresh;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return fresh; }
  if (!object(value) || value.version !== 1 || !timestamp(value.firstSeenAt)) return fresh;
  // A changed device clock must not suppress reminders indefinitely.
  const status: BackupStatus = { version: 1, firstSeenAt: Math.min(value.firstSeenAt, now) };
  if (object(value.lastExportAction) && timestamp(value.lastExportAction.at) && value.lastExportAction.at <= now &&
    (value.lastExportAction.method === 'download-requested' || value.lastExportAction.method === 'share-completed')) {
    status.lastExportAction = { at: value.lastExportAction.at, method: value.lastExportAction.method };
  }
  if (timestamp(value.externalCopyConfirmedAt) && value.externalCopyConfirmedAt <= now) status.externalCopyConfirmedAt = value.externalCopyConfirmedAt;
  if (timestamp(value.reminderDismissedUntil) && value.reminderDismissedUntil <= now + BACKUP_REMINDER_DISMISS_MS) status.reminderDismissedUntil = value.reminderDismissedUntil;
  return status;
}

export function writeBackupStatus(storage: Pick<MetadataStorage, 'setItem'>, status: BackupStatus): void {
  storage.setItem(BACKUP_STATUS_KEY, JSON.stringify(status));
}

export function recordBackupAction(status: BackupStatus, method: NonNullable<BackupStatus['lastExportAction']>['method'], now = Date.now()): BackupStatus {
  // A browser download/share result says nothing about durable external storage.
  return { ...status, lastExportAction: { at: now, method } };
}

export function confirmExternalBackup(status: BackupStatus, now = Date.now()): BackupStatus {
  return { ...status, externalCopyConfirmedAt: now, reminderDismissedUntil: undefined };
}

export function dismissBackupReminder(status: BackupStatus, now = Date.now()): BackupStatus {
  return { ...status, reminderDismissedUntil: now + BACKUP_REMINDER_DISMISS_MS };
}

export function backupReminderDue(status: BackupStatus, now = Date.now()): boolean {
  if (status.reminderDismissedUntil && status.reminderDismissedUntil > now) return false;
  return now - (status.externalCopyConfirmedAt ?? status.firstSeenAt) >= BACKUP_REMINDER_AFTER_MS;
}

export function invalidateBackupConfirmation(storage: MetadataStorage, now = Date.now()): void {
  const status = readBackupStatus(storage, now);
  // After replacing records, an older file confirmation no longer describes them.
  writeBackupStatus(storage, { version: 1, firstSeenAt: now, ...(status.lastExportAction ? { lastExportAction: status.lastExportAction } : {}) });
}

export function clearBackupStatus(storage: Pick<MetadataStorage, 'removeItem'>): void {
  storage.removeItem(BACKUP_STATUS_KEY);
}
