import { zoomDomain } from '@opsydyn/foldkit-viz/interaction/viewport';
import { invertAxis } from '@opsydyn/foldkit-viz/plot';
import type { Return as UpdateReturn } from 'foldkit/update';

import { histogram, scatter } from './charts';
import { bins, latencyExtent } from './data';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

const pair = (a: number, b: number): readonly [number, number] => [a, b];

const HOVER_RADIUS = 12;

/** The latency range of the bins whose centres the brush covers; null for a click. */
const brushedRange = (from: number, to: number): readonly [number, number] | null => {
  if (Math.abs(to - from) < 3) return null;
  const lo = Math.min(from, to),
    hi = Math.max(from, to);
  const ticks = histogram(null).facets[0]?.x?.ticks ?? [];
  const covered = bins.filter((_, i) => {
    const centre = ticks[i]?.position ?? Number.NaN;
    return centre >= lo && centre <= hi;
  });
  const first = covered[0],
    last = covered.at(-1);
  return first === undefined || last === undefined ? null : [first.x0, last.x1];
};

const currentDomain = (model: Model): readonly [number, number] => model.domain ?? latencyExtent;

/** Zoom about the hovered request when there is one, else about the middle. */
const zoom = (model: Model, factor: number): Model => {
  const domain = currentDomain(model);
  const middle = Math.sqrt(domain[0] * domain[1]);
  const axis = scatter(model.domain, model.brushed).geometry.facets[0]?.x;
  const hovered =
    model.hover === null || axis === null || axis === undefined
      ? undefined
      : invertAxis(axis, model.hover.x);
  const anchor = Number.isFinite(Number(hovered)) ? Number(hovered) : middle;
  const next = zoomDomain(domain, factor, anchor, latencyExtent, 5);
  return { ...model, domain: next, hover: null };
};

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    MovedPointer: ({ surface, x, y }) => {
      if (surface === 'histogram' && model.dragFrom !== null)
        return { model: { ...model, brushPixels: pair(model.dragFrom, x) } };
      if (surface !== 'scatter')
        return { model: model.hover === null ? model : { ...model, hover: null } };
      const hit = scatter(model.domain, model.brushed).index.nearest(x, y, HOVER_RADIUS);
      const row = hit?.row ?? null;
      // The same nearest request keeps the same Model, so nothing re-renders.
      if (row === (model.hover?.row ?? null)) return { model };
      return {
        model: {
          ...model,
          hover: hit === undefined || row === null ? null : { x: hit.x, y: hit.y, row },
        },
      };
    },
    PressedPointer: ({ surface, x }) =>
      surface === 'histogram'
        ? { model: { ...model, dragFrom: x, brushPixels: pair(x, x) } }
        : { model },
    ReleasedPointer: () => {
      if (model.dragFrom === null) return { model };
      const to = model.brushPixels?.[1] ?? model.dragFrom;
      const brushed = brushedRange(model.dragFrom, to);
      return {
        model: {
          ...model,
          dragFrom: null,
          brushed,
          brushPixels: brushed === null ? null : model.brushPixels,
          hover: null,
        },
      };
    },
    ZoomedIn: () => ({ model: zoom(model, 0.5) }),
    ZoomedOut: () => ({ model: zoom(model, 2) }),
    ResetView: () => ({
      model: { ...model, domain: null, brushed: null, brushPixels: null, hover: null },
    }),
    PaintedScatter: () => ({ model }),
  });
