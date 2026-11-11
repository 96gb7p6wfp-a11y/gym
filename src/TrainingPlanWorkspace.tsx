import { createContext, useContext, useState, type ReactNode } from 'react';
import { useWideLayout } from './useAdaptiveLayout';

const TrainingGuideHost = createContext<HTMLElement | null>(null);
export const useTrainingGuideHost = () => useContext(TrainingGuideHost);

/** One planning tree, with a presentation-only destination for its selected guide.
 * Moving the guide never creates, copies or modifies a workout/session. */
export function TrainingPlanWorkspace({ active, children }: { active: boolean; children: ReactNode }) {
  const wide = useWideLayout();
  const split = wide && !active;
  const [host, setHost] = useState<HTMLElement | null>(null);
  return <TrainingGuideHost.Provider value={split ? host : null}>
    <div className="training-plan-workspace" data-split={split ? 'true' : undefined}>
      <div className="training-plan-workspace__primary">{children}</div>
      {split && <aside className="training-plan-workspace__details" aria-label="Selected exercise details" ref={setHost} />}
    </div>
  </TrainingGuideHost.Provider>;
}
