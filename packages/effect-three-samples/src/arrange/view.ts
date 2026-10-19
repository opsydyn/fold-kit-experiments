import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';

const toggle = (h: HtmlBuilder<Message>, label: string, on: boolean, message: Message): Html =>
  h.button(
    [h.Class('e3-button'), h.Type('button'), h.AriaPressed(String(on)), h.OnClick(message)],
    [label],
  );

const button = (h: HtmlBuilder<Message>, label: string, enabled: boolean, message: Message): Html =>
  h.button(
    [h.Class('e3-button'), h.Type('button'), h.Disabled(!enabled), h.OnClick(message)],
    [label],
  );

const modes = [
  ['translate', 'Move'],
  ['rotate', 'Turn'],
  ['scale', 'Scale'],
] as const;

const figure = (value: number): string => value.toFixed(2);

/** The selected thing and where it is, read from the Model. */
const readout = (model: Model): string =>
  Option.match(
    Option.flatMap(model.selected, (key) =>
      Option.fromNullishOr(model.things.find((thing) => thing.key === key)),
    ),
    {
      onNone: () => 'Click something on the table to move, turn or scale it.',
      onSome: ({ key, placement }) =>
        `${key}: at ${placement.position.map(figure).join(', ')}, turned ${placement.rotation
          .map((angle) => `${Math.round((angle * 180) / Math.PI)}°`)
          .join(
            ', ',
          )}, scaled ${placement.scale.map(figure).join(', ')}. ${model.past.length} moves to undo.`,
    },
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Arrange — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage e3-stage-tall',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onPointerDown: ({ key, ray }) =>
            Message.PressedScene({ key, origin: ray.origin, direction: ray.direction }),
          onDrag: ({ ray }) =>
            Message.DraggedScene({ origin: ray.origin, direction: ray.direction }),
          onDragEnd: () => Message.ReleasedScene(),
          onClick: ({ key }) => Message.ClickedThing({ key }),
          onPointerMissed: () => Message.ClickedNothing(),
          onPointerEnter: ({ key }) => Message.HoveredScene({ key }),
          onPointerLeave: ({ key }) => Message.LeftScene({ key }),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
        },
        h,
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
      h.div(
        [h.Class('e3-controls')],
        [
          ...modes.map(([mode, label]) =>
            toggle(h, label, model.gizmo.gizmo.mode === mode, Message.ChoseMode({ mode })),
          ),
          toggle(h, 'Local axes', model.gizmo.gizmo.space === 'local', Message.ClickedSpace()),
          toggle(h, 'Snap', model.snapping, Message.ClickedSnapping()),
          button(h, 'Undo', model.past.length > 0, Message.ClickedUndo()),
          button(h, 'Redo', model.future.length > 0, Message.ClickedRedo()),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'The gizmo is a Foldkit submodel: its handles are scene nodes, a press and the drag ',
          'rays after it are Messages, and each move comes back to the page as an OutMessage, ',
          'so every move can be undone. Drag empty space to orbit.',
        ],
      ),
    ],
  ),
});
