import type { JumpSummary, PerformanceSummary } from './performance-insights.ts';

export interface ProgressTakeaway {
  observation: string;
  nextStep: string;
  basis: 'jump' | 'strength' | 'weight' | 'load' | 'baseline';
}

const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const jumpLabel = (jump: JumpSummary) => `${jump.type[0].toUpperCase()}${jump.type.slice(1)} ${jump.measurement === 'touch' ? 'touch' : 'jump'}`;
const jumpPriority = (jump: JumpSummary) => (jump.type === 'approach' ? 0 : jump.type === 'standing' ? 2 : 4) + (jump.measurement === 'height' ? 0 : 1);

function liftingPattern(changes: PerformanceSummary['strengthChanges']) {
  // Copied or differently configured instances of one named movement are not
  // evidence of progress across several movements.
  const movements = new Map<string, typeof changes>();
  for (const change of changes) {
    const name = change.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
    movements.set(name, [...(movements.get(name) ?? []), change]);
  }
  let up = 0, down = 0, steady = 0;
  for (const matches of movements.values()) {
    if (matches.every(item => item.current >= item.previous) && matches.some(item => item.current > item.previous)) up++;
    else if (matches.every(item => item.current <= item.previous) && matches.some(item => item.current < item.previous)) down++;
    else if (matches.every(item => item.current === item.previous)) steady++;
  }
  const total = movements.size;
  const majority = Math.ceil(total * 2 / 3);
  const pattern = total < 3 ? null : up >= majority ? 'up' : down >= majority ? 'down' : steady === total ? 'steady' : 'mixed';
  const count = pattern === 'up' ? up : down;
  const statement = pattern === 'up' || pattern === 'down'
    ? `Loads are ${pattern === 'up' ? 'rising' : 'lower'} across ${count === total ? count : `${count} of ${total}`} tracked movements`
    : pattern === 'steady' ? 'Your tracked lifting loads are steady' : 'Your tracked lifts show mixed progress';
  return { total, up, down, pattern, statement };
}

function participation(summary: PerformanceSummary): string | null {
  if (summary.gymSessions > 0 && summary.consistencyPercent !== null) return `You’ve logged ${number(summary.consistencyPercent)}% of planned gym days`;
  if (summary.gymSessions > 0 && summary.volleyballSessions > 0) return `You’ve logged ${summary.gymSessions} gym and ${summary.volleyballSessions} volleyball sessions`;
  if (summary.gymSessions > 0) return `You’ve logged ${summary.gymSessions} gym ${summary.gymSessions === 1 ? 'session' : 'sessions'}`;
  if (summary.volleyballSessions > 0) return `You’ve logged ${summary.volleyballSessions} volleyball ${summary.volleyballSessions === 1 ? 'session' : 'sessions'}`;
  return null;
}

/** Summarize the overall picture without promoting one lift into a fitness verdict.
 * Every observation comes from recorded comparisons; the next step is advisory.
 */
export function getProgressTakeaway(summary: PerformanceSummary): ProgressTakeaway {
  const jumps = summary.jumps.filter(jump => jump.change30Days !== null).sort((a, b) => jumpPriority(a) - jumpPriority(b));
  const jump = jumps[0];
  const lift = liftingPattern(summary.strengthChanges);
  const weight = summary.weight;
  const attendance = participation(summary);
  const weightChange = weight.change30Days;
  const weightObserved = weight.stableThreeWeeks || weightChange !== null;
  const weightStatement = weight.stableThreeWeeks ? 'weekly-average weight has been stable for 3 weeks'
    : weightChange === 0 ? 'weekly-average weight is steady'
      : weightChange !== null ? `weekly-average weight is ${weightChange > 0 ? 'up' : 'down'} ${number(Math.abs(weightChange))} kg` : '';
  const jumpStatement = jump ? `${jumpLabel(jump)} is ${jump.change30Days === 0 ? 'steady' : `${jump.change30Days! > 0 ? 'up' : 'down'} ${number(Math.abs(jump.change30Days!))} cm`}` : '';

  // Sport performance and the person's actual check-in take priority over
  // chasing load, even when other recorded measures are improving.
  if (jump && jump.change30Days! < 0) return {
    basis: 'jump',
    observation: lift.pattern === 'up' ? `Lifting loads are rising, but ${jumpStatement[0].toLowerCase()}${jumpStatement.slice(1)}.`
      : weightChange !== null && weightChange > 0 ? `Weekly-average weight is rising, but ${jumpStatement[0].toLowerCase()}${jumpStatement.slice(1)}.`
        : `${jumpStatement}; overall performance needs a fresh comparison.`,
    nextStep: 'Retest under similar conditions with fresh legs; avoid adding jump volume.',
  };
  if (summary.load.level === 'higher' && summary.load.label === 'Take it easier') return {
    basis: 'load',
    observation: jump && jump.change30Days! > 0 ? `${jumpStatement}, but your latest check-in suggests an easier day.`
      : lift.pattern === 'up' ? 'Lifting loads are rising, but your latest check-in suggests an easier day.'
        : 'Overall trends are still forming, and your latest check-in suggests an easier day.',
    nextStep: 'Keep movement comfortable and leave extra leg work out for now.',
  };
  if (summary.load.level === 'higher') return {
    basis: 'load',
    observation: jump && jump.change30Days! > 0 ? `${jumpStatement}; recent training work also needs attention.`
      : lift.pattern === 'up' ? `${lift.statement}; recent training work also needs attention.`
        : 'Your logs show more work or hard activity; overall performance trends are still forming.',
    nextStep: 'Keep jumps crisp and skip extra leg volume to protect court performance.',
  };

  if (jump && jump.change30Days! > 0) return {
    basis: 'jump',
    observation: lift.pattern === 'up' ? `${jumpStatement} and tracked lifting loads are rising.`
      : lift.pattern === 'down' || lift.pattern === 'mixed' ? `${jumpStatement}, while lifting progress is ${lift.pattern === 'down' ? 'lower' : 'mixed'}.`
        : weightObserved ? `${jumpStatement}; ${weightStatement}.`
          : `${jumpStatement}; broader strength trends are still forming.`,
    nextStep: lift.pattern === 'down' || lift.pattern === 'mixed' ? 'Keep the next session controlled and compare your key lifts again.'
      : weight.stableThreeWeeks || (weightChange !== null && weightChange < 0) ? 'Keep training consistent and review fueling for gradual muscle gain.'
        : lift.pattern === 'up' ? 'Progress gradually while protecting fresh legs and high-quality jumps.'
          : 'Keep training consistent and compare your key lifts next.',
  };

  if (lift.pattern) return {
    basis: 'strength',
    observation: `${lift.statement}${jump ? `, while ${jumpLabel(jump).toLowerCase()} is steady`
      : weightObserved ? `; ${weightStatement}` : '; jump progress is still unmeasured'}.`,
    nextStep: lift.pattern === 'down' ? 'Keep the next session controlled and repeat comparisons after recovery.'
      : lift.pattern === 'mixed' ? 'Repeat comparable sets and let warm-up quality guide the load.'
        : lift.pattern === 'steady' ? 'Build clean reps before adding load; protect fresh legs for volleyball.'
          : weight.stableThreeWeeks || (weightChange !== null && weightChange < 0) ? 'Review fueling and log an approach jump before adding training volume.'
            : jump ? 'Keep jumps crisp and progress strength without extra leg work.'
              : 'Log an approach jump next and keep training consistent.',
  };

  if (weightObserved) return {
    basis: 'weight',
    observation: `${weightStatement[0].toUpperCase()}${weightStatement.slice(1)}${jump ? `, while ${jumpLabel(jump).toLowerCase()} is steady` : '; overall performance trends are still limited'}.`,
    nextStep: weight.stableThreeWeeks ? 'Consider +100–150 kcal/day and compare your next jump and lifting results.'
      : 'Compare key lifts and a jump test before changing food targets.',
  };
  if (jump) return {
    basis: 'jump',
    observation: `${jumpStatement}; overall strength trends need more comparable movements.`,
    nextStep: 'Keep the same jump test setup and build consistent lifting records.',
  };
  if (attendance || lift.total > 0) return {
    basis: 'baseline',
    observation: `${attendance ?? 'Your logged comparisons are limited'}${lift.up > 0 ? `, with ${lift.up === 1 ? 'one lifting gain' : `gains in ${lift.up} movements`}` : ''}; overall trends are still forming.`,
    nextStep: summary.consistencyPercent !== null && summary.consistencyPercent < 50 && !lift.up
      ? 'Focus on the next planned session and log an approach jump.'
      : 'Track several key lifts and log an approach jump next.',
  };
  if (summary.jumps.length) return {
    basis: 'baseline',
    observation: 'Your jump baseline is recorded; a recent comparison is still missing.',
    nextStep: 'Repeat the same test and keep training consistent.',
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
