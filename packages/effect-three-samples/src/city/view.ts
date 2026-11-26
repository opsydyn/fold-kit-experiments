import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Option } from 'effect';

import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
import { Message } from './message';
import { buildingCount, type Model } from './model';
import { sceneFor } from './scene';

const readout = (model: Model): string =>
  Option.match(model.hovered, {
    onNone: () => 'Hover a building to name it. Click to raise it.',
    onSome: (index) => `Building ${index + 1} of ${buildingCount.toLocaleString('en')}.`,
  });

const performanceNote = (model: Model): string =>
  Option.match(model.fps, {
    onNone: () => 'Full resolution: frames have been fast enough so far.',
    onSome: (fps) =>
      `Measured ${fps} fps: drawing at ${Math.round(model.quality * 100)}% resolution.`,
  });

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage')
      .on('scene-pointer-move', ({ instance }) =>
        Message.HoveredBuilding({ instance: instance ?? '' }),
      )
      .on('scene-pointer-leave', Message.LeftCity())
      .on('scene-click', ({ instance }) => Message.ClickedBuilding({ instance: instance ?? '' }))
      .on('scene-performance', ({ fps, factor }) => Message.ChangedPerformance({ fps, factor }))
      .onMount(
        Mount.map(unlabelledSceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.p.class('e3-readout').attr('aria-live', 'polite').children(readout(model)),
    h.div
      .class('e3-controls')
      .children(
        h.button
          .class('e3-button')
          .attr('type', 'button')
          .on('click', Message.ClickedNewCity())
          .children('New city'),
      ),
    h.p
      .class('e3-note')
      .children(
        `${buildingCount.toLocaleString('en')} buildings in one instanced mesh and one draw call. `,
        'Hovering updates only the affected instances. The scene draws when something changes. ',
        performanceNote(model),
      ),
  );
