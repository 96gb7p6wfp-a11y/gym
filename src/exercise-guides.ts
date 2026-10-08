export interface GuideExercise {
  key?: string;
  name: string;
  mode?: string;
  cue?: string;
  group?: string;
  target?: string;
}

export type LoadingCategory = 'strength' | 'control' | 'power' | 'core' | 'carry' | 'preparation' | 'recovery' | 'general';

export interface ExerciseLoadingGuidance {
  category: LoadingCategory;
  label: string;
  target?: string;
  advice: string;
  progression?: string;
}

export interface ExerciseGuideContent {
  steps: string[];
  feel: string;
  mistakes: string[];
  caution: string;
  demonstration: { label: string; url: string };
  isGeneric: boolean;
  loading: ExerciseLoadingGuidance;
}

type Technique = Pick<ExerciseGuideContent, 'steps' | 'feel' | 'mistakes' | 'caution'>;
const techniques = new Map<string, Technique>();

function normalizedName(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase()
    .replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
}

function register(names: string[], steps: string[], feel: string, mistakes: string[], caution: string): void {
  const technique = { steps, feel, mistakes, caution };
  for (const name of names) techniques.set(normalizedName(name), technique);
}

register(['Medicine Ball Spike Slam'], [
  'Stand balanced with a light slam ball; brace your trunk and lift the ball overhead.',
  'Drive the ball down in front of you with your trunk and arms, letting hips and knees bend.',
  'Let the ball settle, reset your stance and make the next rep fast.'
], 'A coordinated drive through the trunk, shoulders and arms; speed rather than a slow grind.', [
  'Arching the low back to reach higher.', 'Rushing repeated reps after power drops.'
], 'Use a ball designed for slams and a clear surface. Stay out of its rebound path.');

register(['Machine Chest Press / Bench Press'], [
  'Choose one variation. On the machine, set handles near mid-chest; on a bench, use a stable grip and planted feet.',
  'Keep your upper back supported and wrists over forearms; lower with elbows about 30–60° from the trunk.',
  'Press smoothly without lifting your shoulders or bouncing at the bottom.'
], 'Chest and triceps working; no pinch in the front of the shoulder.', [
  'Flaring elbows far outward.', 'Bouncing the bar or letting wrists fold backward.'
], 'For barbell bench press, use a competent spotter or properly set safety bars. Choose a pain-free depth.');

register(['Machine Chest Press'], [
  'Adjust the seat so the handles start around mid-chest; keep feet firmly supported.',
  'Hold a comfortable grip, with wrists aligned over forearms and your upper back against the pad.',
  'Press forward, then return slowly to a comfortable chest stretch.'
], 'Chest and triceps; steady pressure through both hands.', [
  'Shrugging or lifting your back off the pad.', 'Letting the handles pull the shoulders too far behind you.'
], 'Set the starting range before loading. Stop or shorten the range if the shoulder pinches.');

register(['Neutral-Grip Lat Pulldown'], [
  'Secure your thighs and take a neutral grip with arms overhead.',
  'Keep ribs controlled and pull elbows down toward your sides with only a small backward lean.',
  'Return the handle upward slowly and let the shoulder blades move naturally.'
], 'The sides of your back below the armpits, with help from the biceps.', [
  'Swinging the torso to move a heavy load.', 'Pulling the handle behind the neck.'
], 'Use a shoulder-friendly grip and pain-free overhead range. Do not force the handle to touch your chest.');

register(['Neutral-Grip Lat Pulldown / Pull-up'], [
  'Choose pulldown or pull-up and use a neutral grip. Secure your thighs for pulldowns or start from a controlled hang.',
  'Pull elbows toward your ribs; bring the handle toward the upper chest or raise your chest toward the pull-up handles.',
  'Lower with control. Use an assisted pull-up machine if needed to keep clean reps.'
], 'Lats along the sides of your back and biceps; no shoulder pinch.', [
  'Kicking or swinging to finish reps.', 'Craning the neck or pulling behind it.'
], 'Use a comfortable overhead range. Log pull-ups as bodyweight and keep the same variation for comparisons.');

register(['Chest-Supported Row'], [
  'Set the pad to support your chest with feet stable and arms reaching comfortably.',
  'Pull elbows back toward your hips or ribs while keeping your chest on the pad.',
  'Pause briefly, then reach forward slowly without rounding aggressively.'
], 'Mid-back and lats, with the back of the shoulders helping.', [
  'Lifting the chest off the pad to finish.', 'Shrugging or jerking the handles.'
], 'Choose a grip and elbow path that do not irritate your shoulders; keep your neck relaxed.');

register(['Incline Dumbbell Press'], [
  'Use a modest bench incline, about 15–30°, with feet planted and dumbbells above your chest.',
  'Lower with wrists aligned and elbows angled slightly in from the shoulders.',
  'Press up smoothly without clashing the dumbbells or losing upper-back support.'
], 'Upper chest, triceps and front shoulders.', [
  'Using a very steep angle when the aim is chest work.', 'Lowering farther than your shoulders comfortably allow.'
], 'Get help positioning heavy dumbbells. Use a controlled setup and a pain-free bottom position.');

register(['Cable Lateral Raise'], [
  'Stand stable beside a low cable, with a soft elbow bend and the handle in the far hand.',
  'Raise the arm slightly forward of directly sideways, toward shoulder height if comfortable.',
  'Lower slowly while keeping the trunk quiet.'
], 'The side of the shoulder; a light load should still be challenging.', [
  'Leaning or swinging to lift the cable.', 'Shrugging hard or forcing the arm above a comfortable range.'
], 'Do not force a thumbs-down position. Reduce the range or load if the shoulder pinches.');

register(['Reverse Pec Deck'], [
  'Set the seat so the handles are near shoulder height and support your chest on the pad.',
  'With soft elbows, open your arms wide while keeping your neck and ribs quiet.',
  'Return slowly without letting the stack slam.'
], 'Rear shoulders and upper back.', [
  'Pulling with a large elbow bend like a row.', 'Shrugging or leaning away from the pad.'
], 'Choose the grip and opening range that feel comfortable; do not force the arms behind the body.');

register(['Biceps Curl'], [
  'Stand or sit tall with wrists straight and elbows close to your sides.',
  'Bend the elbows to lift the weight without moving your upper arms far forward.',
  'Lower slowly through a comfortable elbow range.'
], 'The front of your upper arms, with forearms helping hold the weight.', [
  'Swinging from the hips or back.', 'Bending the wrists to finish the rep.'
], 'Choose a grip that feels comfortable at the elbow and wrist; avoid jerking at the bottom.');

register(['Triceps Pushdown'], [
  'Face a high cable with a stable stance; hold the handle and keep elbows near your sides.',
  'Straighten your elbows while keeping upper arms mostly still.',
  'Return slowly, allowing a comfortable elbow bend.'
], 'The back of your upper arms.', [
  'Rocking the body over the cable.', 'Letting elbows drift far forward on every rep.'
], 'Keep wrists comfortable and avoid slamming into elbow lockout. Use a load you can control.');

register(['Pallof Press'], [
  'Stand sideways to a chest-height cable or band with feet planted and knees soft.',
  'Hold the handle at your chest, brace gently and press straight forward without turning.',
  'Pause briefly, return to your chest and repeat on the other side.'
], 'Abdominals and sides of the trunk resisting rotation.', [
  'Twisting toward the anchor.', 'Arching the back or holding your breath throughout.'
], 'Start with light tension and keep breathing. Secure the band anchor before use.');

register(['Hack Squat'], [
  'Set the machine stops; place feet where heels stay supported and your back rests comfortably on the pad.',
  'Brace, unlock the carriage and bend hips and knees with knees following your toes.',
  'Push through the whole foot to stand; keep the return controlled.'
], 'Quadriceps and glutes; balanced pressure across each foot.', [
  'Letting heels lift or knees collapse inward.', 'Dropping deeper than you can control while the pelvis lifts off the pad.'
], 'Learn the machine safety catches first. Keep the planned reps in reserve and avoid painful depth.');

register(['Romanian Deadlift', 'RDL'], [
  'Stand with feet about hip-width, knees softly bent and weights close to your thighs.',
  'Brace and move your hips backward; slide the weights close to your legs until you feel a hamstring stretch.',
  'Push through the feet and bring the hips forward to stand tall without leaning back.'
], 'A stretch and effort in the hamstrings and glutes; the back holds position rather than driving the lift.', [
  'Squatting down instead of hinging back.', 'Reaching for the floor by rounding the back or letting weights drift forward.'
], 'Depth depends on your controlled hip range, not the floor. Reduce load if the low back takes over.');

register(['Bulgarian Split Squat'], [
  'Rest the rear foot on a stable low support; step the front foot far enough forward to balance.',
  'Lower mainly through the front leg with its knee following the toes and a small forward torso lean.',
  'Push through the front foot to rise; use a support for balance if needed.'
], 'Front-leg quads and glute; the rear leg provides balance.', [
  'Pushing strongly off the rear foot.', 'Using an excessively high rear support or letting the front knee collapse inward.'
], 'Start with bodyweight and a low support. A supported split squat is a useful easier option.');

register(['Leg Curl'], [
  'Adjust the machine so your knee joint lines up with its pivot and the roller sits above the heels.',
  'Keep hips supported as you bend your knees to curl the pad.',
  'Return slowly without letting the weight stack crash.'
], 'Hamstrings at the back of the thighs.', [
  'Lifting the hips or arching the back to finish.', 'Using a poorly aligned knee pivot or jerking the load.'
], 'Follow the machine setup instructions and choose a comfortable knee range.');

register(['Standing Calf Raise'], [
  'Stand with the balls of your feet supported and hold a stable support or machine handles.',
  'With knees softly extended, rise onto your toes without rolling the ankles outward.',
  'Lower slowly into a comfortable calf stretch and briefly pause.'
], 'The calf muscles, especially the larger upper calf.', [
  'Bouncing at the bottom.', 'Rolling onto the outer edge of the foot or shortening every rep.'
], 'Start on the floor if the step stretch is uncomfortable. Build load gradually, especially with Achilles symptoms.');

register(['Tibialis Raise'], [
  'Lean your upper back against a wall with feet a short distance forward and heels planted.',
  'Lift the toes toward your shins while keeping heels on the ground.',
  'Lower slowly; move feet closer to the wall to make it easier.'
], 'The front of the shins, not a sharp pain along the shin bone.', [
  'Lifting the heels.', 'Using momentum or an overly difficult stance.'
], 'Start with a small range and modest volume. Stop if shin pain increases.');

register(['Side Plank'], [
  'Place your elbow beneath your shoulder and stack your feet, or bend knees for an easier version.',
  'Lift the hips so head, trunk and legs form a steady line.',
  'Breathe normally and hold without rotating; repeat on the other side.'
], 'The side of the trunk and glutes, with the shoulder supporting you.', [
  'Letting hips sag or roll forward.', 'Placing the elbow far from the shoulder.'
], 'Use the bent-knee version if your shoulder or trunk cannot hold a comfortable position.');

register(['Medicine Ball Rotational Throw'], [
  'Stand sideways to an appropriate sturdy wall with a light throwing ball at your hip.',
  'Turn through hips and trunk, allowing the rear foot to pivot, and throw the ball into the wall.',
  'Wait for the rebound to settle, reset and repeat with full recovery.'
], 'Power transferred from legs and hips through the trunk to the arms.', [
  'Twisting only the low back with feet glued down.', 'Using a heavy ball that slows the throw.'
], 'Use a wall and ball approved for throws, clear the area and stay out of an unpredictable rebound.');

register(['Medicine Ball Overhead Throw / Slam'], [
  'Choose a slam or a throw into an approved target; start balanced with a light suitable ball.',
  'For a slam, raise the ball overhead and drive it down with trunk and arms. For a throw, drive legs and hips toward the target.',
  'Reset fully between reps so each effort stays explosive.'
], 'A fast whole-body drive through the legs, trunk and shoulders.', [
  'Overarching the low back overhead.', 'Turning power reps into a continuous fatigue circuit.'
], 'Use the correct ball for your variation and a clear target area. Do not throw toward people or fragile surfaces.');

register(['Landmine Press / Machine Shoulder Press'], [
  'Choose one variation. Secure the landmine anchor, or set the machine handles near shoulder level.',
  'Keep ribs over the pelvis and press along the landmine arc, or upward along the machine path.',
  'Let shoulder blades move naturally and lower slowly into a comfortable position.'
], 'Front shoulders and triceps, with the upper back helping control the shoulder blades.', [
  'Leaning backward or flaring the ribs.', 'Shrugging forcefully or pressing through a shoulder pinch.'
], 'Use a secure anchor and a pain-free range. Keep the same variation when comparing loads.');

register(['Face Pull', 'Light Face Pull'], [
  'Set a rope cable or secure band around face height and take a balanced stance.',
  'Pull toward your forehead, separating your hands and letting elbows travel outward comfortably.',
  'Return slowly while keeping your torso still.'
], 'Rear shoulders and upper back, without neck tension.', [
  'Leaning backward to move a heavy load.', 'Forcing elbows or shoulders into an uncomfortable high position.'
], 'Use a light, controlled load, especially in warm-up. Keep the rope clear of your face.');

register(['Cable External Rotation', 'Band / Cable External Rotation'], [
  'Set a cable or secure band near elbow height; keep your elbow bent about 90° beside your ribs.',
  'Rotate the forearm outward while the upper arm stays close to your side; a small towel can help.',
  'Return slowly within a comfortable range with very light resistance.'
], 'Small muscles at the back of the shoulder, rather than the neck.', [
  'Turning the whole torso instead of the shoulder.', 'Letting the elbow drift or using too much load.'
], 'Never force end-range rotation. Stop if the shoulder hurts; this is controlled practice, not a max-strength lift.');

register(['Hammer Curl'], [
  'Stand tall with palms facing inward and wrists aligned.',
  'Curl the weights without swinging, keeping upper arms near your sides.',
  'Lower slowly through a comfortable elbow range.'
], 'Front of the upper arms and the thumb-side forearms.', [
  'Swinging from the hips.', 'Bending wrists or moving elbows far forward to finish.'
], 'Use a load your elbows and wrists tolerate without pain.');

register(['Penultimate Step Drill'], [
  'Use your usual volleyball approach in a clear space and begin at slow speed.',
  'Practice a longer penultimate step followed by a quick plant, with arms moving back before the upward swing.',
  'Repeat smoothly, building speed while keeping the final steps coordinated.'
], 'A smooth transfer from forward movement into upward drive through the hips and legs.', [
  'Overstriding so far that balance or speed is lost.', 'Rushing the final steps before the arm swing is coordinated.'
], 'Practice submaximally first; use your usual approach side and ask a coach to check timing.');

register(['Approach Jump'], [
  'Use a consistent volleyball approach with enough clear space for take-off and landing.',
  'Plant the final steps, swing both arms upward and extend hips, knees and ankles to jump.',
  'Land softly with hips and knees bending, knees following toes; reset before the next rep.'
], 'A fast whole-body drive, with coordinated arms and legs rather than a long grind.', [
  'Landing stiff-legged or with knees collapsing inward.', 'Continuing maximal jumps after height or coordination drops.'
], 'Warm up first, allow full recovery and clear the landing area. Stop for pain or repeated unstable landings.');

register(['Pogo Jump', 'Easy Pogo'], [
  'Stand tall with feet under your hips, knees soft and a clear, level landing surface.',
  'Make small vertical bounces mainly through the ankles, using a light knee bend.',
  'Keep contacts brief and controlled; warm-up pogos stay low and easy.'
], 'Elastic work through the calves and ankles; light, rhythmic ground contacts.', [
  'Turning each bounce into a deep squat.', 'Jumping too high or landing with locked knees.'
], 'Start with low bounces and short sets. Stop if the Achilles, feet or knees become painful.');

register(['Arm-Swing Jump'], [
  'Stand balanced and make a small hip-and-knee dip while swinging arms back.',
  'Drive the arms upward as hips, knees and ankles extend together.',
  'Land softly, regain balance and reset before the next jump.'
], 'Arms and legs working in one smooth upward drive.', [
  'Swinging the arms after the legs have already pushed off.', 'Landing rigidly or chasing reps after timing deteriorates.'
], 'Keep the area clear and rest between high-quality reps. Do not continue through painful landings.');

register(['Countermovement Jump'], [
  'Stand tall and use a consistent arm position for repeated measurements.',
  'Make a quick controlled dip, then immediately drive upward through hips, knees and ankles.',
  'Land with soft knees and hips, regain balance and rest before repeating.'
], 'A rapid stretch-and-drive through the legs; a crisp take-off rather than a deep slow squat.', [
  'Pausing at the bottom or changing dip depth every rep.', 'Stiff landings or continuing when jump quality falls.'
], 'Use the same test method and arm position for comparisons. Record jump height, not highest reach.');

register(['Broad Jump'], [
  'Stand behind a line in a clear area; swing arms back as hips and knees bend.',
  'Drive forward and upward with both legs, swinging arms forward.',
  'Land on both feet with hips and knees bending, hold balance and reset.'
], 'Glutes, quadriceps and calves driving the body forward.', [
  'Reaching so far forward that the landing is unstable.', 'Landing with locked knees or knees collapsing inward.'
], 'Use a non-slip surface with room beyond the landing. Prioritize a controlled landing over distance.');

register(['Copenhagen Plank'], [
  'Place your forearm under your shoulder and support the top knee on a stable low bench for the easier version.',
  'Lift the hips into a straight side-plank position, keeping the pelvis level.',
  'Hold briefly while breathing, lower with control and repeat on the other side.'
], 'Inner thigh of the supported leg and the side of the trunk.', [
  'Starting with a long straight-leg lever before you can control the short lever.', 'Letting hips sag or twisting through the trunk.'
], 'Begin with short holds and the knee-supported version. Stop for groin pain; the straight-leg version is demanding.');

register(['Volleyball practice'], [
  'Build from easy movement to shoulder, ankle and jump preparation before hard drills.',
  'Keep approach and landing technique controlled; use both hips and knees to absorb landings.',
  'Take water breaks and reduce intensity when coordination or jump quality drops.'
], 'Whole-body effort with fast legs and coordinated trunk and arm movement.', [
  'Starting full-effort jumps before warming up.', 'Ignoring fatigue or repeatedly landing with poor control.'
], 'Follow your team coach’s instructions and stop for pain, dizziness or repeated unstable landings.');

register(['Easy walk'], [
  'Choose a safe route and a comfortable walking pace.',
  'Use relaxed arm movement and natural steps without deliberately overstriding.',
  'Keep the effort easy enough to speak in full sentences.'
], 'Gentle leg movement and easy breathing; this should feel restorative.', [
  'Turning a recovery walk into a hard cardio session.', 'Pushing through worsening foot or joint pain.'
], 'Wear comfortable footwear and adjust the distance to how your legs feel.');

register(['Ankle, hip & thoracic mobility'], [
  'Move through gentle knee-to-wall ankle rocks, supported 90/90 hip switches and upper-back rotations.',
  'Use small, slow ranges while keeping breathing relaxed.',
  'Repeat both sides without forcing a joint into a painful position.'
], 'Gentle movement or mild muscle stretch around the ankles, hips and upper back.', [
  'Forcing range or bouncing into end positions.', 'Using low-back twisting to substitute for hip or upper-back movement.'
], 'Mobility should stay comfortable. Use support and reduce range if a joint feels pinched.');

register(['Ankle Knee-to-Wall'], [
  'Face a wall in a short split stance with the front foot pointing comfortably forward.',
  'Move the front knee toward the wall, following the toes while keeping the heel down.',
  'Return smoothly and adjust foot distance so each rep stays controlled.'
], 'A gentle stretch in the calf or ankle movement, without a sharp front-ankle pinch.', [
  'Lifting the heel to reach farther.', 'Letting the arch collapse or knee drop inward.'
], 'Stay within a comfortable range; do not force through an ankle pinch.');

register(['Leg Swings'], [
  'Hold a stable support and stand tall on the supporting leg.',
  'Swing the free leg gently forward and back, then sideways, with a small soft knee bend.',
  'Build the range gradually while keeping the trunk stable.'
], 'Gentle movement through the hips and a light stretch around the thighs.', [
  'Using big uncontrolled kicks.', 'Arching or twisting the low back to make the swing larger.'
], 'Keep space clear and use support. Range is optional; control matters more.');

register(['Walking Lunge + Rotation'], [
  'Step forward into a comfortable lunge with the front knee following its toes.',
  'Keep your pelvis steady and rotate the upper trunk gently toward the front leg.',
  'Return to center, step through and alternate sides.'
], 'Front-leg glute and quadriceps, with gentle upper-back rotation.', [
  'Taking a narrow tightrope stance and losing balance.', 'Twisting the knee or forcing rotation through the low back.'
], 'Use a shorter step or stationary supported lunge if balance is difficult.');

register(['90/90 Hip Switch'], [
  'Sit with both knees bent in a comfortable 90/90 position; place hands behind you for support.',
  'Rotate both knees toward the other side, letting the hips move through a manageable range.',
  'Pause and switch back slowly without forcing the knees to the floor.'
], 'Gentle rotation and stretch around the hips, not pressure inside the knees.', [
  'Forcing a knee down to reach a textbook angle.', 'Moving quickly through a pinched hip position.'
], 'Use hand support and adjust knee angles. Stop if the hip or knee feels painful.');

register(['Bodyweight Squat'], [
  'Stand with a comfortable foot width and toe angle, keeping the whole foot grounded.',
  'Bend hips and knees together, letting knees follow toes as you lower under control.',
  'Rise by pushing through both feet without bouncing.'
], 'Quadriceps and glutes; even pressure through the feet.', [
  'Letting heels lift or knees collapse inward.', 'Forcing a deeper position than you can control.'
], 'Use a support or squat to a bench if needed. Knee travel past the toes can be normal when comfortable.');

register(['Progressive Jumps'], [
  'Start with small jumps at about half effort after easy movement and ankle preparation.',
  'Increase toward moderate then near-full effort only while take-off and landing stay controlled.',
  'Pause between jumps and finish the warm-up feeling ready, not tired.'
], 'Increasingly quick leg drive with soft, balanced landings.', [
  'Going straight to maximal effort.', 'Adding many reps until the warm-up becomes fatiguing.'
], 'Do not progress if landings are painful or unstable; keep room clear around you.');

register(['Wall Slide'], [
  'Stand facing a wall with forearms resting against it and feet a little back.',
  'Slide your arms upward as far as comfortable, allowing the shoulder blades to rotate.',
  'Lower slowly while keeping ribs over your pelvis.'
], 'Gentle shoulder movement and work around the shoulder blades.', [
  'Arching the low back to reach higher.', 'Forcing the arms overhead through a pinch.'
], 'Use a smaller range if the shoulders are stiff; there is no need to press every body part flat to the wall.');

register(['Thoracic Rotation'], [
  'Start on hands and knees, or side-lying with knees bent, keeping the hips supported.',
  'Rotate gently through the upper trunk, following the movement with your eyes.',
  'Return slowly and repeat both sides with relaxed breathing.'
], 'Gentle movement across the upper and mid-back.', [
  'Moving the pelvis or arching the low back to gain range.', 'Forcing the shoulder to the floor.'
], 'Stay within an easy range and avoid twisting into back or shoulder pain.');

register(['Light Pulldown / Press'], [
  'Set up the same pulldown and press variations you will use in the workout.',
  'Start with a light load and smooth reps through a comfortable range.',
  'Add load gradually over warm-up sets without tiring yourself.'
], 'The working muscles beginning to engage, without a hard pump or grind.', [
  'Skipping from no load straight to the working weight.', 'Taking warm-up sets near failure.'
], 'Use the relevant pulldown or press setup and check machine safety before increasing load.');

register(['Light Squat / Hinge Warm-up'], [
  'Practice an easy squat and hip hinge using the setup of your planned lifts.',
  'Keep feet stable, knees following toes in squats and weights close to your legs in hinges.',
  'Increase the load gradually while keeping reps controlled and well short of fatigue.'
], 'Quads and glutes in squats; hamstrings and glutes in hinges.', [
  'Using warm-up sets as hard working sets.', 'Adding load before the movement feels controlled.'
], 'Use comfortable ranges and the machine safety catches when relevant; no extra jumping is needed.');

register(['Gastrocnemius Stretch'], [
  'Face a wall in a split stance and place your hands on it for support.',
  'Keep the rear knee straight but not forced and the rear heel grounded as you lean forward.',
  'Hold a gentle stretch while breathing, then change sides.'
], 'The upper calf of the rear leg.', [
  'Lifting the rear heel.', 'Bouncing or forcing the ankle into discomfort.'
], 'Use a mild stretch only; stop if the Achilles or ankle hurts.');

register(['Soleus Stretch'], [
  'Face a wall in a short split stance with hands supported.',
  'Bend the rear knee gently while keeping its heel down and knee following the toes.',
  'Hold a comfortable stretch, breathe and repeat on the other side.'
], 'The lower calf of the rear leg.', [
  'Lifting the rear heel.', 'Collapsing the arch or forcing the knee inward.'
], 'Do not push through an ankle pinch or Achilles pain.');

register(['Hip Flexor Stretch'], [
  'Kneel on a padded surface with the other foot planted in front; hold support if needed.',
  'Gently tuck the pelvis and squeeze the kneeling-side glute, then shift forward a little.',
  'Keep ribs controlled and breathe before changing sides.'
], 'The front of the hip on the kneeling side, without low-back pressure.', [
  'Arching the low back instead of moving at the hip.', 'Lunging forward aggressively.'
], 'Pad the knee or use a standing split stance if kneeling is uncomfortable.');

register(['Hamstring Stretch'], [
  'Rest one heel on a low support, with a soft knee and the other foot stable.',
  'Hinge forward gently from the hips without chasing your toes.',
  'Hold a mild back-of-thigh stretch and breathe; repeat on the other side.'
], 'A gentle stretch along the back of the thigh.', [
  'Rounding the back aggressively to reach farther.', 'Locking the knee hard or bouncing.'
], 'Stop for tingling, numbness or sharp pain; do not treat nerve sensations as a stretch to push through.');

register(['Glute Stretch'], [
  'Lie on your back with knees bent and cross one ankle over the opposite thigh.',
  'Keep the crossed foot relaxed but supported and gently bring the supporting thigh toward you.',
  'Hold a mild stretch with your head and back comfortable, then change sides.'
], 'The buttock and outer hip of the crossed leg.', [
  'Pushing hard on the crossed knee.', 'Pulling so far that the low back or knee becomes uncomfortable.'
], 'Reduce the range or leave the supporting foot on the floor if your hip or knee is irritated.');

register(['Lat Stretch'], [
  'Place hands on a stable bench or wall and step back into a comfortable hip hinge.',
  'Let the chest lower gently between the arms while keeping ribs controlled.',
  'Breathe into a mild stretch without forcing the shoulders.'
], 'The sides of the upper back and below the armpits.', [
  'Overarching the low back.', 'Forcing overhead shoulder range.'
], 'Choose a lower arm position or shorter range if the shoulders pinch.');

register(['Pec Stretch'], [
  'Place a forearm on a doorway with the elbow at or slightly below shoulder height.',
  'Step or turn the body gently away until a mild chest stretch appears.',
  'Hold while breathing and repeat on the other side.'
], 'The chest near the front of the shoulder, without joint pain.', [
  'Forcing the arm far behind you.', 'Shrugging or arching the back to increase the stretch.'
], 'Use a lower elbow position if needed. Stop for shoulder pain, tingling or numbness.');

type LoadingAdvice = Omit<ExerciseLoadingGuidance, 'target'>;
const loadingAdvice = new Map<string, LoadingAdvice>();
const controlledProgression = 'When every set reaches the top of your rep range with clean technique and about 2 good reps left, add the smallest available weight increment.';

function registerLoading(names: string[], advice: LoadingAdvice): void {
  for (const name of names) loadingAdvice.set(normalizedName(name), advice);
}

registerLoading([
  'Hack Squat', 'Romanian Deadlift', 'RDL', 'Bulgarian Split Squat',
  'Machine Chest Press / Bench Press', 'Machine Chest Press', 'Incline Dumbbell Press',
  'Neutral-Grip Lat Pulldown', 'Neutral-Grip Lat Pulldown / Pull-up', 'Chest-Supported Row',
  'Landmine Press / Machine Shoulder Press',
], {
  category: 'strength', label: 'Challenging load, clean reps',
  advice: 'Use a challenging load within your saved rep range. Control every rep and finish with about 2 good reps left; heavier does not mean rushing.',
  progression: controlledProgression,
});

registerLoading([
  'Cable Lateral Raise', 'Reverse Pec Deck', 'Biceps Curl', 'Hammer Curl', 'Triceps Pushdown',
  'Face Pull', 'Leg Curl', 'Standing Calf Raise', 'Tibialis Raise',
], {
  category: 'control', label: 'Control first',
  advice: 'Choose a manageable load or difficulty for your saved reps, with a comfortable full range and no swinging, bouncing or shortened reps. Keep about 2 good reps left.',
  progression: controlledProgression,
});

registerLoading(['Cable External Rotation'], {
  category: 'control', label: 'Very light shoulder work',
  advice: 'Use very light resistance and slow, smooth reps. Keep the elbow still; reduce the load if your torso or neck takes over.',
  progression: controlledProgression,
});

registerLoading(['Medicine Ball Spike Slam', 'Medicine Ball Rotational Throw', 'Medicine Ball Overhead Throw / Slam'], {
  category: 'power', label: 'Light and fast',
  advice: 'Use a light ball that lets each rep stay fast. Reset and recover between efforts; stop the set when speed or coordination drops.',
});

registerLoading(['Approach Jump', 'Pogo Jump', 'Arm-Swing Jump', 'Countermovement Jump', 'Broad Jump'], {
  category: 'power', label: 'Fast take-off, controlled landing',
  advice: 'Keep jumps at bodyweight and follow the saved reps or time. Recover between efforts; stop when speed, jump height or landing quality drops.',
});

registerLoading(['Penultimate Step Drill'], {
  category: 'power', label: 'Coordination before speed',
  advice: 'Practice coordinated steps at bodyweight, then build speed. Reset between reps and stop before timing or balance deteriorates.',
});

registerLoading(['Pallof Press', 'Side Plank', 'Copenhagen Plank'], {
  category: 'core', label: 'Steady posture and breathing',
  advice: 'Use a difficulty that lets you keep posture and breathe for your saved reps or time. End the set when posture slips; build control before adding resistance.',
});

registerLoading(['Farmer Carry', 'Farmer’s Carry', "Farmer's Carry", 'Farmers Carry', 'Suitcase Carry', 'Farmer Walk'], {
  category: 'carry', label: 'Steady steps and posture',
  advice: 'Use a load you can carry for the saved time or distance without leaning or losing grip. Walk steadily and end the set when posture or grip slips.',
});

registerLoading([
  'Band / Cable External Rotation', 'Light Face Pull', 'Wall Slide', 'Thoracic Rotation',
  'Light Pulldown / Press', 'Light Squat / Hinge Warm-up', 'Ankle Knee-to-Wall', 'Leg Swings',
  'Walking Lunge + Rotation', '90/90 Hip Switch', 'Bodyweight Squat', 'Easy Pogo', 'Progressive Jumps',
], {
  category: 'preparation', label: 'Prepare without fatigue',
  advice: 'Stay light and comfortable. Build range or speed gradually, follow your saved target and finish feeling ready for training rather than tired.',
});

registerLoading([
  'Easy walk', 'Ankle, hip & thoracic mobility', 'Gastrocnemius Stretch', 'Soleus Stretch',
  'Hip Flexor Stretch', 'Hamstring Stretch', 'Glute Stretch', 'Lat Stretch', 'Pec Stretch',
], {
  category: 'recovery', label: 'Easy recovery',
  advice: 'Keep the effort easy and stretches gentle for your saved time. Breathe normally; extra load or pushing into discomfort is unnecessary.',
});

registerLoading(['Volleyball practice'], {
  category: 'power', label: 'Practice quality',
  advice: 'Follow your team coach’s session. Take water breaks and reduce effort when approach timing, coordination or landing quality drops.',
});

/** Use the current name and target, never a retained key or a blanket heavy/low-rep rule. */
export function getExerciseLoadingGuidance(exercise: GuideExercise): ExerciseLoadingGuidance {
  const saved = loadingAdvice.get(normalizedName(exercise.name));
  const target = exercise.target?.trim() || undefined;
  // A custom timed version of a lift needs duration advice, not rep-range progression.
  if (exercise.mode === 'timed' && saved && ['strength', 'control'].includes(saved.category)) {
    return {
      category: 'general', label: 'Controlled timed effort', target,
      advice: 'Use an easy-to-control load for your saved duration. Keep breathing and end the set when posture or technique changes; do not use rep-range progression for timed sets.',
    };
  }
  if (exercise.mode === 'bodyweight' && saved && ['strength', 'control'].includes(saved.category)) {
    return {
      ...saved, target,
      advice: 'Choose a bodyweight variation you can control through your saved reps, without swinging or shortening the range. Keep about 2 good reps left.',
      progression: 'Once every set reaches the top of your rep range with clean technique and about 2 good reps left, try a slightly harder variation.',
    };
  }
  return {
    ...(saved ?? {
      category: 'general', label: 'Learn the movement first',
      advice: 'Start with light effort and confirm technique with a qualified coach. Follow your saved reps, time or distance; keep control before adding difficulty.',
    }),
    target,
  };
}

/** Name matching deliberately ignores saved keys: a renamed movement needs new instructions. */
export function getExerciseGuide(exercise: GuideExercise): ExerciseGuideContent {
  const name = exercise.name.trim() || 'this exercise';
  const technique = techniques.get(normalizedName(name));
  const loading = getExerciseLoadingGuidance(exercise);
  const demonstration = {
    label: 'Find a video demonstration',
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercise technique`)}`,
  };
  if (technique) return { ...structuredClone(technique), demonstration, loading, isGeneric: false };

  const cue = exercise.cue?.trim();
  return {
    steps: [
      'This custom exercise does not have movement-specific instructions yet; confirm its setup and technique with a qualified coach.',
      ...(cue ? [`Your saved cue: ${cue}`] : []),
      'Start with light effort, use a comfortable controlled range and keep breathing.'
    ],
    feel: 'The intended working muscles depend on this movement; do not use pain or a strong burn as proof of correct technique.',
    mistakes: ['Adding load before learning the movement.', 'Copying a different exercise because its name or equipment looks similar.'],
    caution: 'Stop for sharp pain, dizziness or loss of control. The search link is a starting point; check that the demonstration matches your exercise.',
    demonstration,
    loading,
    isGeneric: true,
  };
}
