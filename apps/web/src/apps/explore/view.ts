import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { plotCanvas, plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';

import { histogram, scatter, scatterKey } from './charts';
import { POINT_COUNT, requests } from './data';
import { Message } from './message';
import type { Model } from './model';
import { MountPointsLayer, PaintScatter } from './mount';
import { TrackPointer } from './subscription';

import * as styles from './explore.css';

const thousands = (n: number): string => n.toLocaleString('en-US');

const readout = (h: Html.H<Message>, model: Model) => {
  const request = model.hover === null ? undefined : requests[model.hover.row];
  return h.p
    .class(styles.readout)
    .attr('aria-live', 'polite')
    .children(
      request === undefined
        ? 'Hover over the scatter to find the nearest request.'
        : `Request ${thousands((model.hover?.row ?? 0) + 1)}: ${thousands(request.latency)} ms, ${thousands(request.payload)} KB`,
    );
};

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class(styles.button).attr('type', 'button').on('click', message).children(label);

export const view = (h: Html.H<Message>, model: Model) => {
  // A GPU brush updates the mounted layer without repainting the axes canvas.
  const gpu = model.points === 'gpu';
  const brushed = gpu ? null : model.brushed;
  const { geometry } = scatter(model.domain, brushed);
  const key = scatterKey(model.domain, brushed);
  const { hover, brushPixels } = model;

  return h.div
    .class(styles.page)
    .onMount(Mount.map(TrackPointer(), (message) => message))
    .children(
      h.div
        .class(styles.toolbar)
        .attrs({ role: 'group', 'aria-label': 'Scatter view' })
        .children(
          button(h, 'Zoom in', Message.ZoomedIn()),
          button(h, 'Zoom out', Message.ZoomedOut()),
          button(h, 'Reset', Message.ResetView()),
          h.span
            .class(styles.status)
            .children(
              `${thousands(POINT_COUNT)} points${model.brushed === null ? '' : `; ${thousands(Math.round(model.brushed[0]))}–${thousands(Math.round(model.brushed[1]))} ms highlighted`}`,
            ),
        ),
      readout(h, model),
      h.div
        .class(styles.surface)
        .attr('data-explore', 'scatter')
        .children(
          plotCanvas(h, geometry, {
            key: `${model.points}:${key}`,
            onMount: PaintScatter({ key, points: !gpu }),
            pointsLayer: gpu
              ? {
                  key: JSON.stringify(model.domain),
                  onMount: MountPointsLayer({ domain: model.domain, brushed: model.brushed }),
                }
              : undefined,
            overlay:
              hover === null
                ? {}
                : {
                    crosshair: { x: hover.x, y: hover.y },
                    ring: { x: hover.x, y: hover.y, r: 5 },
                    color: '#e8a33c',
                  },
          }),
        ),
      h.div
        .class(styles.surface)
        .attr('data-explore', 'histogram')
        .children(
          plotChart(h, histogram(model.brushed), {
            overlay:
              brushPixels === null
                ? {}
                : {
                    brush: { x0: brushPixels[0], x1: brushPixels[1] },
                    color: '#e8a33c',
                  },
          }),
        ),
    );
};
