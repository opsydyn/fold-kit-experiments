import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import type { Model, Thing } from './model';
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

const undoable = (model: Model): string => `${model.past.length} moves to undo.`;

/** One selected thing and where it is. */
const placed = (model: Model, { key, placement }: Thing): string =>
  `${key}: at ${placement.position.map(figure).join(', ')}, turned ${placement.rotation
    .map((angle) => `${Math.round((angle * 180) / Math.PI)}°`)
    .join(', ')}, scaled ${placement.scale.map(figure).join(', ')}. ${undoable(model)}`;

/** What is selected and where, read from the Model. */
const readout = (model: Model): string => {
  const selected = model.things.filter((thing) => model.selected.includes(thing.key));
  const [only] = selected;
  if (selected.length > 1) {
    return `${selected.map((thing) => thing.key).join(', ')} selected: the gizmo on ${model.selected[0] ?? ''} moves them alike. ${undoable(model)}`;
  }
  return only === undefined
    ? 'Click something on the table to move, turn or scale it, or shift-drag to box several.'
    : placed(model, only);
};

/** The selection box's outline over the canvas, while one is drawn. */
const boxOutline = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  Option.match(EffectThreeFoldkit.BoxSelect.rectangle(model.box), {
    onNone: () => [],
    onSome: ({ left, top, width, height }) => [
      h.div(
        [
          h.Class('e3-select-box'),
          h.AriaHidden(true),
          h.Style({
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
          }),
        ],
        [],
      ),
    ],
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Arrange — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      h.div(
        [h.Class('e3-select-area')],
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
              onGestureEnd: () => Message.EndedGesture(),
            },
            h,
          ),
          ...boxOutline(model, h),
        ],
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
          'so every move can be undone. Drag empty space to orbit; shift-drag it to draw a ',
          'selection box (another submodel, after Drei’s Select), and the gizmo moves ',
          'everything selected alike.',
        ],
      ),
    ],
  ),
});
