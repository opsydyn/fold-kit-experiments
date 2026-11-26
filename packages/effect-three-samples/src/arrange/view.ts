import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { History, Inspector, overlay, tapeMiddle } from '@opsydyn/effect-three';
import { BoxSelect, MeasuringTape } from '@opsydyn/effect-three-foldkit/browser';
import { Option } from 'effect';

import { inspectorView } from '../effect-ui-inspector';
import { sceneOverlayLayer, type SceneOverlay, withSceneOverlays } from '../effect-ui-overlays';
import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
import { Message } from './message';
import { type Model, Thing } from './model';
import { sceneFor } from './scene';

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const toggle = (h: Html.H<Message>, label: string, on: boolean, message: Message) =>
  button(h, label, message).attr('aria-pressed', String(on));

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
  Option.match(MeasuringTape.length(model.tape), {
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
const inspector = (model: Model, h: Html.H<Message>) => {
  const selected = model.things.filter((thing) => model.selected.includes(thing.key));
  const [only] = selected;
  if (only === undefined || selected.length > 1 || model.measuring) return undefined;
  const fields = Inspector.fields(Thing, only).filter((field) => field.path[0] !== 'key');
  return h.section
    .class('e3-inspector-panel')
    .attr('aria-label', `${only.key}, inspected`)
    .children(
      h.h3(`Inspector: ${only.key}`),
      inspectorView(h, fields, (path, value) =>
        Message.EditedThing({ key: only.key, path, value }),
      ),
      Option.match(model.inspectorIssue, {
        onNone: () => null,
        onSome: (issue) => h.p.class('e3-inspector-issue').attr('role', 'alert').children(issue),
      }),
    );
};

const boxOutline = (model: Model, h: Html.H<Message>) =>
  Option.match(BoxSelect.rectangle(model.box), {
    onNone: () => null,
    onSome: ({ left, top, width, height }) =>
      h.div
        .class('e3-select-box')
        .attr('aria-hidden', 'true')
        .style({ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })
        .children(),
  });

const tapeLabel = (model: Model, h: Html.H<Message>): ReadonlyArray<SceneOverlay<Message>> =>
  Option.toArray(
    Option.map(
      Option.all([
        MeasuringTape.length(model.tape),
        Option.fromNullishOr(tapeMiddle(model.tape.tape)),
      ]),
      ([length, position]) => ({
        overlay: overlay({ key: `${model.tape.key}:label`, position, center: true }),
        content: h.span.class('e3-tape-label').children(`${length.toFixed(2)} units`),
        pointerEvents: 'none',
      }),
    ),
  );

export const view = (h: Html.H<Message>, model: Model) => {
  const overlays = tapeLabel(model, h);
  const scene = withSceneOverlays(sceneFor(model), overlays);
  return h.div.class('e3-sample').children(
    h.div.class('e3-select-area').children(
      EffectThreeStage(h)
        .class('e3-stage', 'e3-stage-tall')
        .on('scene-pointer-down', ({ key, point, ray }) =>
          Message.PressedScene({ key, point, origin: ray.origin, direction: ray.direction }),
        )
        .on('scene-drag', ({ ray }) =>
          Message.DraggedScene({ origin: ray.origin, direction: ray.direction }),
        )
        .on('scene-drag-end', Message.ReleasedScene())
        .on('scene-click', ({ key, point }) => Message.ClickedThing({ key, point }))
        .on('scene-pointer-move', ({ point }) => Message.MovedOver({ point }))
        .on('scene-pointer-missed', Message.ClickedNothing())
        .on('scene-pointer-enter', ({ key }) => Message.HoveredScene({ key }))
        .on('scene-pointer-leave', ({ key }) => Message.LeftScene({ key }))
        .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
        .on('scene-gesture-end', Message.EndedGesture())
        .onMount(
          Mount.map(unlabelledSceneMount({ scene }), (lifecycle) =>
            Message.ReceivedSceneLifecycle({ lifecycle }),
          ),
        )
        .children(sceneOverlayLayer(h, overlays)),
      boxOutline(model, h),
    ),
    h.p.class('e3-readout').attr('aria-live', 'polite').children(readout(model)),
    h.div
      .class('e3-controls')
      .children(
        ...modes.map(([mode, label]) =>
          toggle(h, label, model.gizmo.gizmo.mode === mode, Message.ChoseMode({ mode })),
        ),
        toggle(h, 'Local axes', model.gizmo.gizmo.space === 'local', Message.ClickedSpace()),
        toggle(h, 'Snap', model.snapping, Message.ClickedSnapping()),
        toggle(h, 'Pivot', model.style === 'pivot', Message.ClickedPivot()),
        toggle(h, 'Measure', model.measuring, Message.ClickedMeasure()),
        button(h, 'Undo', Message.ClickedUndo()).disabled(!History.canUndo(model.history)),
        button(h, 'Redo', Message.ClickedRedo()).disabled(!History.canRedo(model.history)),
        History.branches(model.history).length > 1
          ? button(h, branchLabel(model), Message.ClickedBranch())
          : null,
      ),
    inspector(model, h),
    h.p
      .class('e3-note')
      .children(
        'Drag a gizmo handle to move the selection. Each finished move is recorded for undo. ',
        'Drag empty space to orbit or Shift-drag to select several things. Click a corner axis ',
        'to turn the camera. Pivot changes the gizmo, and Measure turns two scene clicks into a tape. ',
        'The inspector is generated from the Thing schema, which checks every edit.',
      ),
  );
};
