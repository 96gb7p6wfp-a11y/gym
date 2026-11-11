import { findLibraryExercise, type LibraryExercise } from './exercise-library.ts';
import { getSpecificLibraryTechnique } from './exercise-technique-content.ts';

export interface GuideExercise {
  exerciseId?: string;
  key?: string;
  name: string;
  mode?: string;
  cue?: string;
  group?: string;
  target?: string;
  preparationOnly?: boolean;
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
  demonstration: { label: string; url: string; kind: 'search' | 'unavailable' | 'verified' };
  research: { query: string; googleUrl: string; youtubeSearchUrl: string; precision: 'canonical' | 'unconfirmed' };
  displayName: string;
  instructions: { equipment: string; setup: string; movement: string; keyCue: string; avoid: string; purpose: string };
  isAmbiguous?: boolean;
  diagram?: 'overhead-slam' | 'forward-throw' | 'drop-jump';
  techniqueReference?: { label: string; url: string };
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

register(['Medicine Ball Spike Slam', 'Light Medicine Ball Spike Slam', 'Two-Hand Medicine Ball Overhead Slam', 'Two-Handed Medicine Ball Overhead Slam', 'Medicine Ball Slam'], [
  'Use a 2–3 kg slam ball in an approved clear area; stand balanced, brace and lift it overhead with both hands.',
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
  'Adjust the seat so the handles start around mid-chest; plant the feet and support your upper back on the pad.',
  'Press the handles forward, then return slowly to a comfortable chest stretch without lifting from the pad.',
  'Keep each wrist aligned over its forearm and the shoulders supported.'
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

register(['Biceps Curl', 'Dumbbell Biceps Curl'], [
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

register(['Pogo Jump', 'Easy Pogo', 'Light Pogos'], [
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

register(['Progressive Jumps', 'Jump Ramp-Up'], [
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

register(['Cross-Body Shoulder Stretch'], [
  'Bring one arm across your chest, a little below shoulder height.',
  'Support the upper arm with the other hand and ease it closer without twisting your trunk.',
  'Keep the shoulder relaxed, breathe and switch sides.'
], 'A gentle stretch behind the shoulder, without a pinch at the front.', [
  'Shrugging or pulling hard on the elbow.', 'Turning the whole body instead of easing the arm across.'
], 'Keep the pull light. Reduce the range or stop if the shoulder pinches or feels painful.');

register(['Biceps Stretch'], [
  'Stand tall with one arm straight and low beside your hip.',
  'Ease the arm slightly behind you without rolling the shoulder forward.',
  'Hold a mild stretch with a comfortable wrist, breathe and switch sides.'
], 'Gentle tension along the front of the upper arm, not inside the shoulder.', [
  'Forcing the arm high behind the body.', 'Overstretching the wrist or locking the elbow hard.'
], 'Use a small range with no pulling force. Stop for shoulder pain, tingling or numbness.');

register(['Triceps Stretch'], [
  'Raise one arm only as far overhead as comfortable, then bend the elbow.',
  'Let the hand rest toward your upper back while keeping ribs over your pelvis.',
  'Breathe into a gentle stretch, then lower the arm and switch sides.'
], 'A mild stretch along the back of the upper arm.', [
  'Arching the low back to reach overhead.', 'Pulling hard on the elbow or forcing the hand lower.'
], 'Skip the overhead position if it pinches. Do not force the shoulder or elbow into more range.');

register(['Standing Quad Stretch'], [
  'Hold a stable support and gently bring one heel toward your buttock.',
  'Hold the ankle if reachable; keep the knees close and gently tuck your pelvis.',
  'Stand tall, breathe and switch sides without pulling hard.'
], 'A gentle stretch across the front of the bent-leg thigh.', [
  'Arching the low back or pulling the heel forcefully.', 'Twisting the knee or losing balance to reach the ankle.'
], 'Use support throughout. Choose another comfortable quad stretch if reaching the ankle causes knee pain.');

register(['Adductor Stretch'], [
  'Stand in a comfortable wide stance and hold a stable support.',
  'Shift gently toward one side with that knee bent; keep the other knee soft and foot grounded.',
  'Pause at mild inner-thigh tension, breathe and change sides.'
], 'A gentle inner-thigh stretch on the straighter leg.', [
  'Dropping into a deep side lunge before you can control it.', 'Letting the bent knee collapse inward or bouncing.'
], 'Keep the stance shallow and supported. Stop for groin or knee pain; a stronger stretch is unnecessary.');

register(['Arm Circles'], [
  'Stand comfortably with arms reaching out a little below shoulder height.',
  'Make small, smooth circles and gradually widen them within an easy range.',
  'Change direction while keeping your neck relaxed and ribs controlled.'
], 'Easy shoulder movement with light work around the shoulder blades.', [
  'Swinging rapidly into a large circle.', 'Shrugging or arching the low back to gain range.'
], 'Use smaller circles or lower the arms if needed. Do not circle through a shoulder pinch.');

register(['Unloaded Hip Hinge'], [
  'Stand with soft knees and place your hands at the crease of your hips.',
  'Send your hips backward while keeping the trunk steady and feet planted.',
  'Stop at gentle hamstring tension, then bring the hips forward to stand tall.'
], 'A light stretch in the hamstrings, with the glutes helping you stand.', [
  'Turning the hinge into a deep squat.', 'Rounding the back or leaning backward at the top.'
], 'Use no added load. Keep the range small if needed and stop if the low back becomes painful.');

register(['Light Rehearsal Sets'], [
  'Use the setup and technique guide for your next strength exercise.',
  'Begin unloaded or with an easy load and rehearse a few controlled reps.',
  'Increase gradually toward your working weight while staying well short of fatigue.'
], 'The intended muscles engaging without a hard pump, strain or grind.', [
  'Treating rehearsal sets as extra hard working sets.', 'Increasing load before the setup and movement feel controlled.'
], 'Check equipment safety and use the next exercise’s comfortable range. Do not take warm-up sets to failure.');

register(['Easy Walk + Arm Swing'], [
  'Walk at an easy pace in a clear space with relaxed shoulders.',
  'Let both arms swing naturally with your steps; avoid forcing them overhead.',
  'Build warmth gradually while keeping conversation comfortable.'
], 'Gentle movement through the legs and shoulders with easy breathing.', [
  'Turning the warm-up into a hard conditioning effort.', 'Forcing a large arm swing or deliberately overstriding.'
], 'Keep the route clear and choose a comfortable pace. Stop if pain or dizziness develops.');

register(['Easy Walk + Breathing'], [
  'Walk slowly on a clear, level route after your session.',
  'Relax the shoulders and let your breathing settle naturally.',
  'Keep the effort easy; finish without adding extra conditioning.'
], 'Gentle leg movement and breathing that gradually feels easier.', [
  'Speeding up to turn the cool-down into another workout.', 'Forcing deep breaths or holding the breath.'
], 'Adjust the pace to how you feel. Stop and seek help for unusual chest pain, faintness or severe breathlessness.');

register(['90/90 Breathing'], [
  'Lie comfortably on your back with feet supported on a wall or bench and hips and knees bent.',
  'Exhale gently and let the ribs settle without pressing the back flat.',
  'Take easy breaths with relaxed shoulders; avoid straining or holding your breath.'
], 'Gentle rib movement and easy breathing, without neck or low-back tension.', [
  'Forcing a maximal inhale or a long breath hold.', 'Arching the back or tensing the neck to move more air.'
], 'Adjust the leg support for comfort. Return to normal breathing and sit up slowly if you feel light-headed.');

register(['Short-Foot', 'Short-Foot Hold'], [
  'Stand or sit with the heel, big-toe base and little-toe base resting on the floor.',
  'Gently draw the ball of the foot toward the heel to lift the arch slightly.',
  'Keep the toes long and relaxed, hold briefly and release.'
], 'Light work through the arch, with all three contact points still grounded.', [
  'Curling the toes or gripping the floor.', 'Rolling onto the outer foot to make the arch look higher.'
], 'Start seated if balance is difficult. Keep the effort gentle and relax if the foot cramps or hurts.');

register(['Single-arm Neutral-grip Dumbbell Shoulder Press'], [
  'Sit supported or stand balanced; hold one dumbbell beside the shoulder with the palm facing inward.',
  'Keep ribs over pelvis and press through a comfortable overhead range without leaning or twisting.',
  'Lower smoothly, then repeat the same load and reps on the other side.'
], 'Shoulder and triceps working, with the trunk resisting a sideways lean.', [
  'Arching or rotating to finish the press.', 'Forcing the shoulder through a painful range.'
], 'Use a load you can position safely and leave 2–3 clean reps in reserve. Reduce pressing if the shoulder remains sore after volleyball.');

register(['Light Dumbbell Squat Jump'], [
  'Rehearse at bodyweight first. When landings are consistent, hold light dumbbells at your sides in a clear space.',
  'Use a comfortable shallow countermovement and drive upward as fast as possible.',
  'Land softly under control, settle completely and reset before the next jump.'
], 'A quick coordinated upward drive; light resistance should preserve a crisp takeoff.', [
  'Adding weight when jump height, speed or coordination falls.', 'Rushing repeated jumps before controlling each landing.'
], 'Start around 2–4 kg per hand only when technically appropriate. Record the combined dumbbell load, so 2 kg in each hand is 4 kg total. Omit this work after unusually demanding volleyball or if landings deteriorate.');

register(['Pallof Press Isometric Hold'], [
  'Stand side-on to a secure chest-height cable or band, with feet planted and knees soft.',
  'Brace gently, press the handle straight in front of the chest and hold without rotating.',
  'Keep breathing through the planned hold, return the handle and repeat on the other side.'
], 'Abdominals and sides of the trunk resisting rotation, with easy breathing.', [
  'Twisting toward the anchor or leaning away from it.', 'Holding the breath or arching the lower back.'
], 'Use light tension that allows the full 20-second hold with steady posture. Secure a band anchor and stop if control is lost.');

register(['Split-squat Jump'], [
  'Start at bodyweight in a balanced split stance with a clear landing area.',
  'Drive upward, then land in the same stance with a soft knee and steady pelvis.',
  'Settle and reset before each rep; complete the same low-volume target on both legs.'
], 'A coordinated front-leg push with the hips and trunk controlling the landing.', [
  'Adding load before landings are controlled.', 'Chasing more contacts when height or balance falls.'
], 'Follow the saved low-volume prescription per leg; do not add contacts automatically. Stop for pain, unstable landings or lost coordination.');

register(['Plyometric Push-up', 'Explosive Push-up'], [
  'Use a stable push-up setup with hands under or slightly wider than the shoulders and trunk braced.',
  'Lower under control, then push upward fast enough to release the hands if appropriate; no clap is needed.',
  'Land with soft elbows, re-establish a steady trunk and reset before the next rep.'
], 'A quick coordinated push through chest, triceps and shoulders without a shoulder pinch.', [
  'Clapping or lifting higher at the expense of landing control.', 'Continuing when pressing speed or shoulder comfort declines.'
], 'Use a simpler push-up or medicine-ball chest pass if unfamiliar. Omit ballistic pressing when shoulders are sore or fatigued.');

register(['Push-up Plus'], [
  'Choose a comfortable push-up position, using an incline if needed to keep a straight trunk.',
  'Perform a controlled push-up, then gently push the floor farther away at the top so the shoulder blades move around the ribs.',
  'Return the shoulder blades smoothly without shrugging or letting the lower back sag.'
], 'Serratus activity along the sides of the ribs and smooth shoulder-blade movement.', [
  'Shrugging toward the ears rather than moving the shoulder blades around the ribs.', 'Sagging through the lower back or forcing excessive rounding.'
], 'Keep the range pain-free and use an incline to reduce effort if needed. This is controlled shoulder work rather than a maximal push-up test.');

register(['Snap-down Landing'], [
  'Stand tall with feet in a comfortable athletic stance and arms raised if comfortable.',
  'Quickly lower into a shallow ready position without leaving the floor.',
  'Keep knees tracking with toes, settle quietly and stand up before repeating.'
], 'A brief coordinated brace through hips, legs and trunk while settling into a stable stance.', [
  'Adding a jump before basic landing control is consistent.', 'Letting the knees collapse inward or dropping too deep.'
], 'Use a comfortable depth and stop for joint pain or unstable mechanics. The purpose is preparation, not impact or fatigue.');

register(['Low-box Drop Jump', 'Drop Jump'], [
  'Use a stable box around 15–20 cm with a clear landing area; step-down landing practice comes first if unfamiliar.',
  'Step off without jumping upward, meet the floor under control and rebound vertically with a quick contact.',
  'Land softly, settle and rest fully before the next attempt.'
], 'A quick elastic rebound through the ankles and legs with a controlled final landing.', [
  'Jumping up from the box or chasing a taller box.', 'Continuing when contact slows or landing mechanics deteriorate.'
], 'Box height never increases automatically. Use step-down landings without a rebound until control is reliable; omit reactive jumping for painful or unstable landings.');

register(['Step-down Landing'], [
  'Use a stable low step around 15–20 cm and a clear landing area.',
  'Step off without jumping upward, then land softly on both feet with knees tracking over the toes.',
  'Hold the landing until balanced, stand up and reset; do not rebound.'
], 'Hips and legs absorbing the landing while the trunk stays steady.', [
  'Starting from a high box before basic control is reliable.', 'Bouncing immediately instead of holding a stable landing.'
], 'Choose a lower step or a floor-based snap-down if needed. Stop if the knees, Achilles or back hurt or the landing is unstable.');

register(['Light Dynamic Mobility'], [
  'Start with easy walking or gentle movement in a clear space.',
  'Move shoulders, hips and ankles through a comfortable range, keeping breathing relaxed.',
  'Gradually include the shapes needed for today, then finish feeling ready rather than tired.'
], 'Easy movement through the shoulders, hips and ankles without strain or heavy breathing.', [
  'Forcing a range or bouncing into discomfort.', 'Making the short preparation so demanding that it creates fatigue.'
], 'Stay within a pain-free range. This is low-intensity preparation, not stretching into pain or a conditioning test.');

register(['Slow L-R-L Rhythm', 'Slow L-R-L Approach Rhythm'], [
  'Use your normal approach pattern; mirror the left-right-left example if your takeoff pattern differs.',
  'Rehearse slowly, then build speed into a slightly longer penultimate and quick final plant.',
  'Reset between short repetitions, keeping the drill coordinated and low fatigue.'
], 'A smooth acceleration and controlled lowering into a quick, balanced plant.', [
  'Forcing a foot pattern that does not match your approach.', 'Rushing the drill before rhythm and balance are controlled.'
], 'This is optional technique practice. Skip it when volleyball already provides substantial jumping; do not add maximal contacts to chase fatigue.');

register(['Trap Bar Deadlift'], [
  'Rehearse a controlled hinge first, then stand centered in the 20 kg empty trap bar with feet planted and handles balanced.',
  'Brace, keep arms long and push the floor away so hips and shoulders rise together.',
  'Stand tall without leaning back, then lower the bar under control and reset.'
], 'Glutes, thighs and trunk sharing the work, with a steady back position.', [
  'Increasing load before setup and movement are consistently controlled.', 'Adding this lift on top of Leg Press instead of replacing it.'
], 'Ask a qualified coach to check technique if unfamiliar. Practice with the empty 20 kg bar first; only after consistent movement quality should 3 × 4–6 replace Leg Press. No trap-bar jumps are required.');

// V9 adds explicit speed, agility and timed stability work. These instructions
// explain the saved prescription; they never insert sets or fabricate timings.
register(['5 m Acceleration', '5 m Acceleration Sprint', '10 m Acceleration', '10 m Acceleration Sprint'], [
  'Mark the prescribed distance on a clear, non-slip lane with extra unobstructed space to decelerate.',
  'Start in a balanced forward-ready position and push the ground away through the first few steps.',
  'Accelerate through the marked distance, slow down safely and recover fully before the next effort.'
], 'A coordinated first-step drive with clean foot contacts, rather than exhaustion.', [
  'Sprinting between gym machines, people or other obstacles.', 'Rushing the next effort or comparing times taken with different methods.'
], 'If the gym has no safe lane and stopping space, move the block to a suitable hall or outdoor area, or omit it. Record elapsed time only when actually measured; never infer a sprint result from the planned distance.');

register(['Lateral Shuffle → Plant → Accelerate', 'Lateral Shuffle, Plant and Accelerate'], [
  'Use a clear non-slip area and shuffle approximately 2–3 metres without crossing the feet.',
  'Plant under control with the knee following the foot, then accelerate approximately 3–5 metres.',
  'Decelerate with room to spare, reset and complete the saved dose on both sides.'
], 'A balanced lateral push, stable plant and controlled first acceleration steps.', [
  'Making aggressive cuts around machines or on slippery flooring.', 'Letting the knee collapse or continuing when foot placement becomes unstable.'
], 'Use a suitable court, hall or outdoor area with stopping space. Omit or reduce the block if a safe area is unavailable or pain, tendon symptoms or unstable plants appear.');

register(['Split-Step Reaction Drill', 'Split Step Reaction Drill'], [
  'Stand in a balanced ready position in a clear, non-slip area.',
  'Make a small split step and respond to an unpredictable left or right cue with controlled footwork.',
  'Return to a balanced start and reset before the next saved reaction.'
], 'A brief ready movement followed by a clean directional response, without large jumps.', [
  'Following a predictable alternating pattern instead of reacting.', 'Rushing into obstacles or treating every response as an uncontrolled maximal cut.'
], 'Use a partner or optional randomized audio cues. A cue is only a direction aid, not a measured reaction-time test. Keep the area clear and stop for pain or loss of control.');

register(['Standing Calf Isometric Hold'], [
  'Use a stable support and rise to a comfortable mid-range heel position with the knees softly straight.',
  'Hold the heel position steady for the prescribed seconds while breathing normally.',
  'Lower under control and rest before repeating.'
], 'A steady calf contraction and controlled forefoot pressure without sharp tendon pain.', [
  'Bouncing or allowing the heels to drift through the hold.', 'Holding the breath or using more load than posture allows.'
], 'Choose a comfortable effort and record any external load separately from duration. Stop for sharp pain, worsening Achilles symptoms or loss of ankle control.');

register(['DB Suitcase Carry / Static Hold', 'Dumbbell Suitcase Hold', 'DB Suitcase Static Hold'], [
  'Stand tall with one dumbbell beside the body and ribs stacked over the pelvis.',
  'Hold still, or walk slowly in a clear area if prescribed, without leaning toward or away from the load.',
  'Keep breathing and match the saved duration on both sides.'
], 'The sides of the trunk and grip resisting a sideways pull while posture stays steady.', [
  'Recording a 30-second hold as 30 repetitions or metres.', 'Leaning, shrugging or continuing after posture or grip slips.'
], 'The V9 prescription uses seconds. Record optional external load separately, keep breathing and stop for increasing pain or loss of control. A static hold is valid when no safe walking area is available.');

register(['Cable External-Rotation Isometric', 'Cable External Rotation Isometric'], [
  'Set light outward cable or band tension with the elbow supported close to the ribs.',
  'Hold a comfortable shoulder position without turning the trunk or shrugging.',
  'Breathe through the prescribed seconds, release smoothly and switch sides.'
], 'Moderate, controlled tension around the shoulder rotators, without a joint pinch.', [
  'Using excessive resistance and rotating the torso to maintain the hold.', 'Treating cuff preparation as maximal strength work or holding the breath.'
], 'Use moderate controlled effort. Reduce resistance or stop for increasing shoulder pain; the aim is a steady hold rather than maximal loading.');

register(['Pull-ups / Assisted Pull-ups', 'Pull-Up / Assisted Pull-Up', 'Pull-up'], [
  'Choose a comfortable grip and enough assistance to keep the prescribed repetitions controlled.',
  'Start with a steady trunk, draw the elbows down and pull through a comfortable range without swinging.',
  'Lower under control and reset before the next repetition.'
], 'Back and elbow-flexor effort with controlled shoulder-blade movement.', [
  'Kicking or swinging to complete the last repetitions.', 'Comparing added-load and assisted-machine numbers as the same loading configuration.'
], 'Keep the assistance or added-load setup identifiable for comparison. Leave the saved RIR and stop for shoulder or elbow pain; assistance is not body weight lifted.');

register(['Incline Machine Chest Press', 'Incline Machine Press', 'Low-Incline Chest Press', 'Low-Incline Machine Press'], [
  'Adjust the seat and handles for a comfortable incline pressing path, with the upper back supported.',
  'Lower under control, then press strongly without lifting the back or shrugging.',
  'Return through the same comfortable range while keeping the saved repetitions in reserve.'
], 'Chest, shoulders and triceps sharing the press without a shoulder pinch.', [
  'Arching or sliding away from the support to move more weight.', 'Forcing a deep range that changes shoulder comfort or control.'
], 'Use the same machine setup for strength comparisons. Build with lighter sets before demanding work; progress only when all working sets meet the saved rep and RIR targets.');

register(['Single-Arm DB Shoulder Press'], [
  'Hold one dumbbell in a comfortable grip and set the trunk tall with ribs over the pelvis.',
  'Press through a comfortable overhead range without leaning or rotating.',
  'Lower under control and match the saved dose on the other side.'
], 'Shoulder and triceps effort with the trunk resisting unwanted side bend.', [
  'Leaning back or rotating to finish the press.', 'Using a painful overhead range or adding unmatched repetitions on one side.'
], 'Keep approximately the saved 2 RIR. Record the working dumbbell weight, not both arms combined; reduce load or range if shoulder comfort changes.');

register(['Leg Press'], [
  'Set a stable foot position and keep the pelvis and upper back supported by the machine.',
  'Lower with control only as far as the hips and knees remain comfortable and supported.',
  'Press through the whole foot with strong intent, without locking the knees hard.'
], 'Quads and glutes producing force while the torso remains supported.', [
  'Lowering until the pelvis rolls away from the pad.', 'Bouncing out of the bottom or shortening every rep to move more weight.'
], 'Use lighter ramp-up sets before working sets and set the machine safeties. Compare the same machine and configuration; stop for increasing joint pain.');

register(['Smith Bulgarian Split Squat', 'Smith Machine Bulgarian Split Squat'], [
  'Set the Smith safeties and use a low stable rear-foot support with a balanced front-foot position.',
  'Lower under control, keeping most pressure through the front leg and the knee following the foot.',
  'Drive up without pushing off the rear foot, then match the saved dose on both sides.'
], 'Front-leg quadriceps and glute effort with steady hips and trunk.', [
  'Using a high rear support or pushing off the rear leg.', 'Chasing load while knee control or balance deteriorates.'
], 'Rehearse lightly first, use the machine safeties and leave the saved RIR. Reduce range or stop for pain or unstable movement.');

register(['Hip Thrust Machine'], [
  'Adjust the pad and foot position so the hips can move comfortably with stable feet.',
  'Brace lightly and extend the hips through the glutes without arching the lower back.',
  'Pause under control, then lower smoothly before the next repetition.'
], 'Glute effort through hip extension with the ribs and pelvis controlled.', [
  'Finishing by overextending the lower back.', 'Bouncing off the bottom or letting the feet lose contact.'
], 'Use easy rehearsal sets before demanding loading, keep breathing and follow the saved RIR. Stop for increasing back or hip pain.');

register(['Seated Calf Raise'], [
  'Set the thigh pad comfortably with bent knees and the forefeet securely supported.',
  'Lower the heels slowly through a comfortable range, then rise without bouncing.',
  'Pause briefly with steady ankle alignment before the next controlled repetition.'
], 'Bent-knee calf effort, especially through the soleus, without sharp tendon pain.', [
  'Bouncing rapidly through the bottom position.', 'Rolling the ankles outward or shortening the range as fatigue rises.'
], 'Build load gradually and keep the saved repetitions in reserve. Stop or reduce the range if calf or Achilles symptoms worsen.');

register(['Arm-Swing Timing Drill'], [
  'Stand in a clear area and coordinate a relaxed backward arm swing with a small controlled lowering.',
  'Swing the arms forward and up as you extend, keeping the feet grounded for the home rehearsal.',
  'Reset and repeat the saved low-fatigue dose rather than chasing height.'
], 'Coordinated trunk, leg extension and arm timing without a hard jump.', [
  'Adding maximal indoor jumps to a timing drill.', 'Rushing repetitions before the arm and foot rhythm is coordinated.'
], 'Use this as technique practice, not a fatigue circuit. Keep ceilings, obstacles and flooring clear; omit extra work when practice already included the same drill.');

register(['Full Approach Rehearsal'], [
  'Use a clear area and rehearse your familiar three-step takeoff pattern at submaximal speed.',
  'Link the penultimate step, plant and arm swing smoothly, staying grounded when practising at home.',
  'Reset fully before each of the saved rehearsals.'
], 'A coordinated approach rhythm and balanced plant, rather than fatigue or maximal height.', [
  'Turning a short technique rehearsal into maximal jumping.', 'Practising fast approaches near furniture, machines or slippery flooring.'
], 'A home rehearsal does not require takeoff. Use an appropriate court for any submaximal jump; skip optional technique if practice already covered it.');

register(['Ankle and Hip Mobility'], [
  'Start with comfortable supported ankle rocks, keeping the heel down.',
  'Move the hips gently through a comfortable range without forcing the knees or lower back.',
  'Keep breathing easily and finish within the saved preparation time.'
], 'Comfortable ankle and hip movement without increasing fatigue.', [
  'Forcing a painful end range or bouncing into a stretch.', 'Turning short match preparation into demanding conditioning.'
], 'Keep the effort easy and stop movements that increase pain. The primer dose is enough; extra mobility is optional, not another mandatory workout.');

register(['Volleyball match'], [
  'Prepare with your team in an appropriate court area before competition.',
  'Follow the match and coaching demands while adjusting relevant painful or unstable work.',
  'Afterward record actual duration, exertion and jump exposure if known.'
], 'Variable competition effort; playing time and recorded exposure determine the actual workload.', [
  'Automatically recording a planned match as completed.', 'Treating missing jump counts or match time as measured zero.'
], 'A scheduled match does not establish actual minutes or contacts. Do not add a gym workout or maximal jump session to make up for uncertain playing time.');

register(['Bodyweight Squat + Hinge'], [
  'Rehearse comfortable bodyweight squats with the whole foot planted and knees tracking over the toes.',
  'Then soften the knees and send the hips back through an unloaded hinge, without rounding the back.',
  'Keep the saved short dose smooth and easy before adding load at the actual lift.'
], 'Comfortable movement through quads, hips and hamstrings without fatigue.', [
  'Forcing squat depth or rounding through the hinge.', 'Turning a light rehearsal into challenging working sets.'
], 'Use a comfortable range with no added load. Stop increasing pain; specific lighter loading sets follow only at the prescribed lift and within your guidance.');

register(['Light Throwing Rehearsal'], [
  'Check an approved, clear throwing area and choose a light ball designed for the intended task.',
  'Rehearse the path of the prescribed throw or two-handed overhead slam at easy speed.',
  'Reset fully and build speed gradually only while coordination and comfort remain steady.'
], 'A coordinated shoulder and trunk movement, rather than fatigue or maximal loading.', [
  'Starting with a heavy ball or rushing repeated throws.', 'Restoring ballistic work that was removed from the current prescription.'
], 'Use only when the throw remains prescribed within your recorded guidance. Keep the short rehearsal easy and stop for increasing shoulder or trunk symptoms.');

register(['Easy Defensive Footwork'], [
  'Check a clear non-slip area with no machines, people or obstacles in the movement path.',
  'Rehearse short shuffles and balanced plants slowly, keeping the knees aligned with the feet.',
  'Reset between movements and build speed only later if the main session still prescribes it.'
], 'Easy coordinated steps and balanced plants without significant fatigue.', [
  'Making aggressive cuts before warming up.', 'Using a slippery or obstructed area just to finish the drill.'
], 'Keep this rehearsal easy. Move to a suitable location or omit faster agility work if the space is unsafe, and stop for painful or unstable movement.');

const v9TechniqueAliases: Record<string, string> = {
  'Medicine-Ball Overhead Spike-Pattern Slam': 'Medicine Ball Spike Slam',
  'Medicine-Ball Rotational Wall Throw': 'Medicine Ball Rotational Throw',
  'Medicine Ball Rotational Wall Throw': 'Medicine Ball Rotational Throw',
  'Maximal Three-Step Approach Jump': 'Approach Jump',
  'Low Drop Jump, 15–20 cm': 'Drop Jump',
  'Low Drop Jump (15–20 cm)': 'Drop Jump',
  'CMJ with Arm Swing': 'Arm-Swing Jump',
  'Pallof Isometric Hold': 'Pallof Press Isometric Hold',
  'Three-Step L-R-L Rhythm': 'Slow L-R-L Rhythm',
  'Penultimate-Step + Plant Rehearsal': 'Penultimate Step Drill',
  'Controlled Approach Footwork': 'Slow L-R-L Rhythm',
  'Easy Dynamic Movement': 'Light Dynamic Mobility',
  'Light Shoulder Activation': 'Band Pull-apart',
  'Relaxed Walking': 'Easy walk',
  'Easy Upper-Body Movement': 'Easy Walk + Arm Swing',
  'Easy Walk or Bike': 'Easy Walk + Arm Swing',
  'Light External Rotation': 'Cable External Rotation',
  'Dynamic Hip Mobility': '90/90 Hip Switch',
  'Landing + Progressive Jump Preparation': 'Jump Ramp-Up',
  'Easy Walk + Comfortable Mobility': 'Easy Walk + Breathing',
};
for (const [name, source] of Object.entries(v9TechniqueAliases)) {
  const technique = techniques.get(normalizedName(source));
  if (technique) techniques.set(normalizedName(name), technique);
}

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

registerLoading(['Medicine Ball Spike Slam', 'Light Medicine Ball Spike Slam', 'Medicine Ball Rotational Throw', 'Medicine Ball Overhead Throw / Slam'], {
  category: 'power', label: 'Light and fast',
  advice: 'Start around 2–3 kg using an approved clear area and a ball designed for the task. Keep each rep fast; reset and recover, and stop when speed or coordination drops. Omit ballistic shoulder work when sore or fatigued.',
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
  'Arm Circles', 'Unloaded Hip Hinge', 'Light Rehearsal Sets', 'Easy Walk + Arm Swing', 'Short-Foot', 'Jump Ramp-Up',
], {
  category: 'preparation', label: 'Prepare without fatigue',
  advice: 'Stay light and comfortable. Build range or speed gradually, follow your saved target and finish feeling ready for training rather than tired.',
});

registerLoading([
  'Easy walk', 'Ankle, hip & thoracic mobility', 'Gastrocnemius Stretch', 'Soleus Stretch',
  'Hip Flexor Stretch', 'Hamstring Stretch', 'Glute Stretch', 'Lat Stretch', 'Pec Stretch',
  'Cross-Body Shoulder Stretch', 'Biceps Stretch', 'Triceps Stretch', 'Standing Quad Stretch', 'Adductor Stretch', 'Easy Walk + Breathing',
], {
  category: 'recovery', label: 'Easy recovery',
  advice: 'Keep the effort easy and stretches gentle for your saved time. Breathe normally; extra load or pushing into discomfort is unnecessary.',
});

registerLoading(['90/90 Breathing'], {
  category: 'recovery', label: 'Easy breathing',
  advice: 'Use a comfortable supported position and follow your saved breaths. Breathe gently without forcing, straining or adding resistance.',
});

registerLoading(['Volleyball practice'], {
  category: 'power', label: 'Practice quality',
  advice: 'Follow your team coach’s session. Take water breaks and reduce effort when approach timing, coordination or landing quality drops.',
});

registerLoading(['Single-arm Neutral-grip Dumbbell Shoulder Press'], {
  category: 'control', label: 'Controlled single-arm strength',
  advice: 'Use a comfortable neutral grip and leave 2–3 reps in reserve. Match load and reps across sides; log the weight of the working dumbbell.',
  progression: 'Build clean sets before considering the smallest load increase. Reduce pressing after a demanding match or if the shoulder remains sore.',
});
registerLoading(['Light Dumbbell Squat Jump'], {
  category: 'power', label: 'Speed before load',
  advice: 'Bodyweight first. If technically appropriate, begin around 2–4 kg per hand and log both dumbbells combined. Keep the prescribed low contact count and stop if takeoff or landing quality drops.',
});
registerLoading(['Split-squat Jump', 'Plyometric Push-up', 'Explosive Push-up', 'Low-box Drop Jump', 'Drop Jump'], {
  category: 'power', label: 'Quality before more contacts',
  advice: 'Follow the prescribed low-volume work and recover fully. Do not automatically add reps, load or box height; stop when movement speed or landing control deteriorates.',
});
registerLoading(['Pallof Press Isometric Hold', 'Push-up Plus'], {
  category: 'core', label: 'Steady control and breathing',
  advice: 'Keep the planned time or reps comfortable and controlled. Breathe normally and finish before posture changes; extra load is unnecessary when control is inconsistent.',
});
registerLoading(['Snap-down Landing', 'Step-down Landing'], {
  category: 'preparation', label: 'Own the landing first',
  advice: 'Use low effort and a controllable range or low step. Settle completely between reps; do not add rebounds or contacts to chase fatigue.',
});
registerLoading(['Light Dynamic Mobility', 'Short-Foot Hold', 'Slow L-R-L Rhythm', 'Slow L-R-L Approach Rhythm', 'Light Pogos'], {
  category: 'preparation', label: 'Prepare without fatigue',
  advice: 'Stay low effort and follow the short prescribed dose. Skip optional contacts when fatigued or uncomfortable; finish ready for volleyball rather than tired.',
});
registerLoading(['Dumbbell Biceps Curl'], {
  category: 'control', label: 'Controlled arm work',
  advice: 'Keep the upper arm steady and use controlled reps with 1–2 reps in reserve. Avoid swinging or shortening the range to finish.',
  progression: controlledProgression,
});
registerLoading(['Trap Bar Deadlift'], {
  category: 'control', label: 'Technique before load',
  advice: 'Practice the unloaded hinge, then the 20 kg empty trap bar. A coach can check your setup and brace. Add load gradually only after movement quality is consistent.',
  progression: 'Once proficient, use 3 × 4–6 in place of Leg Press, never in addition to it. Do not automatically increase weight or prescribe trap-bar jumps.',
});

registerLoading(['5 m Acceleration', '5 m Acceleration Sprint', '10 m Acceleration', '10 m Acceleration Sprint'], {
  category: 'power', label: 'Distance and speed quality',
  advice: 'Follow the saved distance in metres and recover fully. Use an unobstructed lane with safe deceleration space; move the block to a suitable location or omit it if unavailable. Elapsed time is optional and must be actually measured with a consistent method.',
});
registerLoading(['Lateral Shuffle → Plant → Accelerate', 'Lateral Shuffle, Plant and Accelerate', 'Split-Step Reaction Drill', 'Split Step Reaction Drill'], {
  category: 'power', label: 'Quality footwork before fatigue',
  advice: 'Keep the prescribed short reactions and full rest in a clear, non-slip area. Stop for pain, unstable plants or declining control. Direction cues aid practice; they do not establish measured reaction speed.',
});
registerLoading(['Standing Calf Isometric Hold', 'Cable External-Rotation Isometric', 'Cable External Rotation Isometric', 'Pallof Isometric Hold'], {
  category: 'core', label: 'Timed control and breathing',
  advice: 'Hold for the saved seconds with steady posture and normal breathing. Use controlled, comfortable resistance; duration and optional external load are separate. Stop for increasing pain or lost control.',
});
registerLoading(['DB Suitcase Carry / Static Hold', 'Dumbbell Suitcase Hold', 'DB Suitcase Static Hold'], {
  category: 'carry', label: 'Time with steady posture',
  advice: 'Use the saved seconds per side, not a repetition or distance target. Record the working dumbbell separately, keep the trunk tall and breathe normally. End the hold if grip or posture slips.',
});
registerLoading(['Pull-ups / Assisted Pull-ups', 'Pull-Up / Assisted Pull-Up', 'Pull-up'], {
  category: 'control', label: 'Clean pulling with saved effort',
  advice: 'Use assistance or added load that allows the saved rep target with the prescribed RIR. Keep the same setup for comparisons and avoid swinging.',
  progression: 'Only consider a small added-load increase or less assistance after every working set reaches the top of the saved rep range at the prescribed RIR with consistent technique.',
});
registerLoading(['Incline Machine Chest Press', 'Incline Machine Press', 'Low-Incline Chest Press', 'Low-Incline Machine Press', 'Leg Press', 'Smith Bulgarian Split Squat', 'Smith Machine Bulgarian Split Squat', 'Hip Thrust Machine', 'Seated Calf Raise'], {
  category: 'control', label: 'Demanding, controlled working sets',
  advice: 'Use the saved sets, repetitions and RIR; warm up with lighter loading first. Keep the same equipment and movement setup for comparisons, with no automatic increase.',
  progression: 'Increase only after every working set reaches the top of the prescribed rep range at the saved RIR with consistent technique. Choose the smallest practical equipment increment.',
});
registerLoading(['Single-Arm DB Shoulder Press'], {
  category: 'control', label: 'Controlled single-arm strength',
  advice: 'Keep approximately the saved 2 RIR and match controlled repetitions on both sides. Record the working dumbbell, keep the ribs steady and stop for increasing shoulder pain.',
  progression: 'Consider the smallest load increase only when every working set meets the saved rep and RIR targets with consistent technique.',
});
registerLoading(['Arm-Swing Timing Drill', 'Full Approach Rehearsal'], {
  category: 'preparation', label: 'Coordination without fatigue',
  advice: 'Follow the saved short technique dose at submaximal speed. A home rehearsal can stay grounded; do not add maximal indoor jumps. Skip this optional routine if volleyball practice already included it.',
});
registerLoading(['Easy Defensive Footwork', 'Bodyweight Squat + Hinge', 'Light Throwing Rehearsal', 'Light External Rotation'], {
  category: 'preparation', label: 'Rehearse without fatigue',
  advice: 'Keep the saved short preparation easy and controlled. Use the cleared space and movements remaining in the prescription; gradual rehearsal does not add working sets or measured performance results.',
});
registerLoading(['Ankle and Hip Mobility'], {
  category: 'preparation', label: 'Easy mobility',
  advice: 'Use the saved short duration and comfortable movement. Do not force a range or turn pre-match preparation into a fatiguing session.',
});
registerLoading(['Volleyball match'], {
  category: 'power', label: 'Actual match exposure',
  advice: 'Playing time, effort and jump exposure vary. Record what actually happened; a planned duration or missing count is not a measured result.',
});
for (const [name, source] of Object.entries(v9TechniqueAliases)) {
  if (loadingAdvice.has(normalizedName(name))) continue;
  const advice = loadingAdvice.get(normalizedName(source));
  if (advice) loadingAdvice.set(normalizedName(name), advice);
}

function libraryLoadingAdvice(movement: LibraryExercise | undefined): LoadingAdvice | undefined {
  if (!movement) return undefined;
  if (['Power', 'Plyometric', 'Speed'].includes(movement.category)) return {
    category: 'power', label: 'Quality before fatigue',
    advice: 'Follow the saved short dose and recovery. Use a suitable clear area; stop when speed, coordination or landing quality drops. Do not automatically add load, contacts or box height.',
  };
  if (['Mobility', 'Stability', 'Recovery'].includes(movement.category)) return {
    category: movement.category === 'Recovery' ? 'recovery' : 'preparation', label: 'Controlled movement',
    advice: 'Follow the saved reps or seconds with comfortable effort and normal breathing. Finish before posture or symptoms worsen; this is not a maximal loading test.',
  };
  if (movement.category === 'Core') return { category: 'core', label: 'Steady trunk control',
    advice: 'Choose a difficulty that lets you hold the described trunk position and breathe through your saved reps or time. Stop when that position changes.',
  };
  if (movement.category === 'Sport') return { category: 'power', label: 'Record actual activity',
    advice: 'Record the duration and exposure you actually performed. Planned activity is not a completed record or proof of recovery.',
  };
  return { category: movement.category === 'Strength' ? 'strength' : 'control', label: 'Follow your saved effort target',
    advice: 'Use your saved repetition range, effort target and rest. Keep the described range consistent rather than lifting more by changing the movement.',
    progression: 'Consider the smallest practical increase only after every working set reaches the top of its range at the prescribed effort with consistent technique. Do not invent missing RIR.',
  };
}

/** Use the current name and target, never a retained key or a blanket heavy/low-rep rule. */
export function getExerciseLoadingGuidance(exercise: GuideExercise): ExerciseLoadingGuidance {
  const target = exercise.target?.trim() || undefined;
  if (exercise.preparationOnly) return {
    category: 'preparation', label: 'Easy preparation within your guidance', target,
    advice: 'Keep this saved preparation dose easy and controlled, with normal breathing. Do not add heavy straining, maximal jumps or ballistic work removed by your recorded guidance.',
  };
  if (exercise.mode === 'timed' && /^(?:5|10) m acceleration(?: sprint)?$/i.test(exercise.name.trim())) return {
    category: 'power', label: 'Saved timed drill', target,
    advice: 'This older record uses its saved duration. It does not establish a measured 5 m or 10 m sprint result. Keep the original log; V9 distance work and separately measured sprint tests use their own units and timing methods.',
  };
  const saved = loadingAdvice.get(normalizedName(exercise.name)) ?? libraryLoadingAdvice(findLibraryExercise({ name: exercise.name }));
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
  // Names are deliberate here: a retained ID/key must not teach an unrelated
  // movement after a custom rename. Recognized catalogue aliases remain useful.
  const namedTechnique = techniques.get(normalizedName(name));
  const movement = findLibraryExercise({ name }) ?? (namedTechnique && exercise.exerciseId ? findLibraryExercise(exercise.exerciseId) : undefined);
  const detail = movement ? getSpecificLibraryTechnique(movement.id) : undefined;
  const specific: Technique | undefined = detail && movement ? {
    steps: [detail.setup, detail.movement, detail.cue], feel: movement.muscles.join(' · '),
    mistakes: [detail.avoid, movement.mistakes[1] ?? 'Continuing after the intended technique changes.'],
    caution: movement.precautions?.join(' ') || 'Use the described setup and a manageable effort. Stop for sharp pain, dizziness or loss of control; keep breathing.',
  } : undefined;
  const technique = namedTechnique ?? specific ?? (movement ? techniques.get(normalizedName(movement.name)) : undefined);
  const loading = getExerciseLoadingGuidance(exercise);
  const choices = new Map([
    ['Medicine Ball Overhead Throw / Slam', 'This saved label includes different release directions. Choose a two-hand downward slam, overhead forward throw or backward throw; they are separate exercises.'],
    ['Medicine Ball Scoop Toss', 'This saved label does not specify forward or rotational release. Choose the exact toss you actually perform before using a demonstration or comparing results.'],
    ['Landmine Press / Machine Shoulder Press', 'Choose the secured-bar landmine press or the seated machine shoulder press. Their equipment, path and working loads are different.'],
    ['Machine Chest Press / Bench Press', 'Choose the seated machine chest press or barbell bench press. Their equipment, safety setup and working loads are different.'],
    ['Neutral-Grip Lat Pulldown / Pull-up', 'Choose the seated pulldown or neutral-grip pull-up. Their loading and assistance are different.'],
    ['Rope Triceps Extension', 'This saved label does not say overhead or downward. Choose a rope triceps pushdown or overhead cable extension to match what you actually perform.'],
  ].map(([key, value]) => [normalizedName(key), value]));
  const choice = choices.get(normalizedName(name));
  const searchNames: Record<string, string> = {
    'spike-slam': 'two hand medicine ball overhead floor slam',
    'medicine-ball-overhead-forward-throw': 'two hand medicine ball overhead forward throw',
    'medicine-ball-overhead-backward-throw': 'medicine ball overhead backward throw',
    'medicine-ball-rotational-scoop-toss': 'rotational medicine ball scoop wall toss',
    'landmine-press': 'standing single arm landmine press',
    'half-kneeling-landmine-press': 'half kneeling single arm landmine press',
    'drop-jump': 'low box drop jump step off immediate vertical rebound',
    'external-rotation': 'standing cable external rotation elbow at side',
  };
  const searchName = movement && searchNames[movement.id] || name;
  // Google uses the precise catalogue variation, never a misleading historical
  // alias. Existing assigned YouTube URLs retain their original identity.
  const canonicalSearchNames: Record<string, string> = { ...searchNames,
    'lateral-raise': 'standing single arm cable lateral raise',
    'chest-row': 'chest supported row machine chest pad',
  };
  const canonicalSearchName = movement && (canonicalSearchNames[movement.id] || movement.name) || name;
  const researchQuery = choice ? `${name} exercise variations correct form differences`
    : `${canonicalSearchName} correct form demonstration`;
  const research: ExerciseGuideContent['research'] = {
    query: researchQuery,
    googleUrl: `https://www.google.com/search?q=${encodeURIComponent(researchQuery)}`,
    youtubeSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(researchQuery)}`,
    precision: movement && !choice ? 'canonical' : 'unconfirmed',
  };
  const demonstration: ExerciseGuideContent['demonstration'] = choice
    ? { kind: 'unavailable', label: 'Choose an exact variation first', url: '' }
    : { kind: 'search', label: 'Search video technique', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${searchName} exercise technique`)}` };
  const cue = exercise.cue?.trim();
  const fallback: Technique = {
    steps: [
      'This custom exercise does not have movement-specific instructions yet; confirm its setup and technique with a qualified coach.',
      ...(cue ? [`Your saved cue: ${cue}`] : []),
      'Start with light effort, use a comfortable controlled range and keep breathing.'
    ],
    feel: 'The intended working muscles depend on this movement; do not use pain or a strong burn as proof of correct technique.',
    mistakes: ['Adding load before learning the movement.', 'Copying a different exercise because its name or equipment looks similar.'],
    caution: 'Stop for sharp pain, dizziness or loss of control. The search link is a starting point; check that the demonstration matches your exercise.',
  };
  const chosen = choice ? {
    steps: ['Check which variation this saved choice refers to before starting.', choice, 'Keep the same actual variation, equipment and units when comparing future performances.'],
    feel: 'The intended muscles and loading depend on the variation you choose.',
    mistakes: ['Treating different movements as one exercise because they share a saved label.', 'Following a demonstration with a different release direction or equipment setup.'],
    caution: `The old label and records are preserved. Use a precisely named library variant for future entries; changing a display name does not establish what an older performance used. ${technique?.caution ?? ''}`.trim(),
  } : technique ?? fallback;
  const preparationEquipment: Record<string, string> = {
    'Easy Upper-Body Movement': 'Clear standing space; no external load.',
    'Light External Rotation': 'Very light band or cable with a secure anchor.',
    'Light Throwing Rehearsal': 'A light ball approved for the actual throw in your workout and a clear approved target area.',
    'Easy Walk + Comfortable Mobility': 'Clear walking and floor space; optional mat.',
    'Easy Walk or Bike': 'Clear walking route or a stationary bicycle.',
    'Dynamic Hip Mobility': 'Clear floor space; optional mat.',
    'Bodyweight Squat + Hinge': 'Clear standing space; no external load.',
    'Landing + Progressive Jump Preparation': 'Clear, non-slip landing area without overhead obstacles.',
    'Easy Defensive Footwork': 'Clear non-slip movement lane with stopping space.',
  };
  const libraryEquipment = movement?.equipment.length === 1 && movement.equipment[0] === 'Machine'
    ? /machine/i.test(movement.name) ? movement.name : `${movement.name} machine` : movement?.equipment.join(' / ');
  const equipment = detail?.equipment ?? preparationEquipment[name] ?? (movement?.id === 'spike-slam'
    ? 'A medicine ball designed for floor slams and an approved clear floor.'
    : libraryEquipment ?? 'Confirm the equipment intended for this saved movement.');
  return { ...structuredClone(chosen), demonstration, research, loading, isGeneric: !choice && !technique,
    displayName: movement?.id === 'spike-slam' ? 'Two-Hand Medicine Ball Overhead Slam' : name,
    instructions: { equipment: choice ? 'Depends on the selected variation; confirm before training.' : equipment,
      setup: chosen.steps[0], movement: chosen.steps[1] ?? '', keyCue: chosen.steps[2] ?? 'Confirm the intended movement with a qualified coach.',
      avoid: chosen.mistakes[0], purpose: choice ? 'Choose a consistent movement before interpreting performance.'
        : movement?.primaryBenefit ?? 'The intended training purpose is not specified for this custom movement.' },
    ...(choice ? { isAmbiguous: true } : {}),
    ...(!choice && movement?.id === 'spike-slam' ? { techniqueReference: { label: 'Read ACE overhead-slam technique', url: 'https://www.acefitness.org/resources/everyone/exercise-library/182/overhead-slams/' } }
      : !choice && movement?.id === 'medicine-ball-overhead-forward-throw' ? { techniqueReference: { label: 'Read ACE overhead forward-throw technique', url: 'https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/' } } : {}),
    ...(!choice && movement?.id === 'spike-slam' ? { diagram: 'overhead-slam' as const }
      : !choice && movement?.id === 'medicine-ball-overhead-forward-throw' ? { diagram: 'forward-throw' as const }
      : !choice && movement?.id === 'drop-jump' ? { diagram: 'drop-jump' as const } : {}),
  };
}

/** Adding a Google search never replaces an assigned YouTube demonstration. */
export function getExerciseDemonstrationLinks(guide: Pick<ExerciseGuideContent, 'demonstration' | 'research'>) {
  return {
    google: guide.research.googleUrl,
    youtube: guide.demonstration.url && guide.demonstration.kind !== 'unavailable'
      ? guide.demonstration.url : guide.research.youtubeSearchUrl,
    verifiedYouTube: guide.demonstration.kind === 'verified' && Boolean(guide.demonstration.url),
  };
}
