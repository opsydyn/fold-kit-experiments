import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { EffectThreeStage } from '../effect-ui-scene';
import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const vrButtons = {
  checking: () => null,
  unavailable: () => null,
  ready: (h: Html.H<Message>) => button(h, 'Enter VR', Message.ClickedEnterVr()),
  entering: (h: Html.H<Message>) => button(h, 'Entering VR…', Message.ClickedExitVr()),
  presenting: (h: Html.H<Message>) => button(h, 'Exit VR', Message.ClickedExitVr()),
};

const readout = (model: Model): string =>
  model.sceneFailure === null
    ? `${model.toys.length} toys, ${model.marbles} marbles, ${model.bumps} bumps. Click a toy to kick it. Drag around them to orbit.`
    : `Could not start the toybox (${model.sceneFailure}).`;

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage')
      .on('scene-click', ({ key, ray }) => Message.ClickedToy({ key, direction: ray.direction }))
      .on('scene-collision', ({ started, aInstance, bInstance }) =>
        Message.Bumped({ started, marble: aInstance !== undefined || bInstance !== undefined }),
      )
      .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
      .on('scene-xr', ({ mode }) => Message.ChangedVrSession({ presenting: mode !== null }))
      .on('scene-xr-moved', (moved) => Message.Glided({ moved }))
      .onMount(
        Mount.map(sceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.p.class('e3-readout').attr('aria-live', 'polite').children(readout(model)),
    h.div
      .class('e3-controls')
      .children(
        button(h, 'Drop a toy', Message.ClickedDrop()),
        button(h, 'Pour marbles', Message.ClickedPour()),
        button(h, 'Tidy up', Message.ClickedTidy()),
        button(
          h,
          model.showColliders ? 'Hide colliders' : 'Show colliders',
          Message.ToggledColliders(),
        ),
        vrButtons[model.vr](h),
      ),
    h.p
      .class('e3-note')
      .children(
        'Each toy is a mesh with a dynamic body. Rapier owns where it is. The Model keeps ',
        'where it was dropped and its kicks, each with a new id, applied once. The marbles ',
        'are one instanced mesh with a body per instance, and spherical joints hold the chain together.',
      ),
  );
