import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Match, Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const statClass = (value: number): string =>
  Match.value(value).pipe(
    Match.when(0, () => 'e3-stat'),
    Match.orElse(() => 'e3-stat e3-stat-active'),
  );

const stat = (h: HtmlBuilder<Message>, label: string, value: number): Html =>
  h.div([h.Class(statClass(value))], [h.dt([], [label]), h.dd([], [String(value)])]);

const report = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  Option.match(model.last, {
    onNone: () => [h.p([h.Class('e3-note')], ['Waiting for the first update…'])],
    onSome: ({ ops, resources }) => [
      h.p([h.Class('e3-note')], ['Last update, by operation:']),
      h.dl(
        [h.Class('e3-stats')],
        [
          stat(h, 'Created', ops.created),
          stat(h, 'Updated', ops.updated),
          stat(h, 'Moved', ops.moved),
          stat(h, 'Reordered', ops.reordered),
          stat(h, 'Removed', ops.removed),
          stat(h, 'Replaced', ops.replaced),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          `GPU now: ${resources.geometries.live} geometry, ${resources.materials.live} materials. `,
          `Since start: ${resources.materials.created} materials created, ${resources.materials.disposed} disposed.`,
        ],
      ),
    ],
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Reconciliation playground — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onReconciled: (detail) => Message.ReceivedReconciled({ detail }),
          onClick: ({ key }) => Message.ClickedCube({ key }),
          onPointerEnter: ({ key }) => Message.HoveredCube({ key }),
          onPointerLeave: ({ key }) => Message.LeftCube({ key }),
        },
        h,
      ),
      h.div(
        [h.Class('e3-controls')],
        [
          button(h, 'Add cube', Message.ClickedAdd()),
          button(h, 'Move one across', Message.ClickedMoveAcross()),
          button(h, 'Rotate left shelf', Message.ClickedRotate()),
          button(h, 'Remove cube', Message.ClickedRemove()),
        ],
      ),
      ...report(model, h),
      h.p(
        [h.Class('e3-note')],
        [
          'Click a cube to repaint it. Colours are shared materials: a colour no cube uses is disposed, ',
          'and comes back when a cube needs it again.',
        ],
      ),
    ],
  ),
});
