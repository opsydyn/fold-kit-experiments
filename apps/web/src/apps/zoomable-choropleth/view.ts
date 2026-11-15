import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { spec as worldSpec } from '../choropleth/spec';
import { Message } from './message';
import type { Model } from './model';

import * as styles from '../zoomable-line/zoomable-line.css';

/** The world choropleth, zoomed about the model's centre and clipped to its panel. */
const zoomedSpec = (model: Model): PlotSpec => ({
  ...worldSpec,
  clip: true,
  projection: { type: 'naturalEarth1', zoom: model.zoom, center: model.center },
});

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Type('button'), h.Class(styles.button), h.OnClick(message)], [label]);

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Zoomable choropleth — foldkit-viz',
  body: h.div(
    [],
    [
      h.div(
        [h.Class(styles.toolbar), h.Role('group'), h.AriaLabel('Map view')],
        [
          button(h, 'Zoom in', Message.ZoomedIn()),
          button(h, 'Zoom out', Message.ZoomedOut()),
          button(h, 'West', Message.PannedWest()),
          button(h, 'East', Message.PannedEast()),
          button(h, 'North', Message.PannedNorth()),
          button(h, 'South', Message.PannedSouth()),
          button(h, 'Reset', Message.ResetView()),
        ],
      ),
      plotChart(h, compilePlot(zoomedSpec(model))),
    ],
  ),
});
