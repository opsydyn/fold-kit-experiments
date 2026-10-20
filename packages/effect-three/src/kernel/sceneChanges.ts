/**
 * Scene diffs for review (roadmap, "Beyond parity" 4): what changed between two
 * descriptions, in the kernel's own terms (the operations `diff` would apply, plus the
 * scene-wide settings the graph applies beside them), as typed changes and as lines a
 * person reads in review. `formatChanges` writes one line per change:
 *
 * ```text
 * + Mesh crate in table
 * - Light sun
 * ~ crate: position, rotation
 * > crate to shelf
 * = order of the root: table, crate
 * ⋯ scene: camera, environment
 * ```
 *
 * Changes inside the HUD and render textures are listed after them, each line prefixed
 * with where it is (`hud`, `texture screen`).
 *
 * @module
 */
import type { SceneDescription, SceneNode } from './description.ts';
import { diff, type Field, type Op } from './diff.ts';
import { type DescriptionError, emptyIndex, indexScene, type ParentKey } from './sceneIndex.ts';

/** A scene-wide part of a description, which changes as a whole. */
export type SceneSetting =
  | 'camera'
  | 'views'
  | 'render'
  | 'resources'
  | 'gestures'
  | 'overlays'
  | 'environment'
  | 'sky'
  | 'contactShadows'
  | 'physics'
  | 'xr'
  | 'measure';

/** Where a change is: the scene, its HUD, or one of its render textures. */
export type ChangePlace = 'scene' | 'hud' | { readonly texture: string };

export type SceneChange = { readonly place: ChangePlace } & (
  | {
      readonly _tag: 'Added';
      readonly key: string;
      readonly kind: SceneNode['_tag'];
      readonly parent: ParentKey;
    }
  | { readonly _tag: 'Removed'; readonly key: string }
  | { readonly _tag: 'Replaced'; readonly key: string; readonly kind: SceneNode['_tag'] }
  | { readonly _tag: 'Changed'; readonly key: string; readonly fields: ReadonlyArray<Field> }
  | { readonly _tag: 'Moved'; readonly key: string; readonly parent: ParentKey }
  | { readonly _tag: 'Reordered'; readonly parent: ParentKey; readonly keys: ReadonlyArray<string> }
  | { readonly _tag: 'Settings'; readonly settings: ReadonlyArray<SceneSetting> }
  | { readonly _tag: 'HudAdded' }
  | { readonly _tag: 'HudRemoved' }
  | { readonly _tag: 'TextureAdded'; readonly id: string }
  | { readonly _tag: 'TextureRemoved'; readonly id: string }
);

export type SceneChanges =
  | { readonly _tag: 'Changes'; readonly changes: ReadonlyArray<SceneChange> }
  /** The second description is not a valid scene: why, as `reconcile` would say. */
  | { readonly _tag: 'Invalid'; readonly error: DescriptionError };

/** Settings `diff` reports as operations; the rest are compared here. */
const settingOf: Partial<Record<Op['_tag'], SceneSetting>> = {
  SetCamera: 'camera',
  SetViews: 'views',
  SetRenderSettings: 'render',
  DefineResources: 'resources',
};

const comparedSettings = [
  'gestures',
  'overlays',
  'environment',
  'sky',
  'contactShadows',
  'physics',
  'xr',
  'measure',
] as const satisfies ReadonlyArray<SceneSetting>;

const entriesOf = (value: object): ReadonlyArray<readonly [string, unknown]> =>
  Object.entries(value);

/** Descriptions are plain data: equal when every array item and field is. */
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const fieldsA = entriesOf(a);
  const fieldsB = new Map(entriesOf(b));
  return (
    fieldsA.length === fieldsB.size &&
    fieldsA.every(([key, value]) => fieldsB.has(key) && same(value, fieldsB.get(key)))
  );
};

const nodeChange = (op: Op, place: ChangePlace): ReadonlyArray<SceneChange> => {
  switch (op._tag) {
    case 'Create':
      return [{ place, _tag: 'Added', key: op.node.key, kind: op.node._tag, parent: op.parent }];
    case 'Remove':
      return [{ place, _tag: 'Removed', key: op.key }];
    case 'Replace':
      return [{ place, _tag: 'Replaced', key: op.node.key, kind: op.node._tag }];
    case 'Update':
      return [{ place, _tag: 'Changed', key: op.node.key, fields: op.fields }];
    case 'Move':
      return [{ place, _tag: 'Moved', key: op.key, parent: op.parent }];
    case 'Order':
      return [{ place, _tag: 'Reordered', parent: op.parent, keys: op.keys }];
    default:
      return [];
  }
};

/** Every behaviour a scene names: a review judges what changed, not what is registered. */
const behavioursIn = (description: SceneDescription): ReadonlySet<string> => {
  const names = new Set<string>();
  const visit = (node: SceneNode): void => {
    if ('behaviour' in node && node.behaviour !== null) names.add(node.behaviour.name);
    if (node._tag === 'Group') node.children.forEach(visit);
  };
  description.children.forEach(visit);
  return names;
};

/** Where `before` starts from: its index, or nothing when it is itself invalid. */
const startOf = (before: SceneDescription) => {
  const indexed = indexScene(before, behavioursIn(before));
  return indexed._tag === 'Indexed' ? indexed.index : emptyIndex;
};

const isSetting = (setting: SceneSetting | undefined): setting is SceneSetting =>
  setting !== undefined;

const settingsOf = (
  before: SceneDescription,
  after: SceneDescription,
  ops: ReadonlyArray<Op>,
): ReadonlyArray<SceneSetting> => [
  ...ops.map((op) => settingOf[op._tag]).filter(isSetting),
  ...comparedSettings.filter((setting) => !same(before[setting], after[setting])),
];

/** The changes to one scene's nodes and settings, or why `after` is invalid. */
const changesIn = (
  before: SceneDescription,
  after: SceneDescription,
  place: ChangePlace,
): SceneChanges => {
  const result = diff(startOf(before), after, behavioursIn(after));
  if (result._tag === 'Invalid') return result;
  const settings = settingsOf(before, after, result.ops);
  const settingsChange: ReadonlyArray<SceneChange> =
    settings.length === 0 ? [] : [{ place, _tag: 'Settings', settings }];
  return {
    _tag: 'Changes',
    changes: [...settingsChange, ...result.ops.flatMap((op) => nodeChange(op, place))],
  };
};

/** A nested scene (a HUD or a render texture) as a description of its own. */
const nestedScene = (parent: SceneDescription, children: ReadonlyArray<SceneNode>) =>
  ({ ...parent, hud: null, renderTextures: [], children }) satisfies SceneDescription;

const hudChanges = (before: SceneDescription, after: SceneDescription): SceneChanges => {
  if (before.hud === null && after.hud === null) return { _tag: 'Changes', changes: [] };
  if (after.hud === null)
    return { _tag: 'Changes', changes: [{ place: 'hud', _tag: 'HudRemoved' }] };
  const added: ReadonlyArray<SceneChange> =
    before.hud === null ? [{ place: 'hud', _tag: 'HudAdded' }] : [];
  const inside = changesIn(
    nestedScene(before, before.hud?.children ?? []),
    nestedScene(before, after.hud.children),
    'hud',
  );
  return inside._tag === 'Invalid'
    ? inside
    : { _tag: 'Changes', changes: [...added, ...inside.changes] };
};

const textureChanges = (before: SceneDescription, after: SceneDescription): SceneChanges => {
  const changes: Array<SceneChange> = [];
  for (const texture of after.renderTextures) {
    const was = before.renderTextures.find((candidate) => candidate.id === texture.id);
    const place = { texture: texture.id };
    if (was === undefined) changes.push({ place, _tag: 'TextureAdded', id: texture.id });
    const inside = changesIn(
      nestedScene(before, was?.children ?? []),
      nestedScene(before, texture.children),
      place,
    );
    if (inside._tag === 'Invalid') return inside;
    changes.push(...inside.changes);
  }
  for (const texture of before.renderTextures) {
    if (!after.renderTextures.some((candidate) => candidate.id === texture.id)) {
      changes.push({ place: { texture: texture.id }, _tag: 'TextureRemoved', id: texture.id });
    }
  }
  return { _tag: 'Changes', changes };
};

/**
 * What changed from `before` to `after`: the scene's settings and nodes, then its HUD's
 * and its render textures'. Invalid when `after` is not a valid scene; a `before` that
 * is not is compared as though it were empty.
 */
export const sceneChanges = (before: SceneDescription, after: SceneDescription): SceneChanges => {
  const parts = [
    changesIn(before, after, 'scene'),
    hudChanges(before, after),
    textureChanges(before, after),
  ];
  const invalid = parts.find((part) => part._tag === 'Invalid');
  if (invalid !== undefined) return invalid;
  return {
    _tag: 'Changes',
    changes: parts.flatMap((part) => (part._tag === 'Changes' ? part.changes : [])),
  };
};

const placeLabel = (place: ChangePlace): string => {
  if (place === 'scene') return '';
  return place === 'hud' ? 'hud ' : `texture ${place.texture} `;
};

const parentLabel = (parent: ParentKey): string => (parent === null ? 'the root' : parent);

const lineOf = (change: SceneChange): string => {
  const where = placeLabel(change.place);
  switch (change._tag) {
    case 'Added':
      return `${where}+ ${change.kind} ${change.key}${change.parent === null ? '' : ` in ${change.parent}`}`;
    case 'Removed':
      return `${where}- ${change.key}`;
    case 'Replaced':
      return `${where}± ${change.key}, now a ${change.kind}`;
    case 'Changed':
      return `${where}~ ${change.key}: ${change.fields.join(', ')}`;
    case 'Moved':
      return `${where}> ${change.key} to ${parentLabel(change.parent)}`;
    case 'Reordered':
      return `${where}= order of ${parentLabel(change.parent)}: ${change.keys.join(', ')}`;
    case 'Settings':
      return `${where}⋯ scene: ${change.settings.join(', ')}`;
    case 'HudAdded':
      return '+ hud';
    case 'HudRemoved':
      return '- hud';
    case 'TextureAdded':
      return `+ texture ${change.id}`;
    case 'TextureRemoved':
      return `- texture ${change.id}`;
  }
};

/** The changes as lines for review, one per change; `No changes.` when there are none. */
export const formatChanges = (changes: ReadonlyArray<SceneChange>): string =>
  changes.length === 0 ? 'No changes.' : changes.map(lineOf).join('\n');
