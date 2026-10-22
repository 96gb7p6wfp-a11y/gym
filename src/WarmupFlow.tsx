import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { getQuickWarmup, getQuickWarmupCue, getQuickWarmupPresentation, getWarmupStepInfo, type WarmupPlan } from './session-preparation';
import type { StretchStep } from './stretch-routine';
import './warmup-flow.css';

export { getWarmupPresentation, getQuickWarmupPresentation } from './session-preparation';

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

/** Quick preparation is recommended, never a barrier to starting a session. */
export function WarmupFlow({ open, onOpenChange, plan, items, override, disabled = false, onChange, onOverride, onStart }: WarmupFlowProps) {
  const presentation = getQuickWarmupPresentation(plan);
  const quick = getQuickWarmup(plan, items);
  const quickKeys = new Set(quick.map(item => item.key));
  const extra = items.filter(item => !quickKeys.has(item.key));
  const completed = quick.filter(item => item.done).length;
  const ready = quick.length > 0 && completed === quick.length;
  function toggle(item: StretchStep, done: boolean) { onChange(items.map(step => step.key === item.key ? { ...step, done } : step)); }
  function renderStep(item: StretchStep, index: number, supplemental = false) {
    const information = getWarmupStepInfo(item, plan);
    return <li key={item.key} className={item.done ? 'is-complete' : ''}>
      <div className="warmup-flow__step-heading">
        <label className="warmup-flow__check"><input type="checkbox" checked={item.done} disabled={disabled} aria-label={`Complete ${item.name} in ${supplemental ? 'full preparation' : 'warmup'}`} onChange={event => toggle(item, event.target.checked)} /><span aria-hidden="true">{item.done ? <Check size={16} /> : String(index + 1).padStart(2, '0')}</span></label>
        <div><h3>{item.name}</h3><p className="warmup-flow__target">{item.target}</p></div>
      </div>
      <p className="warmup-flow__technique">{getQuickWarmupCue(item)}</p>
      <details className="warmup-flow__details"><summary>Details<ChevronDown size={15} aria-hidden="true" /></summary>
        <p>{item.cue}</p>{information.followUp && <p>{information.followUp}</p>}
        {information.alternatives.length > 0 && <div className="warmup-flow__alternatives"><p>Need an alternative?</p>{information.alternatives.map(choice => <button key={choice.name} type="button" disabled={disabled} onClick={() => onChange(items.map(step => step.key === item.key ? { ...step, ...choice, done: false } : step))}><RefreshCw size={16} aria-hidden="true" /><span><strong>{choice.name}</strong><small>{choice.target}</small></span></button>)}</div>}
      </details>
    </li>;
  }
  return <Dialog open={open} onOpenChange={(next: boolean) => { if (!disabled) onOpenChange(next); }}>
    <DialogContent className="app-dialog warmup-flow-sheet">
      <DialogHeader className="warmup-flow__header"><DialogTitle className="">Warm-up</DialogTitle><DialogDescription className="">{presentation.title.replace('Preparation', 'quick prep')} · {presentation.duration}</DialogDescription></DialogHeader>
      <p className="warmup-flow__intro">{plan.kind === 'recovery' ? 'Ease into movement at your own pace.' : '30–60 sec easy movement, then these drills.'}</p>
      <ol className="warmup-flow__steps" aria-label="Quick warm-up exercises">{quick.map((item, index) => renderStep(item, index))}</ol>
      <p className="warmup-flow__ramp">{presentation.rampUp}</p>
      <div className="warmup-flow__progress" role="status" aria-label="Warm-up progress">{override ? 'Warmed up elsewhere' : ready ? 'Quick prep complete' : `${completed} of ${quick.length} completed`}</div>
      {extra.length > 0 && <details className="warmup-flow__full"><summary>Full preparation<small>{extra.length} more drills</small><ChevronDown size={16} aria-hidden="true" /></summary><p>Your saved routine, alongside the quick prep above. Use more preparation when needed.</p><ol className="warmup-flow__steps" aria-label="Additional preparation exercises">{extra.map((item, index) => renderStep(item, index, true))}</ol></details>}
      <div className="warmup-flow__actions"><button type="button" className="btn full" disabled={disabled} onClick={onStart}>Start workout</button><div className="warmup-flow__shortcuts"><button type="button" className="text-button" disabled={disabled || ready} onClick={() => onChange(items.map(item => quickKeys.has(item.key) ? { ...item, done: true } : item))}>{ready ? 'Warm-up complete' : 'Mark warm-up complete'}</button>{!override && <button type="button" className="text-button" disabled={disabled} onClick={onOverride}>Already warmed up</button>}</div></div>
    </DialogContent>
  </Dialog>;
}
