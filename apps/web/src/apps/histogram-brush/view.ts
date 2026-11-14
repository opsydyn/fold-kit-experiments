import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { histogram, scatter } from './charts';
import { requests } from './data';
import { Message } from './message';
import type { Model } from './model';

import * as styles from './histogram-brush.css';

const BRUSH_COLOUR = '#f59e0b';

/** How many requests fall in the brushed range, for the status line. */
const selectedCount = (brushed: Model['brushed']): number =>
  brushed === null
    ? requests.length
    : requests.filter((r) => Number(r.ms) >= brushed[0] && Number(r.ms) <= brushed[1]).length;

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const band = model.brushPixels;
  const status =
    model.brushed === null
      ? `Drag across the histogram to select a range of ${requests.length} requests.`
      : `${selectedCount(model.brushed)} of ${requests.length} requests from ${Math.round(model.brushed[0])} to ${Math.round(model.brushed[1])} ms`;
  return {
    title: 'Histogram brush — foldkit-viz',
    body: h.div(
      [h.Class(styles.page)],
      [
        h.div(
          [h.Class(styles.toolbar)],
          [
            h.span([h.AriaLive('polite')], [status]),
            ...(model.brushed === null
              ? []
              : [
                  h.button(
                    [h.Type('button'), h.Class(styles.button), h.OnClick(Message.ClearedBrush())],
                    ['Clear'],
                  ),
                ]),
          ],
        ),
        h.div(
          [h.Class(styles.charts)],
          [
            h.div(
              [h.Class(styles.brushable), h.DataAttribute('brush', 'histogram')],
              [
                plotChart(h, histogram(model.brushed), {
                  overlay:
                    band === null
                      ? {}
                      : { brush: { x0: band[0], x1: band[1] }, color: BRUSH_COLOUR },
                }),
              ],
            ),
            h.div([], [plotChart(h, scatter(model.brushed))]),
          ],
        ),
      ],
    ),
  };
};
