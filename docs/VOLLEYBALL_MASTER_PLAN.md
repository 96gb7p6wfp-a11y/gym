# Eight-week volleyball-first master plan

Activate in **More → Training plan → Use this plan**. Choose a Monday and select
the weeks with a Sunday match. No match is assumed. The program preserves the
previous weekly plan, historical sessions, measurements, meals, activities,
templates and preferences. **Return to saved plan** restores the previous week;
an active workout remains its own snapshot.

| Day | Main session | Additional scheduled work |
| --- | --- | --- |
| Monday | Upper Power A, 80–95 min | Optional curls and pushdowns |
| Tuesday | Volleyball, 20:00–22:00 Berlin | Separate 8–15 min approach technique primer |
| Wednesday | Main Jump + Heavy Lower A, 95–110 min | Main approach/force session |
| Thursday | Upper Power B, 70–85 min | Easy 5 km at conversational RPE 3–4; separate by hours if possible |
| Friday | Volleyball, 20:00–22:00 Berlin | School PE ~2 h, including high jump / shot put |
| Saturday, match week | Pre-Match Primer, 30–45 min | Only three approach jumps at ~80 / 90 / 95% |
| Sunday, match week | Match | Match time is unset; record actual duration |
| Saturday, no match | Reactive + Hard Lower B, 90–110 min | Readiness check after Friday's load |
| Sunday, no match | Recovery | Light mobility or walking |

The full movement list, per-side targets, RPE, cues, preparation and rest live in
the local plan module. Wednesday has 8 maximal approach jumps plus 6 CMJs in
the build weeks; the separate 8 hurdle contacts are not labelled maximal jumps.
Hack Squat and CMJ form one adjacent complex pair, with 150 seconds after each
movement. Rest can be extended. This is not a circuit.

Tuesday defaults to four 80–90% full approaches within the prescribed 4–6 range.
The final two are the filmed side-on reps, not two extra jumps. Optional pogos
default off; when enabled, two sets are prescribed and can be reduced to one.
The left-right-left example should be mirrored when appropriate for the athlete's
normal takeoff pattern. Optional arms also default off. The Ab Wheel prescription
uses three sets within the given 2–3 range. Copenhagen can be replaced with
Adductor Machine 2×10–15; the app does not add both.

## Phases and readiness

- Weeks 1–3: Build 1. Stable jump volume; strength follows clean reps and effort.
- Week 4: Deload. Strength sets reduce about 40–50% through discrete whole sets.
  Wednesday approach is 3×2 and CMJ 2×2. Non-match Saturday approach and drop
  jumps are each 2×2. Heavy legs/yellow removes hurdles.
- Weeks 5–7: Build 2. Return to base doses and progress quality and strength.
- Week 8: Peak/retest. Lower strength sets reduce about 40–50%. Wednesday
  approach becomes 2×2 and CMJ 2×2; non-match Saturday approach and drop jumps
  stay 2×2. Hurdles are omitted. Jump intensity stays high, contacts decrease.

Green keeps the prescribed session. Yellow reduces jump sets about 30–50%,
omits hurdles and removes pogo warm-up contacts; strength remains controlled
without overload suggestions. Red changes jump-containing gym work, including
the separate Tuesday primer, to recovery. Sharp or worsening pain, painful
movement or deteriorating landings is a stop signal. A self-reported readiness
choice is not a measured physiological score.

Saturday cannot start until readiness is chosen for that date. A check never
changes already logged work. Changing match weeks, phases, base exercises or
readiness affects only the next session snapshot. Base prescriptions stay
editable without permanently saving deload reductions. Match weekends have a
separate editable prescription. Reset restores this program's recommendations
while keeping the older saved week and recorded data.

## Logging and progress

Approach uses highest touch; CMJ uses jump height. These measurements remain
separate. The user's approximate reach/touch values appear only as an explanatory
reference inside Training rules; no historical tests are invented.

Suitcase Carry records load and metres per side. The optional `quantityUnit: "m"`
clarifies that the legacy `reps` number stores metres for this movement. Distance
is excluded from repetition volume, estimated 1RM and strength PRs. Carries added
from the library retain this unit. Changing a builder's logging mode clears it.
Holds use seconds. Assistance is not treated as added lifting weight; record the
assistance setup in workout notes and reduce it after clean 8/8/8. Choose a normal
pull-up when comparing unassisted performances.

Progression remains an explicit suggestion, never a weekly automatic increase.
The existing conservative system requires two comparable top-range sessions with
2+ RIR before a small load suggestion. A primer, low target RPE or reduced
readiness suppresses overload suggestions. Boxes never increase automatically.

Week 8 lists body weight, standing reach, standing vertical/CMJ, approach touch,
Hack Squat and pull-ups. Log weight/jumps in Progress, lift/reps in Train and
standing reach/test conditions in notes. Body-weight guidance considers gradual
gain alongside strength, jump and speed; calorie targets never change silently.

The easy run and PE are planned cues, not automatically completed workouts or
calorie expenditure. PE's approximate planned time informs Friday's fueling
guidance. Recognized recorded PE time replaces that portion of the planned PE
time in fueling guidance rather than being added twice. Log actual activity
separately once; do not double-count watch energy.
Match has an editable 90-minute duration placeholder because no actual duration
was supplied; it does not inherit club practice's 20:00 start time.

The storage key and backup version remain `setline.gym.v1` / version 1. Optional
program settings, the saved earlier week and match weekend round-trip in backups.
Malformed present settings reject atomically. Legacy profiles remain unchanged
until activation. Dates use calendar days across DST; the eight-week phase does
not automatically repeat after week 8.
