import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';

import { histogram, scatter } from './charts';
import { requests } from './data';
import { Message } from './message';
import type { Model } from './model';
import { TrackPointer } from './mount';

import * as styles from './histogram-brush.css';

const BRUSH_COLOUR = '#f59e0b';

/** How many requests fall in the brushed range, for the status line. */
const selectedCount = (brushed: NonNullable<Model['brushed']>): number =>
  requests.filter((r) => Number(r.ms) >= brushed[0] && Number(r.ms) <= brushed[1]).length;

export const view = (h: Html.H<Message>, model: Model) => {
  const { brushed, brushPixels: band } = model;
  const status =
    brushed === null
      ? `Drag across the histogram to select a range of ${requests.length} requests.`
      : `${selectedCount(brushed)} of ${requests.length} requests from ${Math.round(brushed[0])} to ${Math.round(brushed[1])} ms`;
  return h.div.class(styles.page).children(
    h.div
      .class(styles.toolbar)
      .children(
        h.span.attr('aria-live', 'polite').children(status),
        brushed === null
          ? undefined
          : h.button
              .class(styles.button)
              .attr('type', 'button')
              .on('click', Message.ClearedBrush())
              .children('Clear'),
      ),
    h.div.class(styles.charts).children(
      h.div
        .class(styles.brushable)
        .attr('data-brush', 'histogram')
        .onMount(Mount.map(TrackPointer(), (message) => message))
        .children(
          plotChart(h, histogram(brushed), {
            overlay:
              band === null ? {} : { brush: { x0: band[0], x1: band[1] }, color: BRUSH_COLOUR },
          }),
        ),
      plotChart(h, scatter(brushed)),
    ),
  );
};
