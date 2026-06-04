import { hierarchy, pack, sort, sum } from '@opsydyn/foldkit-viz/hierarchy';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { svgRoot } from '../shared';

// MODEL

export type LeafDatum = Readonly<{ name: string; value: number }>;
export type GroupDatum = Readonly<{
  name: string;
  color: string;
  children: ReadonlyArray<LeafDatum>;
}>;
export type RootDatum = Readonly<{ name: string; children: ReadonlyArray<GroupDatum> }>;

export type InitConfig = Readonly<{ root: RootDatum }>;

// DIMENSIONS

const W = 480;
const H = 265;
const LEAF_LABEL_MIN_R = 8;
const GROUP_LABEL_MIN_R = 22;

type ComputedGroup = Readonly<{
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  r: number;
}>;

type ComputedLeaf = Readonly<{
  id: string;
  groupId: string;
  label: string;
  color: string;
  x: number;
  y: number;
  r: number;
  showLabel: boolean;
  value: number;
}>;

type Layout = Readonly<{
  groups: ReadonlyArray<ComputedGroup>;
  leaves: ReadonlyArray<ComputedLeaf>;
}>;

export type Model = Readonly<{
  layout: Layout;
  activeId: Option.Option<string>;
}>;

const r1 = (n: number) => Math.round(n * 10) / 10;

function tint(hex: string, t: number): string {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const rv = Number.parseInt(h.slice(0, 2), 16);
  const gv = Number.parseInt(h.slice(2, 4), 16);
  const bv = Number.parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(rv)},${mix(gv)},${mix(bv)})`;
}

function buildLayout(cfg: InitConfig): Layout {
  type RD = { name: string; children?: GroupDatum[] | LeafDatum[]; color?: string; value?: number };
  const rootNode = hierarchy<RD>(cfg.root as RD);
  sum(rootNode, (d) => ('value' in d && typeof d.value === 'number' ? d.value : 0));
  sort(rootNode, (a, b) => b.value - a.value);

  const packed = pack(rootNode, { width: W, height: H, padding: 3 });

  const groupColorMap = new Map<string, string>();
  for (const gd of cfg.root.children) groupColorMap.set(gd.name, gd.color);

  const groups: ComputedGroup[] = [];
  const leaves: ComputedLeaf[] = [];

  const walk = (node: typeof packed): void => {
    if (node.depth === 1) {
      const d = node.data as GroupDatum;
      groups.push({
        id: d.name,
        label: d.name,
        color: d.color,
        x: r1(node.x),
        y: r1(node.y),
        r: r1(node.r),
      });
    } else if (node.depth === 2) {
      const d = node.data as LeafDatum;
      const parentData = (node.parent?.data ?? {}) as GroupDatum;
      const groupColor = groupColorMap.get(parentData.name ?? '') ?? '#94a3b8';
      const groupId = parentData.name ?? '';
      leaves.push({
        id: `${groupId}:${d.name}`,
        groupId,
        label: d.name,
        color: tint(groupColor, 0.2),
        x: r1(node.x),
        y: r1(node.y),
        r: r1(node.r),
        showLabel: node.r >= LEAF_LABEL_MIN_R,
        value: d.value,
      });
    }
    if (node.children) {
      for (const child of node.children) walk(child);
    }
  };

  walk(packed);

  return { groups, leaves };
}

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [{ layout: buildLayout(cfg), activeId: Option.none() }, []];
}

// MESSAGE

export const HoveredCircle = m('HoveredCircle', { id: Schema.String });
export const BlurredCircle = m('BlurredCircle', {});

export const Message = Schema.Union([HoveredCircle, BlurredCircle]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCircle: ({ id }) => [{ ...model, activeId: Option.some(id) }, []],
      BlurredCircle: () => [{ ...model, activeId: Option.none() }, []],
    }),
  );

// VIEW

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Packed circles chart' } = config;
  const { layout, activeId } = model;
  const { groups, leaves } = layout;

  const isAnyActive = Option.isSome(activeId);
  const activeIdVal = isAnyActive ? activeId.value : null;

  // Resolve the active group: if hovered a leaf, the group is the leaf's groupId
  const activeGroupId = isAnyActive
    ? (leaves.find((l) => l.id === activeIdVal)?.groupId ?? activeIdVal)
    : null;

  const groupOpacity = (g: ComputedGroup) => {
    if (!isAnyActive) return '1';
    return g.id === activeGroupId ? '1' : '0.2';
  };

  const leafOpacity = (l: ComputedLeaf) => {
    if (!isAnyActive) return '1';
    return l.groupId === activeGroupId ? '1' : '0.15';
  };

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
      // Group circles (drawn first — behind leaves)
      ...groups.map((g) =>
        h.g(
          [
            h.OnMouseEnter(toParentMessage(HoveredCircle({ id: g.id }))),
            h.OnMouseLeave(toParentMessage(BlurredCircle({}))),
            h.Style({ cursor: 'pointer' }),
          ],
          [
            h.circle(
              [
                h.Attribute('cx', String(g.x)),
                h.Attribute('cy', String(g.y)),
                h.Attribute('r', String(g.r)),
                h.Fill(tint(g.color, 0.85)),
                h.Stroke(tint(g.color, 0.5)),
                h.Attribute('stroke-width', '1'),
                h.Style({ opacity: groupOpacity(g), transition: 'opacity 150ms' }),
              ],
              [],
            ),
            ...(g.r >= GROUP_LABEL_MIN_R
              ? [
                  h.text(
                    [
                      h.X(String(g.x)),
                      h.Y(String(r1(g.y - g.r + 9))),
                      h.Style({
                        'text-anchor': 'middle',
                        'dominant-baseline': 'middle',
                        'font-size': '0.55rem',
                        'font-weight': '600',
                        fill: g.color,
                        opacity: groupOpacity(g),
                        transition: 'opacity 150ms',
                        'pointer-events': 'none',
                        'user-select': 'none',
                      }),
                    ],
                    [g.label],
                  ),
                ]
              : []),
          ],
        ),
      ),

      // Leaf circles (drawn on top)
      ...leaves.map((leaf) => {
        const isActive = leaf.id === activeIdVal;
        return h.g(
          [
            h.OnMouseEnter(toParentMessage(HoveredCircle({ id: leaf.id }))),
            h.OnMouseLeave(toParentMessage(BlurredCircle({}))),
            h.Style({ cursor: 'pointer' }),
            h.AriaLabel(`${leaf.label}: ${leaf.value}`),
          ],
          [
            h.circle(
              [
                h.Attribute('cx', String(leaf.x)),
                h.Attribute('cy', String(leaf.y)),
                h.Attribute('r', String(leaf.r)),
                h.Fill(leaf.color),
                h.Stroke(isActive ? '#fff' : 'none'),
                h.Attribute('stroke-width', isActive ? '1.5' : '0'),
                h.Style({
                  opacity: leafOpacity(leaf),
                  transition: 'opacity 150ms',
                }),
              ],
              [],
            ),
            ...(leaf.showLabel
              ? [
                  h.text(
                    [
                      h.X(String(leaf.x)),
                      h.Y(String(leaf.y)),
                      h.Style({
                        'text-anchor': 'middle',
                        'dominant-baseline': 'middle',
                        'font-size': '0.45rem',
                        'font-weight': isActive ? '700' : '500',
                        fill: '#fff',
                        opacity: leafOpacity(leaf),
                        transition: 'opacity 150ms, font-weight 0ms',
                        'pointer-events': 'none',
                        'user-select': 'none',
                      }),
                    ],
                    [leaf.label],
                  ),
                ]
              : []),
          ],
        );
      }),
    ],
  );
};
