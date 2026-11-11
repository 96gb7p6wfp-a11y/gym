import assert from 'node:assert/strict';
import test from 'node:test';
import { stat } from 'node:fs/promises';
import { EXERCISE_CATALOGUE, findLibraryExercise } from '../src/exercise-library.ts';
import { getExerciseDemonstrationLinks, getExerciseGuide } from '../src/exercise-guides.ts';
import { EXERCISE_MEDIA, approvedAdditionalMedia, getExerciseMedia, isApprovedExerciseMedia } from '../src/exercise-media.ts';

test('every library guide offers independently encoded Google and YouTube research actions', () => {
  for (const movement of EXERCISE_CATALOGUE) {
    const guide = getExerciseGuide({ name: movement.name });
    const links = getExerciseDemonstrationLinks(guide);
    const google = new URL(links.google), youtube = new URL(links.youtube);
    assert.equal(google.origin, 'https://www.google.com', movement.id);
    assert.equal(google.searchParams.get('q'), guide.research.query);
    assert.equal(youtube.origin, 'https://www.youtube.com');
    assert.ok(youtube.searchParams.get('search_query')?.length);
    if (guide.demonstration.kind === 'search') assert.equal(links.youtube, guide.demonstration.url, 'existing YouTube search URL stays intact');
    else assert.equal(guide.research.precision, 'unconfirmed', 'ambiguous saved names do not imply an exact movement');
  }
});

test('Google uses exact canonical movement metadata rather than a misleading historical alias', () => {
  const slam = getExerciseGuide({ name: 'Medicine-Ball Overhead Spike-Pattern Slam' });
  assert.match(slam.research.query, /two hand medicine ball overhead floor slam/);
  assert.doesNotMatch(slam.research.query, /forward|backward|one.hand/);
  assert.match(getExerciseGuide({ name: 'Medicine Ball Overhead Forward Throw' }).research.query, /overhead forward throw/);
  assert.match(getExerciseGuide({ name: 'Medicine Ball Overhead Backward Throw' }).research.query, /backward throw/);
  assert.match(getExerciseGuide({ name: 'Cable Lateral Raise' }).research.query, /standing single arm cable lateral raise/);
  assert.equal(getExerciseGuide({ name: 'Cable Lateral Raise' }).demonstration.url,
    `https://www.youtube.com/results?search_query=${encodeURIComponent('Cable Lateral Raise exercise technique')}`);
  assert.match(getExerciseGuide({ name: 'Chest-Supported Row' }).research.query, /chest supported.*chest pad/);
  assert.match(getExerciseGuide({ name: 'Half-Kneeling Landmine Press' }).research.query, /half kneeling single arm/);
  assert.match(getExerciseGuide({ name: 'Drop Jump' }).research.query, /step off immediate vertical rebound/);
});

test('custom and ambiguous research stays honestly unconfirmed and user content cannot change the search host', () => {
  const name = 'My movement & "variant" #1 <script> ? x=2';
  const custom = getExerciseGuide({ name, exerciseId: 'spike-slam' });
  assert.equal(custom.research.precision, 'unconfirmed');
  assert.equal(new URL(custom.research.googleUrl).searchParams.get('q'), `${name} correct form demonstration`);
  assert.equal(new URL(custom.research.googleUrl).origin, 'https://www.google.com');
  const ambiguous = getExerciseGuide({ name: 'Medicine Ball Overhead Throw / Slam' });
  assert.equal(ambiguous.research.precision, 'unconfirmed');
  assert.equal(ambiguous.demonstration.url, '');
  assert.match(ambiguous.research.query, /variations.*differences/);
  assert.ok(getExerciseDemonstrationLinks(ambiguous).youtube.startsWith('https://www.youtube.com/results?'));
});

test('introducing Google preserves a deliberately assigned direct YouTube demonstration unchanged', () => {
  const original = getExerciseGuide({ name: 'Hack Squat' });
  // A synthetic assigned URL exercises preservation; it is not a reviewed video.
  const assigned = 'https://www.youtube.com/watch?v=qa-assigned-only&t=12';
  const guide = { ...original, demonstration: { kind: 'verified' as const, label: 'Existing reviewed assignment', url: assigned } };
  const before = structuredClone(guide);
  assert.equal(getExerciseDemonstrationLinks(guide).youtube, assigned);
  assert.equal(getExerciseDemonstrationLinks(guide).google, original.research.googleUrl);
  assert.equal(getExerciseDemonstrationLinks(guide).verifiedYouTube, true);
  assert.deepEqual(guide, before);
});

test('optional media requires explicit commercial redistribution rights and exact-variation review', () => {
  const approved = EXERCISE_MEDIA[0];
  assert.equal(isApprovedExerciseMedia(approved), true);
  for (const change of [
    { license: { ...approved.license, status: 'permission-required' as const } },
    { license: { ...approved.license, commercialUse: false } },
    { license: { ...approved.license, redistribution: false } },
    { verification: { ...approved.verification, status: 'needs-review' as const } },
    { src: 'https://third-party.example/unauthorized.webp' }, { src: '/exercise-media/../private.png' },
    { alt: '' }, { attribution: '' }, { width: Number.POSITIVE_INFINITY },
    { source: { name: '' } }, { license: { ...approved.license, evidence: '' } },
  ]) assert.equal(isApprovedExerciseMedia({ ...approved, ...change }), false);
  const extra = { ...approved, id: `${approved.id}-alternate` };
  assert.deepEqual(approvedAdditionalMedia({ ...approved, additional: [extra, { ...extra, exerciseId: 'unrelated' }] }), [extra]);
});

test('media follows stable exact identities while custom renames and incompatible movements stay unillustrated', () => {
  assert.equal(getExerciseMedia('Medicine Ball Spike Slam')?.exerciseId, 'spike-slam');
  assert.equal(getExerciseMedia('Medicine-Ball Overhead Spike-Pattern Slam')?.exerciseId, 'spike-slam');
  assert.equal(getExerciseMedia({ exerciseId: 'spike-slam', name: 'My unrelated custom exercise' }), undefined);
  assert.equal(getExerciseMedia('Medicine Ball Overhead Throw / Slam'), undefined);
  assert.notEqual(getExerciseMedia('Medicine Ball Overhead Forward Throw')?.src, getExerciseMedia('Medicine Ball Spike Slam')?.src);
});

test('every actually published asset exists, is bounded, credited and mapped to a current stable catalogue ID', async () => {
  const ids = new Set<string>();
  for (const asset of EXERCISE_MEDIA) {
    assert.ok(!ids.has(asset.id)); ids.add(asset.id);
    assert.equal(isApprovedExerciseMedia(asset), true, asset.id);
    assert.equal(findLibraryExercise(asset.exerciseId)?.id, asset.exerciseId);
    assert.ok(asset.source.name && asset.attribution && asset.license.evidence && asset.verification.note);
    const file = new URL(`../public${asset.src}`, import.meta.url);
    assert.ok((await stat(file)).size < 300_000, `${asset.id}: optional media should be optimized`);
    for (const additional of approvedAdditionalMedia(asset)) {
      assert.equal(isApprovedExerciseMedia(additional), true);
      assert.ok((await stat(new URL(`../public${additional.src}`, import.meta.url))).size < 300_000);
    }
  }
  assert.equal(EXERCISE_MEDIA.filter(asset => asset.license.status === 'original').length, 3);
});
