import { invertAxis } from '@opsydyn/foldkit-viz/plot';

import { histogram, pixelOf, snapToBins } from './charts';
import { Message } from './message';
import type { Model } from './model';

const pair = (a: number, b: number): readonly [number, number] => [a, b];

const cleared: Model = { dragFrom: null, brushPixels: null, brushed: null };

/** The bins a dragged pixel range covers, and their band in pixels; null for a click. */
function brushOf(from: number, to: number): Model {
  const axis = histogram(null).facets[0]?.x;
  if (axis === null || axis === undefined || Math.abs(to - from) < 3) return cleared;
  const lo = Number(invertAxis(axis, Math.min(from, to))),
    hi = Number(invertAxis(axis, Math.max(from, to)));
  const brushed = snapToBins(lo, hi);
  if (brushed === null) return cleared;
  return {
    dragFrom: null,
    brushed,
    brushPixels: pair(pixelOf(axis, brushed[0]), pixelOf(axis, brushed[1])),
  };
}

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    PressedPointer: ({ surface, x }) =>
      surface === 'histogram' ? { ...model, dragFrom: x, brushPixels: pair(x, x) } : model,
    MovedPointer: ({ surface, x }) =>
      surface === 'histogram' && model.dragFrom !== null
        ? { ...model, brushPixels: pair(model.dragFrom, x) }
        : model,
    ReleasedPointer: () => {
      if (model.dragFrom === null) return model;
      return brushOf(model.dragFrom, model.brushPixels?.[1] ?? model.dragFrom);
    },
    ClearedBrush: () => cleared,
  });
