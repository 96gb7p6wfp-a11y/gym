import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { getWarmupPresentation, getWarmupStepInfo, type WarmupPlan } from './session-preparation';
import type { StretchStep } from './stretch-routine';
import './warmup-flow.css';

export { getWarmupPresentation } from './session-preparation';

interface WarmupFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: WarmupPlan;
  items: StretchStep[];
  override: boolean;
  disabled?: boolean;
  onChange: (items: StretchStep[]) => void;
  onOverride: () => void;
  onStart: () => void;
}

/** A preparation checklist only. The parent creates the workout on explicit Start. */
export function WarmupFlow({ open, onOpenChange, plan, items, override, disabled = false, onChange, onOverride, onStart }: WarmupFlowProps) {
  const presentation = getWarmupPresentation(plan);
  const completed = items.filter(item => item.done).length;
  const ready = override || (items.length > 0 && completed === items.length);
  return <Dialog open={open} onOpenChange={(next: boolean) => { if (!disabled) onOpenChange(next); }}>
    <DialogContent className="app-dialog warmup-flow-sheet">
      <DialogHeader className="warmup-flow__header">
        <p className="eyebrow">Before you train</p>
        <DialogTitle className="">Warm-up</DialogTitle>
        <DialogDescription className="">{presentation.purpose}</DialogDescription>
      </DialogHeader>
      <div className="warmup-flow__session"><h2>{presentation.title}</h2><p>{presentation.duration} · {items.length} movements</p></div>
      <div className="warmup-flow__progress" role="status" aria-label="Warm-up progress"><span>{completed} of {items.length} completed</span><span>{override ? 'Already warmed up' : ready ? 'Ready to train' : 'Build up gently'}</span></div>
      <progress className="warmup-flow__meter" value={completed} max={Math.max(1, items.length)} aria-label="Warm-up completion" />
      <ol className="warmup-flow__steps">
        {items.map((item, index) => {
          const information = getWarmupStepInfo(item, plan);
          return <li key={item.key} className={item.done ? 'is-complete' : ''}>
            <div className="warmup-flow__step-heading">
              <label className="warmup-flow__check"><input type="checkbox" checked={item.done} disabled={disabled} aria-label={`Complete ${item.name} in warmup`} onChange={event => onChange(items.map(step => step.key === item.key ? { ...step, done: event.target.checked } : step))} /><span aria-hidden="true">{item.done ? <Check size={18} /> : String(index + 1).padStart(2, '0')}</span></label>
              <div><h3>{item.name}</h3><p className="warmup-flow__target">{item.target}</p></div>
            </div>
            <p className="warmup-flow__benefit">{information.benefit}</p>
            <p className="warmup-flow__technique">{information.technique}</p>
            {(information.followUp || information.alternatives.length > 0) && <details className="warmup-flow__details"><summary>Exercise details<ChevronDown size={16} aria-hidden="true" /></summary>
              {information.followUp && <p>{information.followUp}</p>}
              {information.alternatives.length > 0 && <div className="warmup-flow__alternatives"><p>Need an alternative?</p>{information.alternatives.map(choice => <button key={choice.name} type="button" disabled={disabled} onClick={() => onChange(items.map(step => step.key === item.key ? { ...step, ...choice, done: false } : step))}><RefreshCw size={16} aria-hidden="true" /><span><strong>{choice.name}</strong><small>{choice.target}</small></span></button>)}</div>}
            </details>}
          </li>;
        })}
      </ol>
      <div className="warmup-flow__actions">
        <button type="button" className="btn full" disabled={disabled || !ready} onClick={onStart}>Start main workout</button>
        {override ? <p className="warmup-flow__acknowledgment">You confirmed you warmed up elsewhere.</p> : <button type="button" className="text-button" disabled={disabled} onClick={onOverride}>Already warmed up</button>}
      </div>
    </DialogContent>
  </Dialog>;
}
