/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Authored node shape geometry is a core domain contract. */
import type { Html, HtmlBuilder } from 'foldkit/html';

import { architectureNodePresets, type EventStormingNodeArchitecture } from './architecture';
import { zlozDragHandle, zlozNodeFrame, type ZlozNodeRenderContext } from './composition';
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
};
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
          ...part(options.renderDescription, context, h, () =>
            architecture.description
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
  const geometry = nodeShapeGeometry(node);
  const bounds = geometry.contentBounds;
  const stroke =
    selected || selectionPreview ? 'var(--flow-selection, #2563eb)' : accents[architecture.role];
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
              h.StrokeDasharray(selectionPreview ? '6 4' : 'none'),
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
/** Optional note renderer. Native geometry, sockets, selection, policies and controls remain live. */
export function zlozEventStormingNode<M>(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<M>,
  options: ZlozEventStormingNodeOptions<M> = defaults,
): Html | undefined {
  const { node, state } = context;
  if (node.kind === 'group' || node.architecture?.family !== 'event-storming') return undefined;
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
        [body],
      ),
      ...(context.ports ?? portRenderViews(h, context, target, undefined)),
      ...controls,
    ],
  );
}
