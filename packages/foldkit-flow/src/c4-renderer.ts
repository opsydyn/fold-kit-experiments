import type { Html, HtmlBuilder } from 'foldkit/html';

import { architectureNodePresets, type C4NodeArchitecture } from './architecture';
import {
  flowNodeFrame,
  flowGroupFrame,
  flowDragHandle,
  type FlowNodeRenderContext,
} from './composition';
import type { FlowNodeBodyCache } from './node-body-cache';
// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts, not structural placeholders.
import { nodeShapeGeometry } from './node-shape';
import { portRenderViews } from './port-render';
import type { FlowNode } from './types';

/** Static artwork context. Live controls and policy state are deliberately separate. */
export type FlowC4ContentContext = Readonly<{
  node: FlowNode;
  architecture: C4NodeArchitecture;
  selected: boolean;
  selectionPreview: boolean;
}>;
/** Inert content inside the native drag button. Null omits a part; undefined keeps its default. */
export type FlowC4ContentRenderer<M> = (
  context: FlowC4ContentContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;
export type FlowC4NodeOptions<M> = Readonly<{
  attributes?: Parameters<HtmlBuilder<M>['div']>[0];
  /** Create once per canvas; keep this options object stable for artwork reuse. */
  bodyCache?: FlowNodeBodyCache;
  renderIcon?: FlowC4ContentRenderer<M>;
  renderType?: FlowC4ContentRenderer<M>;
  renderName?: FlowC4ContentRenderer<M>;
  renderTechnology?: FlowC4ContentRenderer<M>;
  renderDescription?: FlowC4ContentRenderer<M>;
  /** Replaces content within the core outline, retaining its canonical geometry. */
  renderBody?: FlowC4ContentRenderer<M>;
  /** Interactive content belongs here, outside the drag button and artwork cache. [] omits native chrome. */
  renderControls?: (
    context: FlowNodeRenderContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[] | undefined;
}>;
const defaults = Object.freeze({});

function part<M>(
  renderer: FlowC4ContentRenderer<M> | undefined,
  context: FlowC4ContentContext,
  h: HtmlBuilder<M>,
  fallback: () => Html | null,
): readonly Html[] {
  const custom = renderer?.(context, h);
  const content = custom === undefined ? fallback() : custom;
  return content === null ? [] : [content];
}
function roleName(architecture: C4NodeArchitecture): string {
  return (
    architectureNodePresets.find(
      (preset) =>
        preset.architecture.family === 'c4' && preset.architecture.role === architecture.role,
    )?.label ?? architecture.role
  );
}
function personIcon<M>(h: HtmlBuilder<M>): Html {
  return h.svg(
    [
      h.DataAttribute('flow-c4-person', ''),
      h.AriaHidden(true),
      h.ViewBox('0 0 32 32'),
      h.Width('28'),
      h.Height('28'),
      h.Style({ display: 'block', margin: '0 auto', 'flex-shrink': '0' }),
    ],
    [
      h.circle(
        [
          h.Cx('16'),
          h.Cy('9'),
          h.R('5'),
          h.Fill('none'),
          h.Stroke('currentColor'),
          h.StrokeWidth('2'),
        ],
        [],
      ),
      h.path(
        [
          h.D('M6,29 V25 A10,10 0 0 1 26,25 V29 Z'),
          h.Fill('none'),
          h.Stroke('currentColor'),
          h.StrokeWidth('2'),
        ],
        [],
      ),
    ],
  );
}

function artwork<M>(
  h: HtmlBuilder<M>,
  node: FlowNode,
  selected: boolean,
  preview: boolean,
  options: FlowC4NodeOptions<M>,
): Html {
  const architecture = node.architecture;
  if (architecture?.family !== 'c4') return h.span([], []);
  const context: FlowC4ContentContext = { node, architecture, selected, selectionPreview: preview };
  const label = roleName(architecture);
  const content = options.renderBody?.(context, h);
  const technology = 'technology' in architecture ? architecture.technology : undefined;
  const children =
    content === undefined
      ? [
          ...part(options.renderIcon, context, h, () =>
            architecture.role === 'person' && node.kind !== 'group' ? personIcon(h) : null,
          ),
          ...part(options.renderType, context, h, () =>
            h.span(
              [
                h.Class('flow-c4-type'),
                h.Style({
                  'font-size': '10px',
                  'letter-spacing': '0.04em',
                  'line-height': '1.3',
                  'font-weight': '600',
                }),
              ],
              [`${label}${architecture.scope === 'external' ? ' · external' : ''}`],
            ),
          ),
          ...part(options.renderName, context, h, () =>
            h.strong(
              [h.Class('flow-c4-name'), h.Style({ 'font-size': '16px', 'line-height': '1.25' })],
              [node.label],
            ),
          ),
          ...part(options.renderTechnology, context, h, () =>
            technology
              ? h.span(
                  [
                    h.Class('flow-c4-technology'),
                    h.Style({ 'font-size': '11px', 'line-height': '1.3' }),
                  ],
                  [technology],
                )
              : null,
          ),
          ...part(options.renderDescription, context, h, () =>
            architecture.description
              ? h.span(
                  [
                    h.Class('flow-c4-description'),
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
        h.DataAttribute('flow-c4-body', node.id),
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
    [h.DataAttribute('flow-c4-body', node.id), h.Style({ display: 'contents' })],
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
              h.DataAttribute('flow-c4-outline', ''),
              h.D(geometry.outlinePath),
              h.Fill('var(--flow-node-background, #fff)'),
              h.Stroke(stroke),
              h.StrokeWidth(selected || preview ? '3' : '1.5'),
              h.StrokeDasharray(preview || architecture.scope === 'external' ? '6 4' : 'none'),
              h.Style({ 'vector-effect': 'non-scaling-stroke' }),
            ],
            [],
          ),
          ...geometry.decorationPaths.map((path) =>
            h.path(
              [
                h.DataAttribute('flow-c4-cap', ''),
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
  context: FlowNodeRenderContext,
  options: FlowC4NodeOptions<M>,
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
  context: FlowNodeRenderContext,
  h: HtmlBuilder<M>,
  options: FlowC4NodeOptions<M>,
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
                h.DataAttribute('flow-c4-boundary-controls', ''),
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

/** C4 node preset using authored core geometry and native interaction primitives. Other families fall back. */
export function flowC4Node<M>(
  context: FlowNodeRenderContext,
  h: HtmlBuilder<M>,
  options: FlowC4NodeOptions<M> = defaults,
): Html | undefined {
  const { node, state } = context;
  if (node.kind === 'group' || node.architecture?.family !== 'c4') return undefined;
  const target = state.gesture.type === 'connection-drag' ? state.gesture.target : null;
  return flowNodeFrame(
    h,
    context,
    [
      h.DataAttribute('flow-c4-node', node.architecture.role),
      h.Style({ color: 'var(--flow-node-color, #172033)' }),
      ...(options.attributes ?? []),
      h.Style({ height: `${node.size.height}px` }),
    ],
    [
      flowDragHandle(
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

/** C4 system/container boundary. Bounds and portless grouping remain Model-owned. */
export function flowC4Group<M>(
  context: FlowNodeRenderContext,
  h: HtmlBuilder<M>,
  options: FlowC4NodeOptions<M> = defaults,
): Html | undefined {
  const { node } = context;
  if (node.kind !== 'group' || node.architecture?.family !== 'c4') return undefined;
  const selected = context.state.selectedNodes.includes(node.id) || context.selectionPreview;
  const border = context.dropTarget
    ? 'var(--flow-valid-target, #0f766e)'
    : selected
      ? 'var(--flow-selection, #2563eb)'
      : 'var(--flow-node-border, #64748b)';
  return flowGroupFrame(
    h,
    context,
    [
      h.DataAttribute('flow-c4-group', node.architecture.role),
      h.Style({
        background: 'var(--flow-group-background, rgb(100 116 139 / 0.08))',
        border: `2px ${context.dropTarget ? 'solid' : 'dashed'} ${border}`,
        color: 'var(--flow-node-color, #172033)',
      }),
      ...(options.attributes ?? []),
    ],
    [
      flowDragHandle(
        h,
        context,
        [
          h.Style({
            position: 'absolute',
            top: '8px',
            left: '16px',
            width: 'calc(100% - 144px)',
            height: '36px',
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
