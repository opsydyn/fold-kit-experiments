import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import { buildingCount, type Model } from './model';
import { sceneFor } from './scene';

const readout = (model: Model): string =>
  Option.match(model.hovered, {
    onNone: () => 'Hover a building to name it; click to raise it.',
    onSome: (index) => `Building ${index + 1} of ${buildingCount.toLocaleString('en')}.`,
  });

const performanceNote = (model: Model): string =>
  Option.match(model.fps, {
    onNone: () => 'Full resolution: frames have been fast enough so far.',
    onSome: (fps) =>
      `Measured ${fps} fps: drawing at ${Math.round(model.quality * 100)}% resolution.`,
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'City — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onPointerMove: ({ instance }) => Message.HoveredBuilding({ instance: instance ?? '' }),
          onPointerLeave: () => Message.LeftCity(),
          onClick: ({ instance }) => Message.ClickedBuilding({ instance: instance ?? '' }),
          onPerformanceChange: ({ fps, factor }) => Message.ChangedPerformance({ fps, factor }),
        },
        h,
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
      h.div(
        [h.Class('e3-controls')],
        [
          h.button(
            [h.Class('e3-button'), h.Type('button'), h.OnClick(Message.ClickedNewCity())],
            ['New city'],
          ),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          `${buildingCount.toLocaleString('en')} buildings in one instanced mesh and one draw call. `,
          'A hover rewrites one or two instances, not ten thousand, and the scene draws only when ',
          `something changes. ${performanceNote(model)}`,
        ],
      ),
    ],
  ),
});
