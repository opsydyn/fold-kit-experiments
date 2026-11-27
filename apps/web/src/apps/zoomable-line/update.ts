import { panDomain, zoomDomain } from '@opsydyn/foldkit-viz/interaction/viewport';

import { fullDomain } from './data';
import { Message } from './message';
import type { Model } from './model';

/** Never narrower than two weeks. */
const MIN_SPAN = 14 * 24 * 60 * 60 * 1000;

const current = (model: Model): readonly [number, number] => model.domain ?? fullDomain;

/** Zoom about the middle of the visible dates. */
const zoom = (model: Model, factor: number): Model => {
  const [lo, hi] = current(model);
  return { domain: zoomDomain([lo, hi], factor, (lo + hi) / 2, fullDomain, MIN_SPAN) };
};

/** Pan by a quarter of the visible span. */
const pan = (model: Model, direction: number): Model => {
  const [lo, hi] = current(model);
  return { domain: panDomain([lo, hi], direction * 0.25 * (hi - lo), fullDomain, MIN_SPAN) };
};

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    ZoomedIn: () => zoom(model, 0.5),
    ZoomedOut: () => zoom(model, 2),
    PannedEarlier: () => pan(model, -1),
    PannedLater: () => pan(model, 1),
    ResetView: () => ({ domain: null }),
  });
