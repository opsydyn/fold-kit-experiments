import {
  describeScene,
  type FieldPath,
  type FieldValue,
  type Gesture,
  History,
  Inspector,
  movedAlike,
  orbit,
  type Placement,
  scene,
  type SceneDescription,
  type SceneNode,
  SceneFile,
  SceneSchema,
  shotCamera,
  type ShotAngle,
  type Vec3,
} from '@opsydyn/effect-three';
import { BoxSelect, TransformGizmo, ViewportGizmo } from '@opsydyn/effect-three-foldkit';
import { Array as Arr, Option, Result } from 'effect';
import type { Return } from 'foldkit/update';

import { DownloadFile, ReadText } from './command';
import {
  type Addable,
  duplicated,
  freshKey,
  nodeKeyOf,
  nodeOf,
  placed,
  placementOf,
  selectableOf,
} from './document';
import { Message } from './message';
import type { Model } from './model';

type AppReturn = Return<Model, Message>;
type Nodes = ReadonlyArray<SceneNode>;

const snaps = { translationSnap: 0.25, rotationSnap: Math.PI / 12, scaleSnap: 0.25 } as const;
const free = { translationSnap: null, rotationSnap: null, scaleSnap: null } as const;

const nodeIn = (nodes: Nodes, key: string): Option.Option<SceneNode> =>
  Arr.findFirst(nodes, (node) => node.key === key);

/** A finished change: the new document, recorded under `label`. */
const changed = (model: Model, nodes: Nodes, label: string): Model => ({
  ...model,
  nodes,
  history: History.record(model.history, nodes, label),
  before: Option.none(),
  issue: Option.none(),
});

/** The document as the history has it now, and what of the selection is still in it. */
const travelled = (model: Model, history: Model['history']): Model => {
  const nodes = History.present(history);
  const selected = model.selected.filter((key) => nodes.some((node) => node.key === key));
  return { ...model, history, nodes, selected };
};

// THE GIZMO

/** Each node after the gizmo put the first selected at `placement`; the rest move alike. */
const placeSelected = (model: Model, placement: Placement): Model => {
  const before = Option.getOrElse(model.before, () => model.nodes);
  const first = Option.flatMap(Arr.head(model.selected), (key) => nodeIn(before, key));
  return Option.match(first, {
    onNone: () => model,
    onSome: (moved) => ({
      ...model,
      nodes: model.nodes.map((node) => {
        const was = Option.getOrElse(nodeIn(before, node.key), () => node);
        if (node.key === moved.key) return placed(node, placement);
        if (!model.selected.includes(node.key)) return node;
        return placed(node, movedAlike(placementOf(moved), placement, placementOf(was)));
      }),
    }),
  });
};

const fromGizmo = (model: Model, out: TransformGizmo.OutMessage): Model =>
  TransformGizmo.OutMessage.match(out, {
    Moved: ({ placement }) => placeSelected(model, placement),
    Finished: ({ placement }) => {
      const next = placeSelected(model, placement);
      return changed(next, next.nodes, `Moved ${model.selected.join(', ')}`);
    },
  });

const withGizmo = (model: Model, message: TransformGizmo.Message): Model => {
  const result = TransformGizmo.update(model.gizmo, message);
  const next = { ...model, gizmo: result.model };
  return result.outMessage === undefined ? next : fromGizmo(next, result.outMessage);
};

const pressGizmo = (model: Model, key: string, origin: Vec3, direction: Vec3): Model => {
  const first = Option.flatMap(Arr.head(model.selected), (selected) =>
    nodeIn(model.nodes, selected),
  );
  return Option.match(Option.all([TransformGizmo.handleOf(model.gizmo, key), first]), {
    onNone: () => model,
    onSome: ([handle, node]) =>
      withGizmo(
        { ...model, before: Option.some(model.nodes) },
        TransformGizmo.Message.Pressed({
          handle,
          origin,
          direction,
          placement: placementOf(node),
          camera: model.camera,
        }),
      ),
  });
};

const whileHeld = (model: Model, message: TransformGizmo.Message): Model =>
  TransformGizmo.held(model.gizmo) ? withGizmo(model, message) : model;

// THE VIEWPORT GIZMO

const withView = (model: Model, message: ViewportGizmo.Message): Model => {
  const result = ViewportGizmo.update(model.view, message);
  return { ...model, view: result.model, camera: result.outMessage?.camera ?? model.camera };
};

const press = (model: Model, key: string, origin: Vec3, direction: Vec3): Model =>
  Option.isSome(ViewportGizmo.axisOf(model.view, key))
    ? withView(
        { ...model, pressedView: true },
        ViewportGizmo.Message.Pressed({ key, camera: model.camera }),
      )
    : pressGizmo({ ...model, pressedView: false }, key, origin, direction);

const hover = (model: Model, key: string): Model => {
  const gizmo = Option.match(TransformGizmo.handleOf(model.gizmo, key), {
    onNone: () => model,
    onSome: (handle) => withGizmo(model, TransformGizmo.Message.Hovered({ handle })),
  });
  return withView(gizmo, ViewportGizmo.Message.Entered({ key }));
};

const leave = (model: Model, key: string): Model => {
  const gizmo = Option.isSome(TransformGizmo.handleOf(model.gizmo, key))
    ? withGizmo(model, TransformGizmo.Message.Hovered({ handle: null }))
    : model;
  return withView(gizmo, ViewportGizmo.Message.Left({ key }));
};

// SELECTING

const select = (
  model: Model,
  path: { readonly key: string; readonly path: ReadonlyArray<string> },
) =>
  Option.match(Option.fromNullishOr(nodeKeyOf(model.nodes, path)), {
    onNone: () => ({ ...model, pressedView: false }),
    onSome: (key) => ({ ...model, selected: [key], pressedView: false }),
  });

const clickNothing = (model: Model): Model =>
  model.pressedView ? { ...model, pressedView: false } : { ...model, selected: [] };

const offNodes = (gesture: Gesture): boolean => !('key' in gesture) || gesture.key === undefined;

const gesture = (model: Model, made: Gesture): Model => {
  if (made._tag === 'Drag' && BoxSelect.claims(model.box, made)) {
    return { ...model, box: BoxSelect.update(model.box, BoxSelect.dragOf(made)).model };
  }
  return !TransformGizmo.held(model.gizmo) && offNodes(made)
    ? { ...model, camera: orbit(model.camera, made) }
    : model;
};

const endBox = (model: Model): Model => {
  const result = BoxSelect.update(
    model.box,
    BoxSelect.Message.Ended({ camera: model.camera, selectable: selectableOf(model.nodes) }),
  );
  return { ...model, box: result.model, selected: result.outMessage?.keys ?? model.selected };
};

// EDITING

const add = (model: Model, kind: Addable): Model => {
  const key = freshKey(model.nodes, kind);
  return {
    ...changed(model, [...model.nodes, nodeOf(kind, key)], `Added ${key}`),
    selected: [key],
  };
};

const duplicate = (model: Model): Model => {
  const copies = model.nodes
    .filter((node) => model.selected.includes(node.key))
    .reduce<Nodes>((made, node) => [...made, duplicated([...model.nodes, ...made], node)], []);
  if (copies.length === 0) return model;
  const keys = copies.map((node) => node.key);
  return {
    ...changed(model, [...model.nodes, ...copies], `Duplicated as ${keys.join(', ')}`),
    selected: keys,
  };
};

const remove = (model: Model): Model => {
  if (model.selected.length === 0) return model;
  const nodes = model.nodes.filter((node) => !model.selected.includes(node.key));
  return { ...changed(model, nodes, `Deleted ${model.selected.join(', ')}`), selected: [] };
};

const refused = (model: Model, issue: string): Model => ({ ...model, issue: Option.some(issue) });

const withEdited = (model: Model, edited: SceneNode, path: FieldPath): Model =>
  changed(
    model,
    model.nodes.map((each) => (each.key === edited.key ? edited : each)),
    `Edited ${edited.key} ${path.join(' ')}`,
  );

/** An inspector edit to `node`, checked by the scene's own node schema. */
const applyEdit = (model: Model, node: SceneNode, path: FieldPath, value: FieldValue): Model =>
  Result.match(Inspector.edit(SceneSchema.SceneNode, node, path, value), {
    onFailure: (issue) => refused(model, issue),
    onSuccess: (edited) => withEdited(model, edited, path),
  });

/** An inspector edit to the node under `key`; refused, it says why. */
const editNode = (model: Model, key: string, path: FieldPath, value: FieldValue): Model =>
  Option.match(nodeIn(model.nodes, key), {
    onNone: () => model,
    onSome: (node) => applyEdit(model, node, path, value),
  });

/** A thing of `kind` put at `at`, selected, as a step. */
const place = (model: Model, kind: Addable, at: Vec3): Model => {
  const key = freshKey(model.nodes, kind);
  const node = placed(nodeOf(kind, key), { ...placementOf(nodeOf(kind, key)), position: at });
  return { ...changed(model, [...model.nodes, node], `Placed ${key}`), selected: [key] };
};

/** The things to frame: those named that are in the document, or all of them. */
const subjectOf = (model: Model, keys: ReadonlyArray<string>): ReadonlyArray<SceneNode> => {
  const named = model.nodes.filter((node) => keys.includes(node.key));
  return named.length === 0 ? model.nodes : named;
};

/** The camera framing the subject from `angle`; with nothing of known size, as it was. */
const frame = (model: Model, keys: ReadonlyArray<string>, angle: ShotAngle): Model => {
  const bounds = describeScene(
    scene({ resources: model.resources, children: subjectOf(model, keys) }),
  ).bounds;
  return bounds === null ? model : { ...model, camera: shotCamera(model.camera, bounds, angle) };
};

const toggleSnapping = (model: Model): Model => {
  const snapping = !model.snapping;
  return {
    ...model,
    snapping,
    gizmo: { ...model.gizmo, gizmo: { ...model.gizmo.gizmo, ...(snapping ? snaps : free) } },
  };
};

// FILES

/** The document as a scene file: its nodes and what they share, in a scene of their own. */
const fileText = (model: Model): string =>
  SceneFile.save(scene({ resources: model.resources, children: model.nodes }));

const save = (model: Model): AppReturn => ({
  model: { ...model, saved: model.nodes },
  commands: [DownloadFile({ name: 'scene.json', text: fileText(model) })],
});

/** A scene opened from a file: its nodes become the document, recorded and saved. */
const opened = (model: Model, loaded: SceneDescription): Model => ({
  ...changed(model, loaded.children, 'Opened a file'),
  resources: loaded.resources,
  saved: loaded.children,
  selected: [],
});

/** A file read: its scene opened, or why it cannot be. */
const load = (model: Model, text: string): Model =>
  Result.match(SceneFile.read(text), {
    onFailure: (error) => refused(model, `That file is not a scene: ${error.issue}`),
    onSuccess: (loaded) => opened(model, loaded),
  });

/** The first file chosen is read; choosing none does nothing. */
const chooseFiles = (model: Model, files: ReadonlyArray<File>): AppReturn =>
  Option.match(Arr.head(files), {
    onNone: () => ({ model }),
    onSome: (file) => ({ model, commands: [ReadText({ file })] }),
  });

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    PressedScene: ({ key, origin, direction }) => ({ model: press(model, key, origin, direction) }),
    DraggedScene: ({ origin, direction }) => ({
      model: whileHeld(model, TransformGizmo.Message.Dragged({ origin, direction })),
    }),
    ReleasedScene: () => ({ model: whileHeld(model, TransformGizmo.Message.Released()) }),
    ClickedScene: (hit) => ({ model: select(model, hit) }),
    ClickedNothing: () => ({ model: clickNothing(model) }),
    HoveredScene: ({ key }) => ({ model: hover(model, key) }),
    LeftScene: ({ key }) => ({ model: leave(model, key) }),
    MadeGesture: ({ gesture: made }) => ({ model: gesture(model, made) }),
    EndedGesture: () => ({ model: endBox(model) }),
    ClickedAdd: ({ kind }) => ({ model: add(model, kind) }),
    PlacedThing: ({ kind, at }) => ({ model: place(model, kind, at) }),
    FramedShot: ({ subject, angle }) => ({ model: frame(model, subject, angle) }),
    ChoseMood: ({ mood }) => ({ model: { ...model, mood } }),
    ClickedOutlined: ({ key }) => ({ model: { ...model, selected: [key] } }),
    ClickedDuplicate: () => ({ model: duplicate(model) }),
    ClickedDelete: () => ({ model: remove(model) }),
    ChoseMode: ({ mode }) => ({
      model: withGizmo(model, TransformGizmo.Message.ChoseMode({ mode })),
    }),
    ClickedSnapping: () => ({ model: toggleSnapping(model) }),
    ClickedUndo: () => ({ model: travelled(model, History.undo(model.history)) }),
    ClickedRedo: () => ({ model: travelled(model, History.redo(model.history)) }),
    ClickedStep: ({ id }) => ({ model: travelled(model, History.jumpTo(model.history, id)) }),
    EditedNode: ({ key, path, value }) => ({ model: editNode(model, key, path, value) }),
    ClickedSave: () => save(model),
    ChoseFiles: ({ files }) => chooseFiles(model, files),
    ReadFile: ({ text }) => ({ model: load(model, text) }),
    CompletedDownload: () => ({ model }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
