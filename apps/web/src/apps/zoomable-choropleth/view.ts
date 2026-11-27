import type { Html } from '@effect/ui/html';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

import { spec as worldSpec } from '../choropleth/spec';
import { Message } from './message';
import type { Model } from './model';

import * as styles from '../zoomable-line/zoomable-line.css';

/** The world choropleth, zoomed about the model's centre and clipped to its panel. */
export const zoomedSpec = (model: Model): PlotSpec => ({
  ...worldSpec,
  clip: true,
  projection: { type: 'naturalEarth1', zoom: model.zoom, center: model.center },
});

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class(styles.button).attr('type', 'button').on('click', message).children(label);

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.children(
    h.div
      .class(styles.toolbar)
      .attrs({ role: 'group', 'aria-label': 'Map view' })
      .children(
        button(h, 'Zoom in', Message.ZoomedIn()),
        button(h, 'Zoom out', Message.ZoomedOut()),
        button(h, 'West', Message.PannedWest()),
        button(h, 'East', Message.PannedEast()),
        button(h, 'North', Message.PannedNorth()),
        button(h, 'South', Message.PannedSouth()),
        button(h, 'Reset', Message.ResetView()),
      ),
    plotChart(h, compilePlot(zoomedSpec(model))),
  );
