import { plotCanvas, plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { createLazy } from 'foldkit/html';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { histogram, scatter, scatterKey } from './charts';
import { POINT_COUNT, requests } from './data';
import { Message } from './message';
import type { Model } from './model';
import { MountPointsLayer, PaintScatter } from './mount';

import * as styles from './explore.css';

const thousands = (n: number): string => n.toLocaleString('en-US');

type Brush = Model['brushPixels'];

/** The histogram changes only with the brush, so hover renders reuse its VNode. */
const histogramSlot = createLazy();
const renderHistogram = (h: HtmlBuilder<Message>, brushed: Model['brushed'], brush: Brush): Html =>
  plotChart(h, histogram(brushed), {
    overlay: brush === null ? {} : { brush: { x0: brush[0], x1: brush[1] }, color: '#e8a33c' },
  });

const readout = (model: Model, h: HtmlBuilder<Message>): Html => {
  const request = model.hover === null ? undefined : requests[model.hover.row];
  return h.p(
    [h.Class(styles.readout), h.AriaLive('polite')],
    [
      request === undefined
        ? 'Hover over the scatter to find the nearest request.'
        : `Request ${thousands((model.hover?.row ?? 0) + 1)}: ${thousands(request.latency)} ms, ${thousands(request.payload)} KB`,
    ],
  );
};

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Type('button'), h.Class(styles.button), h.OnClick(message)], [label]);

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  // On the GPU the canvas holds only axes and grid, so it is keyed by zoom
  // alone, and the points layer above repaints each brush in place.
  const gpu = model.points === 'gpu';
  const brushed = gpu ? null : model.brushed;
  const { geometry } = scatter(model.domain, brushed);
  const key = scatterKey(model.domain, brushed);
  const hover = model.hover;
  const brush = model.brushPixels;
  const canvas = {
    key: `${model.points}:${key}`,
    onMount: PaintScatter({ key, points: !gpu }),
    overlay:
      hover === null
        ? {}
        : {
            crosshair: { x: hover.x, y: hover.y },
            ring: { x: hover.x, y: hover.y, r: 5 },
            color: '#e8a33c',
          },
  };
  const pointsLayer = {
    key: JSON.stringify(model.domain),
    onMount: MountPointsLayer({ domain: model.domain, initialBrushed: model.brushed }),
  };
  return {
    title: 'Explore a million points — foldkit-viz',
    body: h.div(
      [h.Class(styles.page)],
      [
        h.div(
          [h.Class(styles.toolbar), h.Role('group'), h.AriaLabel('Scatter view')],
          [
            button(h, 'Zoom in', Message.ZoomedIn()),
            button(h, 'Zoom out', Message.ZoomedOut()),
            button(h, 'Reset', Message.ResetView()),
            h.span(
              [h.Class(styles.status)],
              [
                `${thousands(POINT_COUNT)} points${model.brushed === null ? '' : `; ${thousands(Math.round(model.brushed[0]))}–${thousands(Math.round(model.brushed[1]))} ms highlighted`}`,
              ],
            ),
          ],
        ),
        readout(model, h),
        h.div(
          [h.Class(styles.surface), h.DataAttribute('explore', 'scatter')],
          [plotCanvas(h, geometry, gpu ? { ...canvas, pointsLayer } : canvas)],
        ),
        h.div(
          [h.Class(styles.surface), h.DataAttribute('explore', 'histogram')],
          [histogramSlot(renderHistogram, [h, model.brushed, brush])],
        ),
      ],
    ),
  };
};
