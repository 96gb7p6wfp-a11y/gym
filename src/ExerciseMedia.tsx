import { useState } from 'react';
import { approvedAdditionalMedia, getExerciseMedia, type ExerciseMediaAsset } from './exercise-media';
import type { ExerciseReference } from './exercise-library';
import './exercise-media.css';

function MediaImage({ asset, thumbnail = false }: { asset: ExerciseMediaAsset; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  // Do not leave a broken-image frame or block instructions when optional media
  // is absent offline. The precise written guide remains fully usable.
  if (failed) return thumbnail ? null : <p className="exercise-media__unavailable">Image unavailable. Follow the written technique below.</p>;
  return <figure className={`exercise-media${thumbnail ? ' exercise-media--thumbnail' : ''}`} data-media-kind={asset.kind}>
    <img src={asset.src} alt={thumbnail ? '' : asset.alt} width={asset.width} height={asset.height}
      loading="lazy" decoding="async" onError={() => setFailed(true)} />
    {!thumbnail && <figcaption><span>{asset.kind === 'schematic' ? 'Movement-direction diagram' : asset.variation}</span>
      <small>{asset.attribution}</small>
      {(asset.source.url || asset.license.url) && <small className="exercise-media__credits">
        {asset.source.url && <a href={asset.source.url} target="_blank" rel="noopener noreferrer">Source</a>}
        {asset.license.url && <a href={asset.license.url} target="_blank" rel="noopener noreferrer">{asset.license.name ?? 'Reuse license'}</a>}
      </small>}</figcaption>}
  </figure>;
}

export function ExerciseMedia({ exercise, thumbnail = false }: { exercise: ExerciseReference | string; thumbnail?: boolean }) {
  const asset = getExerciseMedia(exercise);
  if (!asset) return null;
  return <MediaImage key={asset.id} asset={asset} thumbnail={thumbnail} />;
}

export function AdditionalExerciseMedia({ exercise }: { exercise: ExerciseReference | string }) {
  const asset = getExerciseMedia(exercise);
  const additional = asset ? approvedAdditionalMedia(asset) : [];
  if (!additional.length) return null;
  return <details className="exercise-guide__disclosure"><summary>More demonstration views</summary>
    <div className="exercise-media__additional">{additional.map(item => <MediaImage key={item.id} asset={item} />)}</div>
  </details>;
}
