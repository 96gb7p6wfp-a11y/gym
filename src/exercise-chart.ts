type ChartExercise = { mode: string; measurement?: string; logs: readonly { done:boolean; kg:number|null; reps:number|null; seconds:number|null; measurementCm?:number|null }[] };
const recorded = (value:unknown):value is number => typeof value==='number' && Number.isFinite(value) && value>=0;
/** Raw history displays recorded values; absent values must not become a zero observation. */
export function recordedExerciseChartValue(exercise:ChartExercise):number|null {
 const logs=exercise.logs.filter(log=>log.done);
 const values=logs.flatMap(log=>{
  const value=exercise.measurement?log.measurementCm:exercise.mode==='weight'?log.kg:exercise.mode==='timed'?log.seconds:log.reps;
  return recorded(value)?[value]:[];
 });
 if(!values.length)return null;
 return exercise.measurement||exercise.mode==='weight'?Math.max(...values):values.reduce((sum,value)=>sum+value,0);
}
