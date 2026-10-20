/**
 * The changes collaborators share: every change to the document is an `Edit`, and every
 * tab applies the same Edits in the same order (the lockstep session decides it), so
 * every tab has the same document. `applyEdit` must therefore depend only on the
 * document and the Edit: new keys come from the document as it is when the Edit
 * applies, never from the tab that asked. What is not shared (the selection, the
 * camera, a drag in progress) follows an Edit only on the tab that made it (`mine`).
 */
import {
  History,
  Inspector,
  type Placement,
  type SceneNode,
  SceneSchema,
  type Vec3,
} from '@opsydyn/effect-three';
import { Array as Arr, Match, Option, Result, Schema } from 'effect';

import { Addable, duplicated, freshKey, nodeOf, placed, placementOf } from './document';
import type { Model } from './model';

const Path = Schema.Array(Schema.Union([Schema.String, Schema.Number]));

export const Edit = Schema.Union([
  /** A new thing of `kind`, at `at` or where new things stand. */
  Schema.TaggedStruct('Add', { kind: Addable, at: Schema.NullOr(SceneSchema.Vec3) }),
  Schema.TaggedStruct('Duplicate', { keys: Schema.Array(Schema.String) }),
  Schema.TaggedStruct('Delete', { keys: Schema.Array(Schema.String) }),
  /** Where a gizmo drag left each thing it moved. */
  Schema.TaggedStruct('Place', {
    placements: Schema.Array(
      Schema.Struct({ key: Schema.String, placement: SceneSchema.Placement }),
    ),
  }),
  /** An inspector edit: `value` at `path` in the node under `key`. */
  Schema.TaggedStruct('Field', {
    key: Schema.String,
    path: Path,
    value: Schema.Union([Schema.Number, Schema.String, Schema.Boolean]),
  }),
  Schema.TaggedStruct('Undo', {}),
  Schema.TaggedStruct('Redo', {}),
  Schema.TaggedStruct('Jump', { id: Schema.Number }),
  /** A scene file opened: its nodes and what they share replace the document. */
  Schema.TaggedStruct('Open', {
    nodes: Schema.Array(SceneSchema.SceneNode),
    resources: SceneSchema.ResourceDefinitions,
  }),
]);
export type Edit = typeof Edit.Type;

type Nodes = ReadonlyArray<SceneNode>;

const nodeIn = (nodes: Nodes, key: string): Option.Option<SceneNode> =>
  Arr.findFirst(nodes, (node) => node.key === key);

/** A finished change: the new document, recorded under `label`. */
export const changed = (model: Model, nodes: Nodes, label: string): Model => ({
  ...model,
  nodes,
  history: History.record(model.history, nodes, label),
  before: Option.none(),
  issue: Option.none(),
});

/** The document as the history has it now, and what of the selection is still in it. */
export const travelled = (model: Model, history: Model['history']): Model => {
  const nodes = History.present(history);
  const selected = model.selected.filter((key) => nodes.some((node) => node.key === key));
  return { ...model, history, nodes, selected };
};

/** What the tab that made an Edit selects after it; other tabs keep their own. */
const selecting = (model: Model, keys: ReadonlyArray<string>, mine: boolean): Model =>
  mine ? { ...model, selected: keys } : travelled(model, model.history);

const add = (model: Model, kind: Addable, at: Vec3 | null, mine: boolean): Model => {
  const key = freshKey(model.nodes, kind);
  const node = nodeOf(kind, key);
  const put = at === null ? node : placed(node, { ...placementOf(node), position: at });
  const label = `${at === null ? 'Added' : 'Placed'} ${key}`;
  return selecting(changed(model, [...model.nodes, put], label), [key], mine);
};

const duplicate = (model: Model, keys: ReadonlyArray<string>, mine: boolean): Model => {
  const copies = model.nodes
    .filter((node) => keys.includes(node.key))
    .reduce<Nodes>((made, node) => [...made, duplicated([...model.nodes, ...made], node)], []);
  if (copies.length === 0) return model;
  const made = copies.map((node) => node.key);
  const next = changed(model, [...model.nodes, ...copies], `Duplicated as ${made.join(', ')}`);
  return selecting(next, made, mine);
};

const remove = (model: Model, keys: ReadonlyArray<string>, mine: boolean): Model => {
  const nodes = model.nodes.filter((node) => !keys.includes(node.key));
  if (nodes.length === model.nodes.length) return model;
  return selecting(changed(model, nodes, `Deleted ${keys.join(', ')}`), [], mine);
};

const place = (
  model: Model,
  placements: ReadonlyArray<{ readonly key: string; readonly placement: Placement }>,
): Model => {
  const nodes = model.nodes.map((node) =>
    Option.match(
      Arr.findFirst(placements, (each) => each.key === node.key),
      { onNone: () => node, onSome: ({ placement }) => placed(node, placement) },
    ),
  );
  return changed(model, nodes, `Moved ${placements.map((each) => each.key).join(', ')}`);
};

/** An inspector edit; one the document no longer allows (another tab's change) is skipped. */
type FieldEdit = Extract<Edit, { readonly _tag: 'Field' }>;

const withEdited = (model: Model, edited: SceneNode, edit: FieldEdit): Model =>
  changed(
    model,
    model.nodes.map((each) => (each.key === edit.key ? edited : each)),
    `Edited ${edit.key} ${edit.path.join(' ')}`,
  );

const fieldOf = (model: Model, node: SceneNode, edit: FieldEdit): Model =>
  Result.match(Inspector.edit(SceneSchema.SceneNode, node, edit.path, edit.value), {
    onFailure: () => model,
    onSuccess: (edited) => withEdited(model, edited, edit),
  });

const field = (model: Model, edit: FieldEdit): Model =>
  Option.match(nodeIn(model.nodes, edit.key), {
    onNone: () => model,
    onSome: (node) => fieldOf(model, node, edit),
  });

/** `edit` applied to the document; `mine` when this tab made it. */
export const applyEdit = (model: Model, edit: Edit, mine: boolean): Model =>
  Match.valueTags(edit, {
    Add: ({ kind, at }) => add(model, kind, at, mine),
    Duplicate: ({ keys }) => duplicate(model, keys, mine),
    Delete: ({ keys }) => remove(model, keys, mine),
    Place: ({ placements }) => place(model, placements),
    Field: (fieldEdit) => field(model, fieldEdit),
    Undo: () => travelled(model, History.undo(model.history)),
    Redo: () => travelled(model, History.redo(model.history)),
    Jump: ({ id }) => travelled(model, History.jumpTo(model.history, id)),
    Open: ({ nodes, resources }) =>
      selecting({ ...changed(model, nodes, 'Opened a file'), resources }, [], mine),
  });
