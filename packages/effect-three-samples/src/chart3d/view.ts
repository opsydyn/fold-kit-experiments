import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../labelledEnvironment';
import { Message } from './message';
import type { Chart, Model } from './model';
import { scatter, sceneFor, surface } from './scene';

const choice = (model: Model, h: HtmlBuilder<Message>, chart: Chart, label: string): Html =>
  h.button(
    [
      h.Class('e3-button'),
      h.Type('button'),
      h.AriaPressed(String(model.chart === chart)),
      h.OnClick(Message.ClickedChart({ chart })),
    ],
    [label],
  );

const summary = (model: Model): string =>
  model.chart === 'scatter'
    ? `${scatter.positions.length} measurements in ${scatter.legend.length} clusters: ${scatter.legend.map((entry) => entry.label).join(', ')}.`
    : `A surface over a 32 by 32 grid, heights from ${surface.range[0].toFixed(2)} to ${surface.range[1].toFixed(2)}, coloured low (purple) to high (yellow).`;

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: '3D charts — foldkit-viz and effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
        },
        h,
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [summary(model)]),
      h.div(
        [h.Class('e3-controls'), h.AriaLabel('Chart')],
        [
          choice(model, h, 'scatter', 'Scatter'),
          choice(model, h, 'surface', 'Surface'),
          h.button(
            [h.Class('e3-button'), h.Type('button'), h.OnClick(Message.ClickedResetView())],
            ['Reset view'],
          ),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'Drag to orbit, scroll or pinch to zoom. foldkit-viz lays the chart out as plain geometry; effect-three draws it, and the camera lives in the Model.',
        ],
      ),
    ],
  ),
});
