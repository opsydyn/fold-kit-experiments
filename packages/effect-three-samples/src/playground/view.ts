import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Option } from 'effect';

import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const stat = (h: Html.H<Message>, label: string, value: number) =>
  h.div
    .class(value === 0 ? 'e3-stat' : 'e3-stat e3-stat-active')
    .children(h.dt(label), h.dd(String(value)));

const report = (model: Model, h: Html.H<Message>) =>
  Option.match(model.last, {
    onNone: () => [h.p.class('e3-note').children('Waiting for the first update…')],
    onSome: ({ ops, resources }) => [
      h.p.class('e3-note').children('Last update, by operation:'),
      h.dl
        .class('e3-stats')
        .children(
          stat(h, 'Created', ops.created),
          stat(h, 'Updated', ops.updated),
          stat(h, 'Moved', ops.moved),
          stat(h, 'Reordered', ops.reordered),
          stat(h, 'Removed', ops.removed),
          stat(h, 'Replaced', ops.replaced),
        ),
      h.p
        .class('e3-note')
        .children(
          `GPU now: ${resources.geometries.live} geometry, ${resources.materials.live} materials. `,
          `Since start: ${resources.materials.created} materials created, ${resources.materials.disposed} disposed.`,
        ),
    ],
  });

export const view = (h: Html.H<Message>, model: Model) =>
  h.div.class('e3-sample').children(
    EffectThreeStage(h)
      .class('e3-stage')
      .on('scene-reconciled', (detail) => Message.ReceivedReconciled({ detail }))
      .on('scene-click', ({ key }) => Message.ClickedCube({ key }))
      .on('scene-pointer-enter', ({ key }) => Message.HoveredCube({ key }))
      .on('scene-pointer-leave', ({ key }) => Message.LeftCube({ key }))
      .onMount(
        Mount.map(unlabelledSceneMount({ scene: sceneFor(model) }), (lifecycle) =>
          Message.ReceivedSceneLifecycle({ lifecycle }),
        ),
      )
      .children(),
    h.div
      .class('e3-controls')
      .children(
        button(h, 'Add cube', Message.ClickedAdd()),
        button(h, 'Move one across', Message.ClickedMoveAcross()),
        button(h, 'Rotate left shelf', Message.ClickedRotate()),
        button(h, 'Remove cube', Message.ClickedRemove()),
      ),
    ...report(model, h),
    h.p
      .class('e3-note')
      .children(
        'Click a cube to repaint it. Cubes share materials. A colour is released when no cube uses it and recreated when a cube needs it.',
      ),
  );
