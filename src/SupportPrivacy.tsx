import { useEffect, useRef, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { createSupportReport, supportDiagnostics } from './support-report';
import './data-settings.css';

export interface SupportPrivacyProps {
  appVersion?: string;
  reportInitiallyOpen?: boolean;
}

/** The report stays local. An operator/support service can be connected later. */
export function SupportPrivacy({ appVersion = 'Setline V18', reportInitiallyOpen = false }: SupportPrivacyProps) {
  const [description, setDescription] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [message, setMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(reportInitiallyOpen);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (reportInitiallyOpen) { setReportOpen(true); details.current?.scrollIntoView?.({ block: 'nearest' }); }
  }, [reportInitiallyOpen]);
  let storageAccessible = false;
  try { window.localStorage.getItem('setline.storage-access-probe'); storageAccessible = true; } catch { /* Do not test by writing or expose the error. */ }
  const diagnostics = includeDiagnostics ? supportDiagnostics({
    appVersion, userAgent: navigator.userAgent,
    width: window.innerWidth, height: window.innerHeight,
    online: navigator.onLine,
    standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    serviceWorker: 'serviceWorker' in navigator,
    localStorageAccessible: storageAccessible,
  }) : undefined;
  const report = createSupportReport(description, diagnostics);
  const ready = description.trim().length > 0;

  return <section className="support-privacy" aria-label="Privacy and support">
    <h3>Privacy & support</h3>
    <details className="data-settings__transfer">
      <summary>How your data is stored</summary>
      <p>Setline stores your profile, plans, workouts, nutrition, routines, measurements, and preferences in this browser’s local storage. App files are cached for offline use. There is no Setline account or automatic cloud synchronization in this version.</p>
      <p>The app does not upload your training records or include analytics tracking code. The hosting provider receives normal website requests, which can include your IP address and browser information. External links open services with their own privacy practices.</p>
      <p>Anyone with access to this browser or an exported backup may be able to read your records. A backup is a readable JSON file, not an encrypted vault. Keep it somewhere private. Browser storage can be removed by device cleanup, private-browsing restrictions, or clearing website data.</p>
      <p>Use Backup &amp; data in You to export, restore, or explicitly delete local records. Deleting records here does not delete files you exported elsewhere. Different addresses and devices do not share local records automatically.</p>
      <p className="small-note">This describes the current local-first app. A named operator, public support contact, applicable service terms, and a professionally reviewed privacy policy are still needed before a public commercial launch. No legal compliance certification is claimed.</p>
    </details>
    <details className="support-report" ref={details} open={reportOpen} onToggle={event => setReportOpen(event.currentTarget.open)}>
      <summary>Report a Problem</summary>
      <p className="small-note">Prepare a report to share through a support channel you already trust. No report is submitted automatically, and no support-delivery service is connected.</p>
      <label className="field-label">What happened?
        <textarea rows={4} maxLength={10_000} value={description} placeholder="What were you trying to do, and what went wrong?" onChange={event => { setDescription(event.target.value); setMessage(''); }} />
      </label>
      <p className="small-note">Avoid private training, medical, account, or contact details. The text you enter will be included exactly as shown in the preview.</p>
      <label className="support-report__diagnostics">
        <input type="checkbox" checked={includeDiagnostics} onChange={event => { setIncludeDiagnostics(event.target.checked); setMessage(''); }} />
        Include app and browser diagnostics (optional)
      </label>
      <p className="small-note">Optional diagnostics include version, browser family, screen size, online status, installation mode, and feature availability. They exclude workouts, nutrition, profile details, storage contents, and page addresses.</p>
      <label className="field-label">Report preview
        <textarea className="support-report__preview" rows={includeDiagnostics ? 12 : 6} readOnly value={report} />
      </label>
      <div className="backup-buttons">
        <button className="btn btn-secondary" type="button" disabled={!ready} onClick={async () => {
          try {
            if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable. Select the preview text, or export the report instead.');
            await navigator.clipboard.writeText(report);
            setMessage('Report copied locally. It has not been sent.');
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not copy. Select the preview text, or export it.'); }
        }}><Copy size={16} /> Copy report</button>
        <button className="btn btn-secondary" type="button" disabled={!ready} onClick={() => {
          const url = URL.createObjectURL(new Blob([report], { type: 'application/json' }));
          const link = document.createElement('a');
          link.href = url; link.download = 'setline-problem-report.json';
          document.body.append(link); link.click(); link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
          setMessage('Report download requested. It has not been sent. Check Files or Downloads.');
        }}><Download size={16} /> Export report</button>
      </div>
      {message && <p className="small-note" role="status">{message}</p>}
    </details>
  </section>;
}
