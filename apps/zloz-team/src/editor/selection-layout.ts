import {
  applyPreviewLayout,
  createEditor,
  layoutRequest,
  type Point,
  type ZlozGraph,
  type ZlozNode,
  type ZlozOperationDocument,
} from '@opsydyn/foldkit-zloz';
import { Match, Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

export class SelectionLayoutError extends Error {}
export const Direction = Schema.Literals(['RIGHT', 'DOWN']);
export const Method = Schema.Literals([
  'elk',
  'align-left',
  'align-top',
  'distribute-horizontal',
  'distribute-vertical',
]);
export type Method = typeof Method.Type;
export const methods = {
  elk: { label: 'Auto layout (ELK)', minimum: 2 },
  'align-left': { label: 'Align left', minimum: 2 },
  'align-top': { label: 'Align top', minimum: 2 },
  'distribute-horizontal': { label: 'Distribute horizontally', minimum: 3 },
  'distribute-vertical': { label: 'Distribute vertically', minimum: 3 },
} as const satisfies Readonly<Record<Method, { label: string; minimum: number }>>;
const Geometry = Schema.Struct({ id: Schema.String, expected: Schema.Number });
const Move = Schema.Struct({
  ...Geometry.fields,
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
});
export const Proposal = Schema.Struct({
  selection: Schema.Array(Schema.String),
  parent: Schema.NullOr(Geometry),
  moves: Schema.Array(Move),
});
export type Proposal = typeof Proposal.Type;
export const Task = defineTaggedUnion({
  Closed: {},
  Running: {},
  Ready: { proposal: Proposal },
  Failed: { message: Schema.String },
});

const bounds = (nodes: readonly ZlozNode[]) => ({
  left: Math.min(...nodes.map(({ position }) => position.x)),
  top: Math.min(...nodes.map(({ position }) => position.y)),
  right: Math.max(...nodes.map(({ position, size }) => position.x + size.width)),
  bottom: Math.max(...nodes.map(({ position, size }) => position.y + size.height)),
});

async function elkDestinations(
  graph: ZlozGraph,
  roots: readonly ZlozNode[],
  selected: ReadonlySet<string>,
  parent: ZlozNode | undefined,
  requestId: string,
  direction: typeof Direction.Type,
): Promise<ReadonlyMap<string, Point>> {
  // Give ELK each selected sibling's outer bounds. Shared group moves preserve
  // those bounds and translate the descendants together.
  const detached = createEditor(
    {
      nodes: roots.map(({ id, label, position, size, ports }) => ({
        id,
        label,
        position,
        size,
        ports,
      })),
      edges: graph.edges.filter(
        ({ source, target }) => selected.has(source.node) && selected.has(target.node),
      ),
    },
    { readOnly: true },
  );
  const request = layoutRequest(detached, requestId);
  const { createElkLayout } = await import('@opsydyn/foldkit-zloz-elk');
  const result = await createElkLayout({ direction, spacing: 64 })(request);
  const arranged = applyPreviewLayout(detached, request, result);
  if (arranged === detached)
    throw new SelectionLayoutError('The layout result is no longer current.');

  const original = bounds(roots);
  const next = bounds(arranged.graph.nodes);
  let x = original.left;
  let y = original.top;
  if (parent) {
    const spareWidth = parent.size.width - (next.right - next.left);
    const spareHeight = parent.size.height - (next.bottom - next.top);
    if (spareWidth < 0 || spareHeight < 0)
      throw new SelectionLayoutError('The arrangement needs more room in the containing group.');
    x = Math.max(parent.position.x, Math.min(x, parent.position.x + spareWidth));
    y = Math.max(parent.position.y, Math.min(y, parent.position.y + spareHeight));
  }
  return new Map(
    arranged.graph.nodes.map((node) => [
      node.id,
      { x: x + (node.position.x - next.left), y: y + (node.position.y - next.top) },
    ]),
  );
}

function distribute(roots: readonly ZlozNode[], axis: keyof Point): ReadonlyMap<string, Point> {
  const dimension = axis === 'x' ? 'width' : 'height';
  const ordered = [...roots].sort((a, b) => a.position[axis] - b.position[axis]);
  const first = ordered[0];
  const last = ordered.at(-1);
  if (!first || !last) throw new SelectionLayoutError('The selection is unavailable.');
  const start = first.position[axis];
  const end = last.position[axis] + last.size[dimension];
  const occupied = ordered.reduce((total, node) => total + node.size[dimension], 0);
  const gap = (end - start - occupied) / (ordered.length - 1);
  // Keep the outside nodes fixed, including when imported geometry overlaps.
  if (gap < 0 || ordered.some((node) => node.position[axis] + node.size[dimension] > end))
    throw new SelectionLayoutError('The selection needs more room to distribute without overlap.');

  let position = start;
  return new Map(
    ordered.map((node) => {
      const destination = node === last ? node.position : { ...node.position, [axis]: position };
      position += node.size[dimension] + gap;
      return [node.id, destination];
    }),
  );
}

function manualDestinations(roots: readonly ZlozNode[], method: Exclude<Method, 'elk'>) {
  const align = (axis: keyof Point) => {
    const edge = Math.min(...roots.map((node) => node.position[axis]));
    return new Map(roots.map((node) => [node.id, { ...node.position, [axis]: edge }]));
  };
  return Match.value(method).pipe(
    Match.when('align-left', () => align('x')),
    Match.when('align-top', () => align('y')),
    Match.when('distribute-horizontal', () => distribute(roots, 'x')),
    Match.when('distribute-vertical', () => distribute(roots, 'y')),
    Match.exhaustive,
  );
}

export async function prepare(
  document: ZlozOperationDocument,
  selection: readonly string[],
  requestId: string,
  direction: typeof Direction.Type,
  method: Method,
): Promise<Proposal> {
  const selected = new Set(selection);
  const graph = document.graph;
  const roots = graph.nodes.filter(({ id }) => selected.has(id));
  const parentId = roots[0]?.parentId;
  const { minimum } = methods[method];
  if (
    roots.length < minimum ||
    roots.length !== selected.size ||
    roots.some((node) => node.parentId !== parentId)
  )
    throw new SelectionLayoutError(
      `Select at least ${minimum === 3 ? 'three' : 'two'} sibling nodes or groups.`,
    );

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const clocks = new Map(document.nodes.map((node) => [node.id, node]));
  const geometry = (id: string) => {
    const clock = clocks.get(id);
    if (!clock?.present) throw new SelectionLayoutError('A selected node is unavailable.');
    return { id, expected: clock.geometry };
  };
  const parent = parentId === undefined ? undefined : byId.get(parentId);
  if (parentId !== undefined && !parent)
    throw new SelectionLayoutError('The containing group is unavailable.');

  const destinations =
    method === 'elk'
      ? await elkDestinations(graph, roots, selected, parent, requestId, direction)
      : manualDestinations(roots, method);

  // Keep every selected geometry clock, even for an anchor that stays in place.
  const deltas = new Map(
    roots.map((node) => {
      const destination = destinations.get(node.id);
      if (!destination) throw new SelectionLayoutError('The layout omitted a selected node.');
      if (
        method !== 'elk' &&
        parent &&
        node.extent === 'parent' &&
        (destination.x < parent.position.x ||
          destination.y < parent.position.y ||
          destination.x + node.size.width > parent.position.x + parent.size.width ||
          destination.y + node.size.height > parent.position.y + parent.size.height)
      )
        throw new SelectionLayoutError('This arrangement would exceed the containing group.');
      return [node.id, { x: destination.x - node.position.x, y: destination.y - node.position.y }];
    }),
  );
  if ([...deltas.values()].every((delta) => Math.abs(delta.x) < 1e-6 && Math.abs(delta.y) < 1e-6))
    throw new SelectionLayoutError('The selection is already arranged.');

  const moves = graph.nodes.flatMap((node) => {
    let ancestor: ZlozNode | undefined = node;
    while (ancestor && !selected.has(ancestor.id))
      ancestor = ancestor.parentId === undefined ? undefined : byId.get(ancestor.parentId);
    const delta = ancestor && deltas.get(ancestor.id);
    if (!delta) return [];
    return [
      {
        ...geometry(node.id),
        position: { x: node.position.x + delta.x, y: node.position.y + delta.y },
      },
    ];
  });
  return { selection, moves, parent: parentId === undefined ? null : geometry(parentId) };
}

export function staleReason(
  proposal: Proposal,
  document: ZlozOperationDocument | undefined,
  selection: readonly string[],
): string | null {
  if (
    selection.length !== proposal.selection.length ||
    proposal.selection.some((id) => !selection.includes(id))
  )
    return 'The selection changed. Start a new preview.';
  const clocks = new Map(document?.nodes.map((node) => [node.id, node]));
  const matches = ({ id, expected }: typeof Geometry.Type) => {
    const clock = clocks.get(id);
    return clock?.present && clock.geometry === expected;
  };
  return proposal.moves.every(matches) && (!proposal.parent || matches(proposal.parent))
    ? null
    : 'Selected geometry changed. Start a new preview.';
}
