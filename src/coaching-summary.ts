import type { JumpSummary, PerformanceSummary } from './performance-insights.ts';

export interface ProgressTakeaway {
  observation: string;
  nextStep: string;
  basis: 'jump' | 'strength' | 'weight' | 'load' | 'baseline';
}

const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const jumpLabel = (jump: JumpSummary) => `${jump.type[0].toUpperCase()}${jump.type.slice(1)} ${jump.measurement === 'touch' ? 'touch' : 'jump'}`;
const jumpPriority = (jump: JumpSummary) => (jump.type === 'approach' ? 0 : jump.type === 'standing' ? 2 : 4) + (jump.measurement === 'height' ? 0 : 1);

/** A concise observation, then one advisory next step; never changes saved targets. */
export function getProgressTakeaway(summary: PerformanceSummary): ProgressTakeaway {
  const jumps = summary.jumps.filter(jump => jump.change30Days !== null).sort((a, b) => jumpPriority(a) - jumpPriority(b));
  const jump = jumps.find(item => item.change30Days !== 0);
  const protectFreshness = summary.load.level === 'higher';

  if (jump) {
    const change = jump.change30Days!;
    return {
      basis: 'jump',
      observation: `${jumpLabel(jump)} is ${change > 0 ? 'up' : 'down'} ${number(Math.abs(change))} cm across recorded test days.`,
      nextStep: change < 0
        ? 'Retest under similar conditions; keep jumps light if your warm-up feels heavy.'
        : protectFreshness ? 'Keep jumps crisp and leave extra leg work out for now.'
          : 'Keep jump reps fast and landings controlled.',
    };
  }

  const strength = summary.strengthChanges.find(item => item.current > item.previous)
    ?? [...summary.strengthChanges].sort((a, b) => a.percent - b.percent).find(item => item.current < item.previous);
  if (strength) {
    const change = strength.current - strength.previous;
    return {
      basis: 'strength',
      observation: `${strength.name}: ${number(Math.abs(change))} kg ${change > 0 ? 'more' : 'less'} at ${strength.reps} reps.`,
      nextStep: protectFreshness ? 'Keep the next session controlled; skip extra leg volume.'
        : change > 0 ? 'Repeat cleanly before adding load; avoid grinding reps.'
          : 'Let warm-up quality guide the next load; avoid grinding reps.',
    };
  }

  const weight = summary.weight;
  if (weight.stableThreeWeeks) return {
    basis: 'weight',
    observation: 'Your weekly-average weight has been stable for 3 weeks.',
    nextStep: 'Consider +100–150 kcal/day, then review the next weekly average.',
  };
  if (weight.change30Days !== null && weight.change30Days !== 0) return {
    basis: 'weight',
    observation: `Your weekly-average weight is ${weight.change30Days > 0 ? 'up' : 'down'} ${number(Math.abs(weight.change30Days))} kg across recorded weeks.`,
    nextStep: 'Review the trend alongside jump quality before changing food targets.',
  };

  if (protectFreshness) return {
    basis: 'load',
    observation: summary.load.label === 'Take it easier'
      ? 'Your latest check-in suggests an easier day.'
      : 'Your recent logs show more training work or hard activity.',
    nextStep: 'Keep movement controlled and protect fresh legs for volleyball.',
  };

  if (jumps[0]) return {
    basis: 'jump',
    observation: `${jumpLabel(jumps[0])} is steady across recorded test days.`,
    nextStep: 'Keep the same test setup and focus on crisp, repeatable jumps.',
  };
  if (summary.strengthChanges[0]) return {
    basis: 'strength',
    observation: `${summary.strengthChanges[0].name} is unchanged at ${summary.strengthChanges[0].reps} reps.`,
    nextStep: 'Keep the load controlled and build consistent reps before adding weight.',
  };
  if (weight.change30Days === 0) return {
    basis: 'weight',
    observation: 'Your weekly-average weight is steady across recorded weeks.',
    nextStep: 'Keep checking in under similar conditions before changing food targets.',
  };
  if (summary.gymSessions > 0) return {
    basis: 'baseline',
    observation: `${summary.gymSessions} gym ${summary.gymSessions === 1 ? 'session is' : 'sessions are'} recorded in the last 30 days.`,
    nextStep: 'Repeat a movement at the same reps to measure your next step.',
  };
  if (summary.volleyballSessions > 0) return {
    basis: 'baseline',
    observation: `${summary.volleyballSessions} volleyball ${summary.volleyballSessions === 1 ? 'session is' : 'sessions are'} recorded in the last 30 days.`,
    nextStep: 'Log a jump height to follow your performance alongside court time.',
  };
  return {
    basis: 'baseline',
    observation: 'Your baseline starts here.',
    nextStep: 'Log a jump height, then repeat the same test.',
  };
}

/** Quiet encouragement that respects the purpose of the day. */
export function getDailyMotivation({ kind, completed = false, active = false }: {
  kind: 'strength' | 'sport' | 'recovery'; completed?: boolean; active?: boolean;
}): string {
  if (completed) return 'Good work today. Recovery is part of your next step.';
  if (kind === 'recovery') return 'Easy movement today, fresher legs for your next jump.';
  if (kind === 'sport') return 'One ball at a time. Commit to the next play.';
  return active ? 'One clean set at a time.' : 'Build strength you can take onto the court.';
}
