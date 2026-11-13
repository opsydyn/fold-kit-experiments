/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Authored node shape geometry is a core domain contract. */
import type { Html, HtmlBuilder } from 'foldkit/html';

import { architectureNodePresets, type EventStormingNodeArchitecture } from './architecture';
import {
  zlozDragHandle,
  zlozNodeFrame,
  zlozGroupFrame,
  type ZlozGroupHeaderOptions,
  type ZlozNodeRenderContext,
} from './composition';
import { resolveLayoutGroupHeader, groupHeaderPosition } from './group-header';
import type { ZlozNodeBodyCache } from './node-body-cache';
import { nodeShapeGeometry } from './node-shape';
import { portRenderViews } from './port-render';
import type { ZlozNode } from './types';

export type ZlozEventStormingContentContext = Readonly<{
  node: ZlozNode;
  architecture: EventStormingNodeArchitecture;
  selected: boolean;
  selectionPreview: boolean;
}>;
/** Undefined retains the default; null omits a part. Content must remain inert inside the drag handle. */
export type ZlozEventStormingContentRenderer<M> = (
  context: ZlozEventStormingContentContext,
  h: HtmlBuilder<M>,
) => Html | null | undefined;
export type ZlozEventStormingNodeOptions<M> = Readonly<{
  attributes?: Parameters<HtmlBuilder<M>['div']>[0];
  bodyCache?: ZlozNodeBodyCache;
  groupHeader?: ZlozGroupHeaderOptions;
  renderStatus?: ZlozEventStormingContentRenderer<M>;
  /** Accessible semantic description; null omits it, undefined keeps the canonical meaning. */
  describeMeaning?: (context: ZlozEventStormingContentContext) => string | null | undefined;
  renderType?: ZlozEventStormingContentRenderer<M>;
  renderName?: ZlozEventStormingContentRenderer<M>;
  renderDescription?: ZlozEventStormingContentRenderer<M>;
  renderBody?: ZlozEventStormingContentRenderer<M>;
  /** Interactive content stays outside the artwork cache and drag button. [] hides native chrome. */
  renderControls?: (
    context: ZlozNodeRenderContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[] | undefined;
}>;
const defaults = Object.freeze({});
const accents = {
  command: 'var(--flow-event-storming-command, #2563eb)',
  'domain-event': 'var(--flow-event-storming-event, #c2410c)',
  policy: 'var(--flow-event-storming-policy, #7e22ce)',
  actor: 'var(--flow-event-storming-actor, #a16207)',
  'external-system': 'var(--zloz-event-storming-external-system, #0e7490)',
  hotspot: 'var(--zloz-event-storming-hotspot-open, #be123c)',
  lane: 'var(--zloz-event-storming-lane, #64748b)',
};
// ADR 0082: native accents are scoped tokens; semantic hotspot status is separately visible.
const roleAccent = (role: EventStormingNodeArchitecture['role']) =>
  Object.entries(accents).find(([key]) => key === role)?.[1];
function part<M>(
  renderer: ZlozEventStormingContentRenderer<M> | undefined,
  context: ZlozEventStormingContentContext,
  h: HtmlBuilder<M>,
  fallback: () => Html | null,
): readonly Html[] {
  const custom = renderer?.(context, h);
  const content = custom === undefined ? fallback() : custom;
  return content === null ? [] : [content];
}
function artwork<M>(
  h: HtmlBuilder<M>,
  node: ZlozNode,
  selected: boolean,
  selectionPreview: boolean,
  options: ZlozEventStormingNodeOptions<M>,
): Html {
  const architecture = node.architecture;
  if (architecture?.family !== 'event-storming') return h.span([], []);
  const context = { node, architecture, selected, selectionPreview };
  const role =
    architectureNodePresets.find(
      (preset) =>
        preset.architecture.family === 'event-storming' &&
        preset.architecture.role === architecture.role,
    )?.label ?? architecture.role;
  const custom = options.renderBody?.(context, h);
  const content =
    custom === undefined
      ? [
          ...part(options.renderType, context, h, () =>
            h.span(
              [
                h.DataAttribute('zloz-event-storming-type', architecture.role),
                h.Style({ 'font-size': '11px', 'font-weight': '600' }),
              ],
              [role],
            ),
          ),
          ...part(options.renderName, context, h, () =>
            h.strong([h.Style({ 'font-size': '16px', 'line-height': '1.25' })], [node.label]),
          ),
          ...part(options.renderStatus, context, h, () =>
            architecture.role === 'hotspot'
              ? h.span(
                  [
                    h.DataAttribute('zloz-hotspot-status', architecture.status),
                    h.Style({
                      fontSize: '12px',
                      fontWeight: '600',
                      border: '1px solid currentColor',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      color:
                        architecture.status === 'resolved'
                          ? 'var(--zloz-event-storming-hotspot-resolved, #047857)'
                          : 'var(--zloz-event-storming-hotspot-open, #be123c)',
                    }),
                  ],
                  [architecture.status === 'open' ? 'Open question' : 'Resolved'],
                )
              : null,
          ),
          ...part(options.renderDescription, context, h, () =>
            architecture.description && node.kind !== 'group'
              ? h.span(
                  [h.Style({ 'font-size': '12px', 'line-height': '1.35' })],
                  [architecture.description],
                )
              : null,
          ),
        ]
      : custom === null
        ? []
        : [custom];
  if (node.kind === 'group')
    return h.span(
      [
        h.DataAttribute('zloz-event-storming-body', node.id),
        h.Style({
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          alignItems: 'flex-start',
          overflow: 'hidden',
        }),
      ],
      content,
    );
  const geometry = nodeShapeGeometry(node);
  const bounds = geometry.contentBounds;
  const stroke =
    selected || selectionPreview
      ? 'var(--flow-selection, #2563eb)'
      : architecture.role === 'hotspot' && architecture.status === 'resolved'
        ? 'var(--zloz-event-storming-hotspot-resolved, #047857)'
        : (roleAccent(architecture.role) ?? 'var(--flow-node-border, #64748b)');
  return h.span(
    [h.DataAttribute('zloz-event-storming-body', node.id), h.Style({ display: 'contents' })],
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
              h.D(geometry.outlinePath),
              h.Fill('var(--flow-node-background, #fff)'),
              h.Stroke(stroke),
              h.StrokeWidth(selected || selectionPreview ? '3' : '2'),
              h.StrokeDasharray(
                selectionPreview ? '6 4' : architecture.role === 'external-system' ? '8 4' : 'none',
              ),
              h.Style({ 'vector-effect': 'non-scaling-stroke' }),
            ],
            [],
          ),
          ...geometry.decorationPaths.map((path) =>
            h.path(
              [
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
            padding: '22px 18px',
            display: 'flex',
            'flex-direction': 'column',
            'align-items': 'center',
            'justify-content': 'center',
            gap: '8px',
            overflow: 'hidden',
            'overflow-wrap': 'anywhere',
            'pointer-events': 'none',
          }),
        ],
        content,
      ),
    ],
  );
}
function described<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  options: ZlozEventStormingNodeOptions<M>,
) {
  const architecture = context.node.architecture;
  if (architecture?.family !== 'event-storming') return { context, description: null };
  const custom = options.describeMeaning?.({
    node: context.node,
    architecture,
    selected: context.state.selectedNodes.includes(context.node.id),
    selectionPreview: context.selectionPreview,
  });
  const text =
    custom === undefined
      ? architecture.role === 'hotspot'
        ? `Hotspot. ${architecture.status === 'open' ? 'Open question' : 'Resolved annotation'}.`
        : architecture.role === 'lane'
          ? 'Organizational workshop lane.'
          : architecture.role === 'external-system'
            ? 'External system participant.'
            : null
      : custom;
  if (text === null) return { context, description: null };
  const id = `${context.descriptionId}-workshop-${encodeURIComponent(context.node.id)}`;
  return {
    context: { ...context, descriptionId: `${context.descriptionId} ${id}` },
    description: h.span(
      [
        h.Id(id),
        h.Style({
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
          border: '0',
        }),
      ],
      [text],
    ),
  };
}
/** Optional note renderer. Native geometry, sockets, selection, policies and controls remain live. */
export function zlozEventStormingNode<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  options: ZlozEventStormingNodeOptions<M> = defaults,
): Html | undefined {
  const { node, state } = context;
  if (node.kind === 'group' || node.architecture?.family !== 'event-storming') return undefined;
  const semantic = described(context, h, options);
  const selected = state.selectedNodes.includes(node.id);
  const body = options.bodyCache
    ? options.bodyCache(node, artwork<M>, [h, node, selected, context.selectionPreview, options])
    : artwork(h, node, selected, context.selectionPreview, options);
  const target = state.gesture.type === 'connection-drag' ? state.gesture.target : null;
  const controls = options.renderControls?.(context, h) ?? [
    ...(context.contextAction ? [context.contextAction] : []),
    ...context.resizeHandles,
  ];
  return zlozNodeFrame(
    h,
    context,
    [
      h.DataAttribute('zloz-event-storming-node', node.architecture.role),
      h.Style({ color: 'var(--flow-node-color, #172033)' }),
      ...(options.attributes ?? []),
      h.Style({ height: `${node.size.height}px` }),
    ],
    [
      zlozDragHandle(
        h,
        semantic.context,
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
        [body],
      ),
      ...(semantic.description ? [semantic.description] : []),
      ...(context.ports ?? portRenderViews(h, context, target, undefined)),
      ...controls,
    ],
  );
}

/** Lane frame using the existing portless group lifecycle and optional shared heading geometry. */
export function zlozEventStormingGroup<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  options: ZlozEventStormingNodeOptions<M> = defaults,
): Html | undefined {
  const { node } = context;
  if (
    node.kind !== 'group' ||
    node.architecture?.family !== 'event-storming' ||
    node.architecture.role !== 'lane'
  )
    return undefined;
  const semantic = described(context, h, options);
  const borderWidth = 2;
  const declaredHeader = options.groupHeader
    ? options.groupHeader.sizing === 'intrinsic'
      ? { position: groupHeaderPosition(node, options.groupHeader), size: undefined }
      : resolveLayoutGroupHeader(node, options.groupHeader)
    : undefined;
  const header = context.collapsed ? undefined : declaredHeader;
  const intrinsic = Boolean(header && options.groupHeader?.sizing === 'intrinsic');
  const selected = context.state.selectedNodes.includes(node.id) || context.selectionPreview;
  const border = context.dropTarget
    ? 'var(--flow-valid-target, #0f766e)'
    : selected
      ? 'var(--flow-selection, #2563eb)'
      : 'var(--zloz-event-storming-lane, #64748b)';
  return zlozGroupFrame(
    h,
    context,
    [
      h.DataAttribute('zloz-event-storming-group', node.architecture.role),
      h.Style({
        background: 'var(--flow-group-background, rgb(100 116 139 / 0.08))',
        border: `${borderWidth}px ${context.dropTarget ? 'solid' : 'dashed'} ${border}`,
        color: 'var(--flow-node-color, #172033)',
      }),
      ...(options.attributes ?? []),
    ],
    [
      zlozDragHandle(
        h,
        semantic.context,
        [
          ...(header ? [h.DataAttribute('zloz-group-header', node.id)] : []),
          h.Style({
            position: 'absolute',
            top: `${header ? header.position.y - node.position.y : 8}px`,
            left: `${header ? header.position.x - node.position.x : 16}px`,
            width: intrinsic
              ? 'max-content'
              : header?.size
                ? `${header.size.width}px`
                : 'calc(100% - 144px)',
            height: intrinsic
              ? 'max-content'
              : `${header?.size ? header.size.height : Math.max(0, Math.min(56, node.size.height - 16))}px`,
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
        [
          options.bodyCache
            ? options.bodyCache(node, artwork<M>, [
                h,
                node,
                selected,
                context.selectionPreview,
                options,
              ])
            : artwork(h, node, selected, context.selectionPreview, options),
        ],
      ),
      ...(semantic.description ? [semantic.description] : []),
      ...(options.renderControls?.(context, h) ?? [
        h.div(
          [
            h.Style({
              position: 'absolute',
              top: '8px',
              right: '8px',
              display: 'flex',
              gap: '6px',
              pointerEvents: 'auto',
              zIndex: '2',
            }),
          ],
          [
            ...(context.contextAction ? [context.contextAction] : []),
            ...(context.collapseToggle ? [context.collapseToggle] : []),
          ],
        ),
        ...context.resizeHandles,
      ]),
    ],
  );
}
