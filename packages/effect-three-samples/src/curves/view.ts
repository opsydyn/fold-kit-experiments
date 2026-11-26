import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { EffectThreeStage } from '../effect-ui-scene';
import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const toggle = (h: Html.H<Message>, label: string, on: boolean, message: Message) =>
  h.button
    .class('e3-button')
    .attr('type', 'button')
    .attr('aria-pressed', String(on))
    .on('click', message)
    .children(label);

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage', 'e3-stage-tall', 'e3-stage-night')
      .on('scene-pointer-down', ({ key, ray }) =>
        Message.PressedHandle({ key, origin: ray.origin, direction: ray.direction }),
      )
      .on('scene-drag', ({ key, ray }) =>
        Message.DraggedHandle({ key, origin: ray.origin, direction: ray.direction }),
      )
      .on('scene-drag-end', Message.DroppedHandle())
      .onMount(
        Mount.map(sceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.p
      .class('e3-readout')
      .attr('aria-live', 'polite')
      .children('Drag a handle to reshape the curve. The comet follows the new path.'),
    h.div
      .class('e3-controls')
      .children(
        toggle(h, 'Dashed curve', model.dashed, Message.ClickedDashes()),
        toggle(h, 'Glitter', model.glitter, Message.ClickedGlitter()),
        h.button
          .class('e3-button')
          .attr('type', 'button')
          .on('click', Message.ClickedReset())
          .children('Reset the handles'),
      ),
  );
