import { Mount } from '@effect/ui';
import { Html } from '@effect/ui/html';

import { defineLabelledSceneMount, EffectThreeStage } from '../effect-ui-scene';
import { Message } from './message';
import type { Chart, Model } from './model';
import { scatter, sceneFor, surface } from './scene';

const SceneMount = defineLabelledSceneMount();

const choice = (model: Model, h: Html.H<Message>, chart: Chart, label: string) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .attr('aria-pressed', String(model.chart === chart))
    .on('click', Message.ClickedChart({ chart }))
    .children(label);

const summary = (model: Model): string =>
  model.chart === 'scatter'
    ? `${scatter.positions.length} measurements in ${scatter.legend.length} clusters: ${scatter.legend.map((entry) => entry.label).join(', ')}.`
    : `A surface over a 32 by 32 grid, heights from ${surface.range[0].toFixed(2)} to ${surface.range[1].toFixed(2)}, coloured low (purple) to high (yellow).`;

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage')
      .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
      .onMount(
        Mount.map(SceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    model.lifecycle?._tag === 'FailedScene'
      ? h.p
          .attr('role', 'status')
          .children(`Could not start the 3D chart (${model.lifecycle.reason}).`)
      : null,
    h.p.class('e3-readout').attr('aria-live', 'polite').children(summary(model)),
    h.div
      .class('e3-controls')
      .attr('aria-label', 'Chart')
      .children(
        choice(model, h, 'scatter', 'Scatter'),
        choice(model, h, 'surface', 'Surface'),
        h.button
          .class('e3-button')
          .attr('type', 'button')
          .on('click', Message.ClickedResetView())
          .children('Reset view'),
      ),
    h.p
      .class('e3-note')
      .children(
        'Drag to orbit, scroll or pinch to zoom. FoldKit Viz lays out the chart and Effect Three renders it.',
      ),
  );
