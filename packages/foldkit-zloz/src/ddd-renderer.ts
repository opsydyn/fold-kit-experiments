import type { Html, HtmlBuilder } from 'foldkit/html';

import { architectureNodePresets, type DddNodeArchitecture } from './architecture';
import {
  zlozNodeFrame,
  zlozGroupFrame,
  zlozDragHandle,
  type ZlozNodeRenderContext,
} from './composition';
import type { ZlozNodeBodyCache } from './node-body-cache';
// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts, not structural placeholders.
import { nodeShapeGeometry } from './node-shape';
import { portRenderViews } from './port-render';
import type { ZlozNode } from './types';

/** Static artwork context. Live controls and policy state are deliberately separate. */
export type ZlozDddContentContext = Readonly<{
  node: ZlozNode;
  architecture: DddNodeArchitecture;
  selected: boolean;
  selectionPreview: boolean;
}>;
/** Inert content inside the native drag button. Null omits a part; undefined keeps its default. */
export type ZlozDddContentRenderer<M> = (
  context: ZlozDddContentContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;
export type ZlozDddNodeOptions<M> = Readonly<{
  attributes?: Parameters<HtmlBuilder<M>['div']>[0];
  /** Create once per canvas; keep this options object stable for artwork reuse. */
  bodyCache?: ZlozNodeBodyCache;
  /** Optional inert badge; no prescribed DDD icon or color notation. */
  renderBadge?: ZlozDddContentRenderer<M>;
  renderType?: ZlozDddContentRenderer<M>;
  renderName?: ZlozDddContentRenderer<M>;
  renderSubdomain?: ZlozDddContentRenderer<M>;
  renderDescription?: ZlozDddContentRenderer<M>;
  /** Replaces content within the core outline, retaining its canonical geometry. */
  renderBody?: ZlozDddContentRenderer<M>;
  /** Interactive content belongs here, outside the drag button and artwork cache. [] omits native chrome. */
  renderControls?: (
    context: ZlozNodeRenderContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[] | undefined;
}>;
const defaults = Object.freeze({});

function part<M>(
  renderer: ZlozDddContentRenderer<M> | undefined,
  context: ZlozDddContentContext,
  h: HtmlBuilder<M>,
  fallback: () => Html | null,
): readonly Html[] {
  const custom = renderer?.(context, h);
  const content = custom === undefined ? fallback() : custom;
  return content === null ? [] : [content];
}
function roleName(architecture: DddNodeArchitecture): string {
  return (
    architectureNodePresets.find(
      (preset) =>
        preset.architecture.family === 'ddd' && preset.architecture.role === architecture.role,
    )?.label ?? architecture.role
  );
}

function artwork<M>(
  h: HtmlBuilder<M>,
  node: ZlozNode,
  selected: boolean,
  preview: boolean,
  options: ZlozDddNodeOptions<M>,
): Html {
  const architecture = node.architecture;
  if (architecture?.family !== 'ddd') return h.span([], []);
  const context: ZlozDddContentContext = {
    node,
    architecture,
    selected,
    selectionPreview: preview,
  };
  const label = roleName(architecture);
  const content = options.renderBody?.(context, h);
  const subdomain = 'subdomain' in architecture ? architecture.subdomain : undefined;
  const children =
    content === undefined
      ? [
          ...part(options.renderBadge, context, h, () => null),
          ...part(options.renderType, context, h, () =>
            h.span(
              [
                h.Class('flow-ddd-type'),
                h.DataAttribute('flow-ddd-type', architecture.role),
                h.Style({
                  'font-size': '10px',
                  'letter-spacing': '0.04em',
                  'line-height': '1.3',
                  'font-weight': '600',
                }),
              ],
              [label],
            ),
          ),
          ...part(options.renderName, context, h, () =>
            h.strong(
              [
                h.Class('flow-ddd-name'),
                h.Style({
                  'font-size': '16px',
                  'line-height': '1.25',
                  'max-width': '100%',
                  overflow: node.kind === 'group' ? 'hidden' : 'visible',
                  'text-overflow': 'ellipsis',
                  'white-space': node.kind === 'group' ? 'nowrap' : 'normal',
                }),
              ],
              [node.label],
            ),
          ),
          ...part(options.renderSubdomain, context, h, () =>
            subdomain
              ? h.span(
                  [
                    h.Class('flow-ddd-subdomain'),
                    h.Style({ 'font-size': '11px', 'line-height': '1.3' }),
                  ],
                  [`${subdomain[0]!.toUpperCase()}${subdomain.slice(1)} subdomain`],
                )
              : null,
          ),
          ...part(options.renderDescription, context, h, () =>
            architecture.description && node.kind !== 'group'
              ? h.span(
                  [
                    h.Class('flow-ddd-description'),
                    h.Style({ 'font-size': '12px', 'line-height': '1.35' }),
                  ],
                  [architecture.description],
                )
              : null,
          ),
        ]
      : content === null
        ? []
        : [content];
  if (node.kind === 'group')
    return h.span(
      [
        h.DataAttribute('flow-ddd-body', node.id),
        h.Style({
          display: 'flex',
          gap: '1px',
          'flex-direction': 'column',
          'align-items': 'flex-start',
          overflow: 'hidden',
        }),
      ],
      children,
    );
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- The core owns geometric node outlines.
  const geometry = nodeShapeGeometry(node);
  const bounds = geometry.contentBounds;
  const stroke =
    preview || selected ? 'var(--flow-selection, #2563eb)' : 'var(--flow-node-border, #64748b)';
  return h.span(
    [h.DataAttribute('flow-ddd-body', node.id), h.Style({ display: 'contents' })],
    [
      h.svg(
        [
          h.ViewBox(`0 0 ${node.size.width} ${node.size.height}`),
          h.Width('100%'),
          h.Height('100%'),
          h.AriaHidden(true),
          h.Style({
            position: 'absolute',
            inset: '0',
            overflow: 'visible',
            'pointer-events': 'none',
          }),
        ],
        [
          h.path(
            [
              h.DataAttribute('flow-ddd-outline', ''),
              h.D(geometry.outlinePath),
              h.Fill('var(--flow-node-background, #fff)'),
              h.Stroke(stroke),
              h.StrokeWidth(selected || preview ? '3' : '1.5'),
              h.StrokeDasharray(preview ? '6 4' : 'none'),
              h.Style({ 'vector-effect': 'non-scaling-stroke' }),
            ],
            [],
          ),
          ...geometry.decorationPaths.map((path) =>
            h.path(
              [
                h.DataAttribute('flow-ddd-cap', ''),
                h.D(path),
                h.Fill('none'),
                h.Stroke(stroke),
                h.StrokeWidth('1.5'),
                h.Style({ 'vector-effect': 'non-scaling-stroke' }),
              ],
              [],
            ),
          ),
        ],
      ),
      h.span(
        [
          h.Style({
            position: 'absolute',
            left: `${bounds.x}px`,
            top: `${bounds.y}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
            'box-sizing': 'border-box',
            padding: '12px 18px',
            display: 'flex',
            'flex-direction': 'column',
            'align-items': 'center',
            'justify-content': 'center',
            gap: '5px',
            overflow: 'hidden',
            'overflow-wrap': 'anywhere',
            'pointer-events': 'none',
          }),
        ],
        children,
      ),
    ],
  );
}

function retainedArtwork<M>(
  h: HtmlBuilder<M>,
  context: ZlozNodeRenderContext,
  options: ZlozDddNodeOptions<M>,
): Html {
  const selected = context.state.selectedNodes.includes(context.node.id);
  return options.bodyCache
    ? options.bodyCache(context.node, artwork<M>, [
        h,
        context.node,
        selected,
        context.selectionPreview,
        options,
      ])
    : artwork(h, context.node, selected, context.selectionPreview, options);
}
function controls<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  options: ZlozDddNodeOptions<M>,
): readonly Html[] {
  const chrome = [
    ...(context.contextAction ? [context.contextAction] : []),
    ...(context.collapseToggle ? [context.collapseToggle] : []),
  ];
  return (
    options.renderControls?.(context, h) ?? [
      ...(context.node.kind === 'group'
        ? [
            h.div(
              [
                h.DataAttribute('flow-ddd-boundary-controls', ''),
                h.Style({
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  display: 'flex',
                  gap: '6px',
                  'align-items': 'center',
                  'pointer-events': 'auto',
                  'z-index': '2',
                }),
              ],
              chrome,
            ),
          ]
        : chrome),
      ...context.resizeHandles,
    ]
  );
}

/** DDD node preset using authored core geometry and native interaction primitives. Other families fall back. */
export function zlozDddNode<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  options: ZlozDddNodeOptions<M> = defaults,
): Html | undefined {
  const { node, state } = context;
  if (node.kind === 'group' || node.architecture?.family !== 'ddd') return undefined;
  const target = state.gesture.type === 'connection-drag' ? state.gesture.target : null;
  return zlozNodeFrame(
    h,
    context,
    [
      h.DataAttribute('flow-ddd-node', node.architecture.role),
      h.Style({ color: 'var(--flow-node-color, #172033)' }),
      ...(options.attributes ?? []),
      h.Style({ height: `${node.size.height}px` }),
    ],
    [
      zlozDragHandle(
        h,
        context,
        [
          h.Style({
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            padding: '0',
            border: '0',
            background: 'transparent',
            color: 'inherit',
            'font-family': 'inherit',
            cursor: state.readOnly ? 'pointer' : 'grab',
          }),
        ],
        [retainedArtwork(h, context, options)],
      ),
      ...(context.ports ?? portRenderViews(h, context, target, undefined)),
      ...controls(context, h, options),
    ],
  );
}

/** DDD aggregate/context boundary. Bounds and portless grouping remain Model-owned. */
export function zlozDddGroup<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  options: ZlozDddNodeOptions<M> = defaults,
): Html | undefined {
  const { node } = context;
  if (node.kind !== 'group' || node.architecture?.family !== 'ddd') return undefined;
  const selected = context.state.selectedNodes.includes(node.id) || context.selectionPreview;
  const border = context.dropTarget
    ? 'var(--flow-valid-target, #0f766e)'
    : selected
      ? 'var(--flow-selection, #2563eb)'
      : 'var(--flow-node-border, #64748b)';
  return zlozGroupFrame(
    h,
    context,
    [
      h.DataAttribute('flow-ddd-group', node.architecture.role),
      h.Style({
        background: 'var(--flow-group-background, rgb(100 116 139 / 0.08))',
        border: `2px ${context.dropTarget ? 'solid' : 'dashed'} ${border}`,
        color: 'var(--flow-node-color, #172033)',
      }),
      ...(options.attributes ?? []),
    ],
    [
      zlozDragHandle(
        h,
        context,
        [
          h.Style({
            position: 'absolute',
            top: '8px',
            left: '16px',
            width: 'calc(100% - 144px)',
            height: `${Math.max(0, Math.min(56, node.size.height - 16))}px`,
            overflow: 'hidden',
            padding: '0',
            border: '0',
            background: 'transparent',
            color: 'inherit',
            'font-family': 'inherit',
            'text-align': 'left',
            cursor: context.state.readOnly ? 'pointer' : 'grab',
          }),
        ],
        [retainedArtwork(h, context, options)],
      ),
      ...controls(context, h, options),
    ],
  );
}
