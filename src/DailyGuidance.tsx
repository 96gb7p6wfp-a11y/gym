import { getDailyGuidance } from './coaching';
import { ShortRoutine } from './ShortRoutine';
import './guidance.css';

export function DailyGuidance({ input, minutes, calories, includeRoutine = true }: {
  input: Parameters<typeof getDailyGuidance>[0];
  minutes: number;
  calories: number;
  includeRoutine?: boolean;
}) {
  const guidance = getDailyGuidance(input);
  return (
    <section className="panel daily-guidance" aria-label="Training and nutrition guidance">
      <div className="panel-heading"><h3>Training & nutrition guidance</h3></div>
      <p className="small-note">{input.date} · {input.plannedName}</p>
      {includeRoutine && <ShortRoutine input={input} />}
      <div className="daily-training-total" aria-label="Daily training total">
        <span><strong>{Math.round(minutes * 10) / 10}</strong> recorded minutes</span>
        <span><strong>{Math.round(calories)}</strong> active kcal · workouts + extras</span>
      </div>
      <details className="guidance-advice">
        <summary>View training & nutrition recommendations</summary>
        <div className="guidance-columns">
          <div><h4>Training & recovery</h4><ul>{guidance.training.map((text) => <li key={text}>{text}</li>)}</ul></div>
          <div><h4>Fuel & hydration</h4><ul>{guidance.nutrition.map((text) => <li key={text}>{text}</li>)}</ul></div>
        </div>
      </details>
      <p className="small-note">General sports guidance based on this day's plan and logs. Energy estimates are approximate; your nutrition targets stay unchanged.</p>
      <details className="guidance-sources">
        <summary>Recommendation sources</summary>
        <ul>{guidance.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul>
      </details>
    </section>
  );
}
