/**
 * How the rings moved into an edition: every entry's ring in the edition before and in
 * this one, as a sankey's flows. Entries that joined come from "New", entries that went
 * come to "Left the radar". Pure; the page draws the SVG with no script.
 *
 * @module
 */
import { sankey } from '@opsydyn/foldkit-viz/shape/sankey';
import { Option } from 'effect';

import { ringAt } from './pages';
import { type RadarDataset, type Ring, ringIds, ringLabels } from './three/data';

/** Where an entry stood on one side of the move: a ring, or off the radar. */
type Side = Ring | 'off';

const sides: ReadonlyArray<Side> = [...ringIds, 'off'];

/** How a flow moved: in towards Adopt, out towards Caution, or stayed, joined or left. */
export type FlowKind = 'stayed' | 'in' | 'out' | 'joined' | 'left';

export type Flow = Readonly<{
  from: Side;
  to: Side;
  kind: FlowKind;
  names: ReadonlyArray<string>;
}>;

export const flowSize = { width: 640, height: 280 } as const;
/** Room either side of the bars for their labels: the chart sits this far in. */
export const flowGutter = 104;

const sideOf = (ring: Option.Option<Ring>): Side => Option.getOrElse(ring, (): Side => 'off');

const kindOf = (from: Side, to: Side): FlowKind => {
  if (from === 'off') return 'joined';
  if (to === 'off') return 'left';
  if (from === to) return 'stayed';
  return ringIds.indexOf(to) < ringIds.indexOf(from) ? 'in' : 'out';
};

/** Every flow into the edition `index` from the one before, in ring order; none for the first. */
export const flowsInto = (dataset: RadarDataset, index: number): ReadonlyArray<Flow> => {
  if (index < 1) return [];
  const moves = dataset.entries.flatMap((entry) => {
    const from = sideOf(ringAt(dataset, entry, index - 1));
    const to = sideOf(ringAt(dataset, entry, index));
    return from === 'off' && to === 'off' ? [] : [{ from, to, name: entry.name }];
  });
  return sides.flatMap((from) =>
    sides.flatMap((to) => {
      const names = moves.filter((move) => move.from === from && move.to === to);
      return names.length === 0
        ? []
        : [{ from, to, kind: kindOf(from, to), names: names.map(({ name }) => name) }];
    }),
  );
};

export const sideLabel = (side: Side, column: 'before' | 'after'): string =>
  side === 'off' ? (column === 'before' ? 'New' : 'Left the radar') : ringLabels[side];

export type FlowChart = Readonly<{
  bars: ReadonlyArray<
    Readonly<{
      x: number;
      y: number;
      width: number;
      height: number;
      label: string;
      count: number;
      labelX: number;
      anchor: 'start' | 'end';
    }>
  >;
  ribbons: ReadonlyArray<Readonly<{ path: string; flow: Flow }>>;
}>;

/**
 * The flows laid out by foldkit-viz's sankey, both columns in ring order (Adopt at the
 * top), labelled outside the bars. Drawn `flowGutter` in from the left.
 */
export const flowChart = (flows: ReadonlyArray<Flow>): FlowChart => {
  const id = (column: 'before' | 'after', side: Side) => `${column}:${side}`;
  const used = (column: 'before' | 'after') =>
    sides.filter((side) =>
      flows.some((flow) => (column === 'before' ? flow.from : flow.to) === side),
    );
  const placed = [
    ...used('before').map((side) => ({ column: 'before' as const, side })),
    ...used('after').map((side) => ({ column: 'after' as const, side })),
  ];
  const sideById = new Map(placed.map((node) => [id(node.column, node.side), node]));
  const nodes = placed.map(({ column, side }) => ({ id: id(column, side) }));
  const links = flows.map((flow) => ({
    source: id('before', flow.from),
    target: id('after', flow.to),
    value: flow.names.length,
  }));
  const layout = sankey(nodes, links, {
    width: flowSize.width - 2 * flowGutter,
    height: flowSize.height,
    nodeWidth: 12,
    nodePadding: 14,
    nodeSort: null,
  });
  const bars = layout.nodes.flatMap((node) => {
    const where = sideById.get(node.id);
    if (where === undefined) return [];
    const { column, side } = where;
    const before = column === 'before';
    const labelX = before ? node.x0 - 8 : node.x1 + 8;
    const anchor: 'start' | 'end' = before ? 'end' : 'start';
    return [
      {
        x: node.x0,
        y: node.y0,
        width: node.x1 - node.x0,
        height: node.y1 - node.y0,
        label: sideLabel(side, column),
        count: node.value,
        labelX,
        anchor,
      },
    ];
  });
  const ribbons = layout.links.flatMap((link, at) => {
    const flow = flows[at];
    return flow === undefined ? [] : [{ path: link.pathD, flow }];
  });
  return { bars, ribbons };
};
