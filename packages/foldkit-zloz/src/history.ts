import { createEditor, updateEditor } from './editor';
import { edgePath } from './geometry';
import { ZlozError, parseSnapshot, serializeSnapshot } from './graph';
import type {
  EditorEvent,
  EditorPolicy,
  EditorState,
  JsonValue,
  ZlozEdge,
  ZlozNode,
  ZlozSnapshot,
} from './types';

/** Immutable named document checkpoint. IDs and names are supplied by the host. */
export type ZlozEdition = Readonly<{ id: string; name: string; snapshot: ZlozSnapshot }>;
/** Session-only historical camera/selection. The working editor is never stored or replaced here. */
export type ZlozHistoryReview = Readonly<{ editionId: string; editor: EditorState }>;
export type ZlozHistoryChange<T> = Readonly<
  {
    id: string;
    semanticChanged: boolean;
    layoutChanged: boolean;
  } & (
    | { kind: 'added'; before: null; after: T }
    | { kind: 'removed'; before: T; after: null }
    | { kind: 'changed'; before: T; after: T }
  )
>;
export type ZlozHistoryComparison = Readonly<{
  baseline: ZlozEdition;
  selected: ZlozEdition;
  nodes: readonly ZlozHistoryChange<ZlozNode>[];
  edges: readonly ZlozHistoryChange<ZlozEdge>[];
}>;

function freeze<T>(value: T): T {
  if (record(value) || Array.isArray(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function record(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function fields(value: Record<string, JsonValue>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
/** Validate, detach and deeply freeze a checkpoint. No clocks, counters or host metadata are invented. */
export function captureEdition(input: ZlozEdition): ZlozEdition {
  if (!text(input.id) || !text(input.name))
    throw new ZlozError('invalid-edit', 'Edition ID and name must be nonempty');
  return freeze({
    id: input.id,
    name: input.name,
    snapshot: parseSnapshot(serializeSnapshot(input.snapshot)),
  });
}
/** Duplicate identities reject the complete append; existing editions are not renamed or overwritten. */
export function appendEdition(
  editions: readonly ZlozEdition[],
  edition: ZlozEdition,
): readonly ZlozEdition[] {
  if (editions.some((item) => item.id === edition.id))
    throw new ZlozError('invalid-edit', 'Duplicate edition ID');
  return Object.freeze([...editions, captureEdition(edition)]);
}
/** A separate archive envelope; canonical graph/snapshot version 1 is unchanged. */
export function serializeEditions(editions: readonly ZlozEdition[]): string {
  const checked = editions.reduce<readonly ZlozEdition[]>(
    (items, item) => appendEdition(items, item),
    [],
  );
  return JSON.stringify({ format: 'foldkit-zloz-editions', version: 1, editions: checked });
}
export function parseEditions(json: string): readonly ZlozEdition[] {
  let value: unknown;
  // oxlint-disable-next-line linteffect/no-try-catch -- Dependency-free archive decoding translates native JSON syntax failures into the core error contract.
  try {
    value = JSON.parse(json);
  } catch {
    throw new ZlozError('invalid-graph', 'Invalid edition archive JSON');
  }
  if (
    !record(value) ||
    !fields(value, ['format', 'version', 'editions']) ||
    value.format !== 'foldkit-zloz-editions' ||
    value.version !== 1 ||
    !Array.isArray(value.editions)
  )
    throw new ZlozError('invalid-graph', 'Unsupported edition archive');
  return value.editions.reduce<readonly ZlozEdition[]>((items, item: JsonValue) => {
    if (
      !record(item) ||
      !fields(item, ['id', 'name', 'snapshot']) ||
      !text(item.id) ||
      !text(item.name) ||
      !record(item.snapshot) ||
      !fields(item.snapshot, ['graph', 'viewport'])
    )
      throw new ZlozError('invalid-graph', 'Invalid edition record');
    const snapshot = parseSnapshot(JSON.stringify({ version: 1, ...item.snapshot }));
    return appendEdition(items, { id: item.id, name: item.name, snapshot });
  }, Object.freeze([]));
}
/** Rewind into a detached read-only editor. Navigation starts from the checkpoint camera, or the present camera. */
export function createHistoryReview(edition: ZlozEdition, present: EditorState): ZlozHistoryReview {
  const checked = captureEdition(edition);
  return {
    editionId: checked.id,
    editor: {
      ...createEditor(checked.snapshot.graph, {
        readOnly: true,
        viewport: checked.snapshot.viewport ?? present.viewport,
        zoomLimits: present.zoomLimits,
        fitViewPadding: present.fitViewPadding,
      }),
      surface: present.surface,
    },
  };
}
const navigation = new Set<EditorEvent['type']>([
  'NodeFocusChanged',
  'NodeSelected',
  'EdgeSelected',
  'SelectionCleared',
  'ContextDismissed',
  'PanStarted',
  'PointerMoved',
  'DragPanned',
  'PointerReleased',
  'PinchStarted',
  'PinchMoved',
  'PinchEnded',
  'GestureCancelled',
  'ZoomAreaStarted',
  'ViewportChanged',
  'ViewportNudged',
  'FitViewClicked',
  'FitSelectionClicked',
  'PreviousViewClicked',
  'NodeRevealRequested',
  'EdgeRevealRequested',
  'FitViewAnimationFrame',
  'MinimapClicked',
  'Zoomed',
  'SurfaceMeasured',
]);
export function isHistoryNavigationEvent(event: EditorEvent): boolean {
  return navigation.has(event.type);
}
/** Fail-closed navigation adapter: new editor events are not implicitly allowed in historical mode. */
export function updateHistoryReview(
  review: ZlozHistoryReview,
  event: EditorEvent,
  policy: EditorPolicy = {},
): ZlozHistoryReview {
  if (!isHistoryNavigationEvent(event)) return review;
  const editor = updateEditor(review.editor, event, policy);
  return editor === review.editor ? review : { ...review, editor };
}
function canonical<T>(value: T): string {
  return JSON.stringify(value, (_key, item: JsonValue) =>
    record(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}
function nodeMeaning(node: ZlozNode) {
  const {
    position: _position,
    size: _size,
    appearance: _appearance,
    resizeLimits: _limits,
    keepAspectRatio: _ratio,
    extent: _extent,
    expandParent: _expand,
    ports,
    ...meaning
  } = node;
  return {
    ...meaning,
    ports: ports
      .map(({ id, kind, label }) => ({ id, kind, label }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
function nodeLayout(node: ZlozNode) {
  return {
    position: node.position,
    size: node.size,
    appearance: node.appearance,
    resizeLimits: node.resizeLimits,
    keepAspectRatio: node.keepAspectRatio,
    extent: node.extent,
    expandParent: node.expandParent,
    ports: node.ports
      .map(({ id, side, ...port }) => {
        const { kind: _kind, label: _label, ...anchor } = port;
        return { id, side, ...anchor };
      })
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
function changes<T extends { id: string }, Meaning, Layout>(
  before: readonly T[],
  after: readonly T[],
  meaning: (item: T) => Meaning,
  layoutBefore: (item: T) => Layout,
  layoutAfter: (item: T) => Layout,
): readonly ZlozHistoryChange<T>[] {
  const previous = new Map(before.map((item) => [item.id, item]));
  const current = new Map(after.map((item) => [item.id, item]));
  return [...new Set([...previous.keys(), ...current.keys()])]
    .sort()
    .flatMap<ZlozHistoryChange<T>>((id) => {
      const a = previous.get(id),
        b = current.get(id);
      if (!a && b)
        return [
          { id, kind: 'added', before: null, after: b, semanticChanged: true, layoutChanged: true },
        ];
      if (a && !b)
        return [
          {
            id,
            kind: 'removed',
            before: a,
            after: null,
            semanticChanged: true,
            layoutChanged: true,
          },
        ];
      if (!a || !b) return [];
      const semanticChanged = canonical(meaning(a)) !== canonical(meaning(b));
      const layoutChanged = canonical(layoutBefore(a)) !== canonical(layoutAfter(b));
      return semanticChanged || layoutChanged
        ? [{ id, kind: 'changed', before: a, after: b, semanticChanged, layoutChanged }]
        : [];
    });
}
/** Compare stable IDs, separating authored meaning from presentation. Object-key ordering is irrelevant. */
export function compareEditions(
  baseline: ZlozEdition,
  selected: ZlozEdition,
): ZlozHistoryComparison {
  const before = baseline.snapshot.graph,
    after = selected.snapshot.graph;
  return {
    baseline,
    selected,
    nodes: changes(before.nodes, after.nodes, nodeMeaning, nodeLayout, nodeLayout),
    edges: changes(
      before.edges,
      after.edges,
      ({ pathStyle: _path, ...meaning }) => meaning,
      (edge) => ({ pathStyle: edge.pathStyle, path: edgePath(before, edge) }),
      (edge) => ({ pathStyle: edge.pathStyle, path: edgePath(after, edge) }),
    ),
  };
}

export type ZlozEditionMergeDecision =
  | Readonly<{ type: 'merged' | 'unchanged'; editions: readonly ZlozEdition[] }>
  | Readonly<{ type: 'blocked'; reason: string }>;
/** Atomic additive import. Identical identities are idempotent; conflicts never overwrite existing editions. */
export function mergeEditions(
  current: readonly ZlozEdition[],
  incoming: readonly ZlozEdition[],
): ZlozEditionMergeDecision {
  const existing = new Map(current.map((item) => [item.id, item]));
  if (existing.size !== current.length)
    return { type: 'blocked', reason: 'Current edition IDs are not unique.' };
  const checked = incoming.map(captureEdition);
  if (new Set(checked.map((item) => item.id)).size !== checked.length)
    return { type: 'blocked', reason: 'Imported edition IDs are not unique.' };
  for (const item of checked) {
    const previous = existing.get(item.id);
    if (previous && !historyValueEqual(previous, item))
      return { type: 'blocked', reason: `Conflicting edition ID: ${item.id}` };
  }
  const additions = checked.filter((item) => !existing.has(item.id));
  return additions.length === 0
    ? { type: 'unchanged', editions: current }
    : { type: 'merged', editions: Object.freeze([...current, ...additions]) };
}
/** @internal Shared JSON-value comparison at the edition transaction boundary. */
export function historyValueEqual<T>(a: T, b: T): boolean {
  return canonical(a) === canonical(b);
}
