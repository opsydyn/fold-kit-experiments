import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import type { Model } from './model';
import { priceSpec } from './spec';

import * as styles from './zoomable-line.css';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Type('button'), h.Class(styles.button), h.OnClick(message)], [label]);

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Zoomable line — foldkit-viz',
  body: h.div(
    [],
    [
      h.div(
        [h.Class(styles.toolbar), h.Role('group'), h.AriaLabel('Date range')],
        [
          button(h, 'Zoom in', Message.ZoomedIn()),
          button(h, 'Zoom out', Message.ZoomedOut()),
          button(h, 'Earlier', Message.PannedEarlier()),
          button(h, 'Later', Message.PannedLater()),
          button(h, 'Reset', Message.ResetView()),
        ],
      ),
      plotChart(h, compilePlot(priceSpec(model.domain))),
    ],
  ),
});
