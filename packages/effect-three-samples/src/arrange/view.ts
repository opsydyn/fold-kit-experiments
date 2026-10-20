import { History, Inspector } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import { type Model, Thing } from './model';
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

const undoable = (model: Model): string => {
  const ways = History.branches(model.history).length;
  const branched = ways > 1 ? ` ${ways} ways forward from here.` : '';
  return `${History.depth(model.history)} moves to undo.${branched}`;
};

/** Which branch redo takes, when there is more than one. */
const branchLabel = (model: Model): string => {
  const choices = History.branches(model.history);
  const taken = choices.findIndex((entry) => entry.id === History.presentEntry(model.history).next);
  return `Branch ${taken + 1} of ${choices.length}`;
};

/** One selected thing and where it is. */
const placed = (model: Model, { key, placement }: Thing): string =>
  `${key}: at ${placement.position.map(figure).join(', ')}, turned ${placement.rotation
    .map((angle) => `${Math.round((angle * 180) / Math.PI)}°`)
    .join(', ')}, scaled ${placement.scale.map(figure).join(', ')}. ${undoable(model)}`;

/** What is selected and where, read from the Model. */
/** What the tape says while measuring. */
const measurement = (model: Model): string =>
  Option.match(EffectThreeFoldkit.MeasuringTape.length(model.tape), {
    onNone: () => 'Measuring: click a point on the table or a thing, then another.',
    onSome: (length) =>
      model.tape.tape.to === null
        ? `${length.toFixed(2)} so far: click to place the other end.`
        : `${length.toFixed(2)} units between the ends. Click again to start a new tape.`,
  });

const readout = (model: Model): string => {
  if (model.measuring) return measurement(model);
  const selected = model.things.filter((thing) => model.selected.includes(thing.key));
  const [only] = selected;
  if (selected.length > 1) {
    return `${selected.map((thing) => thing.key).join(', ')} selected: the gizmo on ${model.selected[0] ?? ''} moves them alike. ${undoable(model)}`;
  }
  return only === undefined
    ? 'Click something on the table to move, turn or scale it, or shift-drag to box several.'
    : placed(model, only);
};

/**
 * The one selected thing's fields, read from the `Thing` schema (its key is how the
 * page finds it, so it is left out), and why the last edit was refused, if it was.
 */
const inspector = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const selected = model.things.filter((thing) => model.selected.includes(thing.key));
  const [only] = selected;
  if (only === undefined || selected.length > 1 || model.measuring) return [];
  const fields = Inspector.fields(Thing, only).filter((field) => field.path[0] !== 'key');
  return [
    h.section(
      [h.Class('e3-inspector-panel'), h.AriaLabel(`${only.key}, inspected`)],
      [
        h.h3([], [`Inspector: ${only.key}`]),
        EffectThreeFoldkit.inspectorView(h, fields, (path, value) =>
          Message.EditedThing({ key: only.key, path, value }),
        ),
        ...Option.match(model.inspectorIssue, {
          onNone: () => [],
          onSome: (issue) => [h.p([h.Class('e3-inspector-issue'), h.Role('alert')], [issue])],
        }),
      ],
    ),
  ];
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
              overlays: EffectThreeFoldkit.MeasuringTape.label(model.tape, h, {
                unit: 'units',
                className: 'e3-tape-label',
              }),
              onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
              onPointerDown: ({ key, point, ray }) =>
                Message.PressedScene({ key, point, origin: ray.origin, direction: ray.direction }),
              onDrag: ({ ray }) =>
                Message.DraggedScene({ origin: ray.origin, direction: ray.direction }),
              onDragEnd: () => Message.ReleasedScene(),
              onClick: ({ key, point }) => Message.ClickedThing({ key, point }),
              onPointerMove: ({ point }) => Message.MovedOver({ point }),
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
          toggle(h, 'Pivot', model.style === 'pivot', Message.ClickedPivot()),
          toggle(h, 'Measure', model.measuring, Message.ClickedMeasure()),
          button(h, 'Undo', History.canUndo(model.history), Message.ClickedUndo()),
          button(h, 'Redo', History.canRedo(model.history), Message.ClickedRedo()),
          ...(History.branches(model.history).length > 1
            ? [button(h, branchLabel(model), true, Message.ClickedBranch())]
            : []),
        ],
      ),
      ...inspector(model, h),
      h.p(
        [h.Class('e3-note')],
        [
          'The gizmo is a Foldkit submodel: its handles are scene nodes, a press and the drag ',
          'rays after it are Messages, and each move comes back to the page as an OutMessage, ',
          'so every move can be undone. Drag empty space to orbit; shift-drag it to draw a ',
          'selection box (another submodel, after Drei’s Select), and the gizmo moves ',
          'everything selected alike. The axes in the corner turn the camera to look along ',
          'one: a third submodel, drawn in the scene’s HUD. Pivot swaps the gizmo for Drei’s ',
          'pivot controls, a fourth: arrows, squares, arcs and spheres all at once. Measure ',
          'turns clicks into a tape between two points, a fifth. The inspector below the ',
          'controls is generated from the Thing schema, which checks every edit.',
        ],
      ),
    ],
  ),
});
