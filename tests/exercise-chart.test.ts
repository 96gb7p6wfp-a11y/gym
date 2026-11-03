import assert from 'node:assert/strict';
import test from 'node:test';
import {recordedExerciseChartValue} from '../src/exercise-chart.ts';
const log={done:true,kg:12.5,reps:20,seconds:null,measurementCm:null};
test('recorded weighted carry load remains decimal, a recorded zero remains zero, and missing is not zero',()=>{
 assert.equal(recordedExerciseChartValue({mode:'weight',logs:[log]}),12.5);
 assert.equal(recordedExerciseChartValue({mode:'weight',logs:[{...log,kg:0}]}),0);
 assert.equal(recordedExerciseChartValue({mode:'weight',logs:[{...log,kg:null}]}),null);
 assert.equal(recordedExerciseChartValue({mode:'weight',logs:[{...log,done:false}]}),null);
});
test('measurement and timed/repetition totals use only recorded completed values',()=>{
 assert.equal(recordedExerciseChartValue({mode:'bodyweight',measurement:'height',logs:[{...log,measurementCm:60},log]}),60);
 assert.equal(recordedExerciseChartValue({mode:'timed',logs:[{...log,seconds:15},{...log,seconds:20},log]}),35);
 assert.equal(recordedExerciseChartValue({mode:'timed',logs:[log]}),null);
 assert.equal(recordedExerciseChartValue({mode:'bodyweight',logs:[log,{...log,done:false}]}),20);
});
