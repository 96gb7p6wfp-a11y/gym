# Setline V15 product review and changes

Reviewed 3 November 2026, from main `eb92334` (merged V14). The canonical user
origin remains `https://gym-kveq.vercel.app`. PR #1 stays open and untouched.
This is a scoped audit, not proof that every possible defect has been found.

## Evidence and priorities

[Ten public feedback sources and current official documentation](SETLINE_V15_USER_FEEDBACK.md)
identify historical-context friction, timer ambiguity, portability worries,
manual chart setup, and opaque workload recommendations. These are purposively
selected complaints, not a representative survey or current fault-rate ranking.
Older complaints are not represented as unfixed current defects.

Source review of V14 found concrete issues:

| Finding | Consequence | V15 response |
| --- | --- | --- |
| Overview and comparisons mostly fixed to 30 days | Long-term results hard to inspect | Training journey: 4 weeks / 12 weeks / all history; only metrics with actual data appear |
| Strength comparison selected the largest percentage gain per rep cohort, then sorted movements by gain | A rare successful set can dominate the headline | Select the most-observed fixed-rep cohort, deterministic ties; sort movements by name, retain declines; journey lets athlete select movement and rep count |
| Current plan applied to historical weekdays | Rescheduled sessions/changed plans can produce false adherence | Display actual completed gym days and workouts; historical adherence remains unknown |
| No exact point inspection on overview SVG | Hard to relate chart to original logs | Journey provides dated values/RIR, a source workout action, true calendar spacing, and explicit plotted range |
| Only eight manual jump entries rendered | Old mistakes and future-date typos become inaccessible | Progressive Show older entries exposes all saved measurements, including future entries for correction; future entries remain excluded from trends |
| Previous weight only available in some detail views | More taps before training | Date-specific workout preview displays the previous completed weighted set and source date, without changing prescription or starting a workout |
| Available update only discoverable deep in Settings | User unsure how to get a new version | You shows a quiet update-ready entry; activation continues through the same safe Settings controls |

## Results semantics and compatibility

The journey is read-only. It never writes plans, workouts, nutrition, preferences,
measurement records or a new schema. Active, deleted, future and repeated-ID
workouts do not inflate completed totals. Preparation-only sets are excluded from
working-set/load totals. Different rep counts, movement names, canonical IDs,
modes, measurement types and per-side settings remain separate. Assisted
pull-ups, bodyweight and distance-carry loads are not plotted as conventional
weighted strength. A recorded zero is retained; missing data is not filled in.

Lifting load is not a strength score; RIR and equipment/setup still matter. Jump
height and highest touch/standing and approach tests remain separate; video
estimates stay out of confirmed trends. Body weight uses sufficiently sampled
weekly averages from the chosen period, never profile weight as evidence of gain.
Weight gained is not labeled muscle gained. Workout volume describes completed
work and never proves a better athlete. Calendar gaps represent missing logs,
not inactivity, failure or a recovery diagnosis.

The app reads and displays V15 independently of the V13.1 training prescription.
No automatic new block, program upgrade, calorie change or data reset occurs.
The new view is a deferred local chunk included in service-worker precaching.

## Remaining opportunities and practical limits

- Per-equipment setup metadata is still mostly notes/name, rather than separate
  machine identifiers. Athlete should compare the same setup; kg is not universal
  across machines.
- Legacy Strength history still shows raw top weight and mixed-rep session data;
  the journey is the explicit fixed-rep comparison. V15 fixes weighted carries
  previously plotted as zero and omits missing values instead of inventing zero.
  Its caption explains that raw history is not a fitness or strength score.
- Multi-device accounts/sync and automatic durable cloud backups do not exist.
  File sharing/download cannot prove that the user kept an external copy.
- Jump correction uses access to the original entry, then explicit remove/re-log;
  a comprehensive reversible measurement-edit history remains future work.
- User's iPhone storage and actual workouts are not remotely available; no
  personal progress is fabricated. Physical iPhone audio/background behavior and
  battery/latency require device testing.
- No AI coach, social feed, points system, subscriptions or new runtime dependencies
  are added solely to imitate a mature product.

## Training plan review

The separate [V13.1 evidence-based review](V131_TRAINING_REVIEW.md) supports the
existing framework conditionally. The priority is combined volleyball, PE and gym
recovery, especially Tuesday evening to Wednesday lower-body and Friday double
sport load to Saturday. The plan itself is preserved. Current goals, training
experience, pain, sleep and actual logs remain necessary to personalize the review.

See `VALIDATION.md` for observed checks; implementation is not completion until
its type, unit, build and browser checks pass.
