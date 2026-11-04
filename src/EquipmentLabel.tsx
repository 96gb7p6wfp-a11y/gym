import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import './equipment-label.css';

export interface EquipmentLabelEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  label?: string;
  onSave: (label: string | undefined) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
}

/** An explicit label edit. This component never changes older records or invents equipment. */
export function EquipmentLabelEditor({ open, onOpenChange, exerciseName, label, onSave, disabled = false }: EquipmentLabelEditorProps) {
  const [draft, setDraft] = useState(label ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wasOpen = useRef(false);
  const writing = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) { setDraft(label ?? ''); setError(''); }
    wasOpen.current = open;
  }, [open, label]);

  async function save() {
    if (writing.current || disabled) return;
    const next = draft.trim().replace(/\s+/g, ' ');
    if (next.length > 80) { setError('Keep the equipment label under 80 characters.'); return; }
    writing.current = true; setBusy(true); setError('');
    try {
      if (await onSave(next || undefined) === false) throw new Error('The equipment label could not save. Try again.');
      onOpenChange(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The equipment label could not save. Try again.'); }
    finally { writing.current = false; setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={(next: boolean) => { if (!busy) onOpenChange(next); }}>
    <DialogContent className="app-dialog equipment-label-sheet">
      <DialogHeader className=""><DialogTitle className="">Equipment label</DialogTitle><DialogDescription className="">{exerciseName}</DialogDescription></DialogHeader>
      <form className="equipment-label-form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="field-label">Machine or equipment · optional<input aria-label="Machine or equipment label" value={draft} maxLength={80} autoComplete="off" autoCapitalize="words" placeholder="e.g. Technogym Chest Press" disabled={busy || disabled} onChange={event => { setDraft(event.target.value); setError(''); }} /></label>
        <p>Use the same label for the same machine. Different machines and unlabeled records have separate comparisons.</p>
        <p>Older workout records keep their original equipment information. Leave this empty if you’re unsure.</p>
        {error && <p className="equipment-label-error" role="alert">{error}</p>}
        <button type="submit" className="btn full" disabled={busy || disabled}>{busy ? 'Saving…' : 'Save equipment label'}</button>
      </form>
    </DialogContent>
  </Dialog>;
}
