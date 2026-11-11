import { findLibraryExercise, type ExerciseReference } from './exercise-library.ts';

export type ExerciseMediaRights = 'original' | 'licensed' | 'permission-granted' | 'permission-required' | 'unknown';
export interface ExerciseMediaAsset {
  id: string;
  exerciseId: string;
  exerciseName: string;
  variation: string;
  kind: 'photograph' | 'illustration' | 'schematic';
  src: string;
  width: number;
  height: number;
  alt: string;
  source: { name: string; url?: string };
  attribution: string;
  license: { status: ExerciseMediaRights; commercialUse: boolean; redistribution: boolean; evidence: string; name?: string; url?: string };
  verification: { status: 'exact-variation-reviewed' | 'needs-review'; reviewedOn?: string; note: string };
  additional?: readonly ExerciseMediaAsset[];
}

const originalRights: ExerciseMediaAsset['license'] = {
  status: 'original', commercialUse: true, redistribution: true,
  evidence: 'Original Setline SVG direction drawings, created for this application. No third-party photographs or artwork are included.',
};
const originalSource = { name: 'Setline original movement-direction schematic' };
const everkineticCommit = '446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6';
function everkineticView({ exerciseId, exerciseName, file, upstreamFile, width, height, variation, alt }: {
  exerciseId: string; exerciseName: string; file: string; upstreamFile: string;
  width: number; height: number; variation: string; alt: string;
}): ExerciseMediaAsset {
  return { id: `everkinetic-${file}`, exerciseId, exerciseName, variation, kind: 'illustration',
    src: `/exercise-media/licensed/everkinetic/${file}.webp`, width, height, alt,
    source: { name: 'Everkinetic / Greg Priday', url: `https://github.com/everkinetic/data/blob/${everkineticCommit}/dist/png/${upstreamFile}.png` },
    attribution: 'Everkinetic / Greg Priday · lossless PNG-to-WebP conversion; original pose retained',
    license: { status: 'licensed', commercialUse: true, redistribution: true, name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      evidence: `Upstream license: https://github.com/everkinetic/data/blob/${everkineticCommit}/LICENSE.md . Local license and exact source/digest records accompany the files. Converted illustrations remain CC BY-SA 4.0.` },
    verification: { status: 'exact-variation-reviewed', reviewedOn: '2026-11-11',
      note: 'Both source poses visually reviewed. Hands, feet and movement equipment remain visible, with original pixels and dimensions retained. Example apparatus, not identification of the athlete’s actual gym machine.' },
  };
}
const legExtensionStart = everkineticView({ exerciseId: 'leg-extension', exerciseName: 'Leg Extension', file: 'leg-extension-start', upstreamFile: '0142-relaxation',
  width: 562, height: 922, variation: 'Seated leg-extension machine · start position · example apparatus',
  alt: 'Seated leg-extension machine start: torso supported, knees bent, lower shins against the roller and hands beside the seat. Example apparatus.' });
const legExtensionFinish = everkineticView({ exerciseId: 'leg-extension', exerciseName: 'Leg Extension', file: 'leg-extension-extended', upstreamFile: '0142-tension',
  width: 596, height: 922, variation: 'Seated leg-extension machine · extended position · example apparatus',
  alt: 'Seated leg-extension machine finish: lower legs extend forward against the roller while the torso stays supported. Example apparatus.' });
const seatedCalfStart = everkineticView({ exerciseId: 'seated-calf-raise', exerciseName: 'Seated Calf Raise', file: 'seated-calf-raise-lowered', upstreamFile: '0279-relaxation',
  width: 645, height: 938, variation: 'Seated calf-raise machine · bent knees, heels lowered · example apparatus',
  alt: 'Seated bent-knee calf-raise machine: thighs under the pad, forefeet supported on the platform and heels lowered. Example apparatus.' });
const seatedCalfFinish = everkineticView({ exerciseId: 'seated-calf-raise', exerciseName: 'Seated Calf Raise', file: 'seated-calf-raise-raised', upstreamFile: '0279-tension',
  width: 646, height: 938, variation: 'Seated calf-raise machine · bent knees, heels raised · example apparatus',
  alt: 'Seated bent-knee calf-raise machine finish: heels rise while the forefeet stay on the platform and thighs remain under the pad. Example apparatus.' });

/** Optional media is a separate stable-ID registry; no workout, catalogue ID or
 * backup record changes when an asset is approved, replaced or unavailable. */
export const EXERCISE_MEDIA: readonly ExerciseMediaAsset[] = [
  { id: 'setline-overhead-slam-direction', exerciseId: 'spike-slam', exerciseName: 'Two-Hand Medicine Ball Overhead Slam',
    variation: 'Two hands overhead, downward release to the floor', kind: 'schematic',
    src: '/exercise-media/original/overhead-slam.svg', width: 500, height: 332,
    alt: 'Two-hand medicine-ball overhead slam: lift overhead, drive the ball down in front to a clear floor, then reset.',
    source: originalSource, attribution: 'Setline · original direction diagram', license: originalRights,
    verification: { status: 'exact-variation-reviewed', reviewedOn: '2026-11-11', note: 'Direction and sequence checked against the exact downward-slam guide. A schematic, not a photographic model or full technique assessment.' } },
  { id: 'setline-overhead-forward-throw-direction', exerciseId: 'medicine-ball-overhead-forward-throw', exerciseName: 'Medicine Ball Overhead Forward Throw',
    variation: 'Two-hand overhead release forward toward an approved target', kind: 'schematic',
    src: '/exercise-media/original/overhead-forward-throw.svg', width: 520, height: 332,
    alt: 'Two-hand medicine-ball overhead forward throw: start overhead and release forward toward an approved clear target.',
    source: originalSource, attribution: 'Setline · original direction diagram', license: originalRights,
    verification: { status: 'exact-variation-reviewed', reviewedOn: '2026-11-11', note: 'Forward release shown separately from downward slams and backward throws. Follow the written setup and safety instructions.' } },
  { id: 'setline-drop-jump-direction', exerciseId: 'drop-jump', exerciseName: 'Drop Jump',
    variation: 'Step off a low box, rebound vertically, then land under control', kind: 'schematic',
    src: '/exercise-media/original/drop-jump.svg', width: 680, height: 332,
    alt: 'Low-box drop jump sequence: step off without jumping up, contact and rebound vertically, then land under control.',
    source: originalSource, attribution: 'Setline · original direction diagram', license: originalRights,
    verification: { status: 'exact-variation-reviewed', reviewedOn: '2026-11-11', note: 'Step-off, vertical rebound and final landing are distinct. Box height remains the saved prescription; the drawing does not authorize impact work.' } },
  { ...legExtensionStart, additional: [legExtensionFinish] },
  { ...seatedCalfStart, additional: [seatedCalfFinish] },
];

/** Rights and technique review are both required. Local approved assets keep
 * workout rendering free of third-party requests, tracking or API credentials. */
export function isApprovedExerciseMedia(asset: ExerciseMediaAsset): boolean {
  return ['original', 'licensed', 'permission-granted'].includes(asset.license.status)
    && asset.license.commercialUse && asset.license.redistribution
    && asset.verification.status === 'exact-variation-reviewed'
    && asset.src.startsWith('/exercise-media/') && !asset.src.includes('..') && !/[?#\\]/.test(asset.src)
    && /\.(?:avif|webp|svg|png|jpe?g)$/i.test(asset.src)
    && Number.isFinite(asset.width) && Number.isFinite(asset.height) && asset.width > 0 && asset.height > 0
    && Boolean(asset.alt.trim() && asset.attribution.trim() && asset.source.name.trim()
      && asset.license.evidence.trim() && asset.verification.note.trim());
}

export function getExerciseMedia(exercise: ExerciseReference | string): ExerciseMediaAsset | undefined {
  // An old retained ID must not attach the old illustration to a custom rename.
  const movement = typeof exercise === 'string' ? findLibraryExercise(exercise)
    : exercise.name?.trim() ? findLibraryExercise(exercise.name) : findLibraryExercise(exercise);
  if (!movement || movement.legacyChoice) return undefined;
  return EXERCISE_MEDIA.find(asset => asset.exerciseId === movement.id && isApprovedExerciseMedia(asset));
}

export function approvedAdditionalMedia(asset: ExerciseMediaAsset): readonly ExerciseMediaAsset[] {
  return (asset.additional ?? []).filter(item => item.exerciseId === asset.exerciseId && isApprovedExerciseMedia(item));
}
