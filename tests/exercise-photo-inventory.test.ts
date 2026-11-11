import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { EXERCISE_CATALOGUE } from '../src/exercise-library.ts';
import { EXERCISE_MEDIA, approvedAdditionalMedia } from '../src/exercise-media.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8'));

test('the source inventory covers all physical PDF pages and never pretends to import copyrighted photographs', () => {
  const inventory = read('BODYCRAFT_PDF_INVENTORY.json');
  assert.equal(inventory.source.pages, 65);
  assert.equal(inventory.source.publicImageImports, 0);
  assert.deepEqual(inventory.pages.map((page: { pdfPage: number }) => page.pdfPage), Array.from({ length: 65 }, (_, index) => index + 1));
  assert.equal(inventory.pages.filter((page: { kind: string }) => page.kind === 'exercise-plate').length, inventory.source.namedExercisePlates);
  assert.ok(inventory.pages.every((page: { imageImported: boolean }) => page.imageImported === false));
  const byPage = new Map<number, { title: string }>(inventory.pages.map((page: { pdfPage: number; title: string }) => [page.pdfPage, page]));
  assert.match(byPage.get(6)!.title, /Bench Press/);
  assert.match(byPage.get(25)!.title, /Lateral Raise/);
  assert.match(byPage.get(57)!.title, /Leg Press/);
});

test('every stable library ID has an explicit media gap, equipment brief, source route and permission record', () => {
  const register = read('EXERCISE_PHOTO_MAPPING.json');
  const ids = new Set(EXERCISE_CATALOGUE.map(item => item.id));
  assert.equal(register.exercises.length, ids.size);
  assert.deepEqual(new Set(register.exercises.map((item: { exerciseId: string }) => item.exerciseId)), ids);
  for (const item of register.exercises) {
    assert.ok(item.exerciseName && item.equipment.length && item.recommendedImageBrief && item.candidateSourceRoute, item.exerciseId);
    assert.equal(item.photographActuallyAdded, false);
    assert.equal(item.photographCommercialReuseRightsEstablished, false);
    assert.ok(item.verificationStatus && item.permissionStatus);
    assert.ok(item.bodycraftCandidatePages.every((page: number) => Number.isInteger(page) && page >= 1 && page <= 65));
  }
  assert.equal(register.approvedPhotographsAdded, 0);
});

test('the published missing-image report matches the actual rights-approved runtime registry and all additional views', () => {
  const register = read('EXERCISE_PHOTO_MAPPING.json');
  const covered = new Set(EXERCISE_MEDIA.map(item => item.exerciseId));
  const files = EXERCISE_MEDIA.flatMap(item => [item, ...approvedAdditionalMedia(item)]);
  assert.equal(register.exerciseIdsWithApprovedImages, covered.size);
  assert.equal(register.approvedImageFilesAdded, files.length);
  assert.equal(register.exerciseIdsStillNeedingApprovedImages, EXERCISE_CATALOGUE.length - covered.size);
  for (const item of register.exercises) {
    assert.equal(item.approvedImageActuallyAdded, covered.has(item.exerciseId), item.exerciseId);
    assert.equal(item.stillNeedsApprovedImage, !covered.has(item.exerciseId), item.exerciseId);
    const expected = files.filter(asset => asset.exerciseId === item.exerciseId).map(asset => asset.src).sort();
    assert.deepEqual([item.imageAssetPath, ...item.additionalImageAssetPaths].filter(Boolean).sort(), expected, item.exerciseId);
  }
});
