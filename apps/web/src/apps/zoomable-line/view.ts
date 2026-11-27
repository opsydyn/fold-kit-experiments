import type { Html } from '@effect/ui/html';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';

import { Message } from './message';
import type { Model } from './model';
import { priceSpec } from './spec';

import * as styles from './zoomable-line.css';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class(styles.button).attr('type', 'button').on('click', message).children(label);

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.children(
    h.div
      .class(styles.toolbar)
      .attrs({ role: 'group', 'aria-label': 'Date range' })
      .children(
        button(h, 'Zoom in', Message.ZoomedIn()),
        button(h, 'Zoom out', Message.ZoomedOut()),
        button(h, 'Earlier', Message.PannedEarlier()),
        button(h, 'Later', Message.PannedLater()),
        button(h, 'Reset', Message.ResetView()),
      ),
    plotChart(h, compilePlot(priceSpec(model.domain))),
  );
