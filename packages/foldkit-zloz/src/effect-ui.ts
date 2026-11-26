import { Mount } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Queue, Stream } from 'effect';

import type { BrowserInput } from './browser-input';
import { portConnectionEnd } from './connection-mode';
import { resolveConnectionPreview } from './connection-preview';
import { resolveEdgeGeometry } from './edge-geometry';
import { portBoundaryPosition } from './geometry';
import { presentVisibleGraph } from './group-presentation';
import { bindInput } from './input';
import { resolveBoxSelection } from './selection-preview';
import type { EditorPolicy, EditorState, Port, ZlozNode } from './types';

export { BrowserInput } from './browser-input';

/** Delivers native ZLOZ input while the host's graph surface is mounted. */
export const surfaceInput = Mount.makeStream(
  'ZlozSurfaceInput',
  { args: {} },
  (element: HTMLElement) =>
    Stream.callback<BrowserInput>((queue) => {
      const bind = Effect.sync(() =>
        bindInput(element, (event) => Queue.offerUnsafe(queue, event)),
      );
      return Effect.acquireRelease(bind, Effect.sync);
    }),
);

type GraphPortContext = Readonly<{
  port: Port;
  end: 'source' | 'target';
  reason: string | null;
}>;

export type GraphSurfaceOptions<Message> = Readonly<{
  id: string;
  label: string;
  descriptionId?: string;
  onInput: (event: BrowserInput) => Message;
  wheelNavigation?: 'off' | 'zoom' | 'pan';
  dropRadius?: number;
  reconnect?: boolean;
  portLabel?: (context: GraphPortContext) => string | undefined;
  policy?: EditorPolicy;
  nodeNote?: (node: ZlozNode) => string;
}>;

const reconnectOffset = {
  left: [-24, 0],
  right: [24, 0],
  top: [0, -24],
  bottom: [0, 24],
} as const;

/** Render a native Effect UI graph surface while the host owns all editor state and policy. */
export function graphSurface<Message>(
  h: Html.H<Message>,
  editor: EditorState,
  options: GraphSurfaceOptions<Message>,
) {
  const { id, label, descriptionId, onInput, policy, dropRadius = 0 } = options;
  const svg = (tag: string) => new Html.Element<Message>(tag);
  const scene = presentVisibleGraph(editor);
  const preview = resolveConnectionPreview(editor);
  const selection =
    editor.gesture.type === 'box-selection'
      ? resolveBoxSelection(editor, editor.gesture, scene.nodes, policy?.canSelectNode)
      : undefined;
  const selecting = new Set(selection?.previewNodeIds);
  const marker = `${id}-arrow`;
  const edgeViews = scene.edges.map((edge) => {
    const route = editor.routes.find((item) => item.id === edge.id);
    const geometry = resolveEdgeGeometry(editor.graph, edge, {
      route: route?.points,
      labelPosition: route?.label?.position,
      sourceGroup: scene.hiddenBy.get(edge.source.node),
      targetGroup: scene.hiddenBy.get(edge.target.node),
    });
    const path = svg('path')
      .key(edge.id)
      .class('zloz-ui-edge')
      .attr('d', geometry.path)
      .attr('data-flow-edge', edge.id)
      .attr('data-selected', String(editor.selectedEdges.includes(edge.id)))
      .attr('marker-end', `url(#${marker})`)
      .children();
    const position = geometry.labelPosition;
    const label =
      edge.label && position
        ? h.span
            .key(`label:${edge.id}`)
            .class('zloz-ui-edge-label')
            .style({ left: `${position.x}px`, top: `${position.y}px` })
            .children(edge.label)
        : null;
    return { path, label };
  });
  const handles =
    options.reconnect && !editor.readOnly
      ? scene.edges
          .filter((edge) => editor.selectedEdges.includes(edge.id))
          .flatMap((edge) =>
            (['source', 'target'] as const).flatMap((end) => {
              const endpoint = edge[end];
              if (
                policy?.canReconnect?.(edge, end, editor.graph) ||
                scene.hiddenBy.has(endpoint.node)
              )
                return [];
              const node = scene.nodes.find(({ id }) => id === endpoint.node);
              const port = node?.ports.find(({ id }) => id === endpoint.port);
              if (!node || !port) return [];
              const point = portBoundaryPosition(node, port.id);
              const [x, y] = reconnectOffset[port.side];
              return [
                svg('circle')
                  .key(`reconnect:${edge.id}:${end}`)
                  .class('zloz-ui-reconnect')
                  .attr('data-flow-reconnect', edge.id)
                  .attr('data-flow-edge-end', end)
                  .attr('cx', String(point.x + x))
                  .attr('cy', String(point.y + y))
                  .attr('r', '9')
                  .children(),
              ];
            }),
          )
      : [];
  return h.div
    .key(id)
    .id(`${id}-surface`)
    .class('zloz-ui-surface')
    .attr('role', 'region')
    .attr('aria-label', label)
    .attr('aria-describedby', descriptionId)
    .attr('tabindex', '0')
    .attr('data-flow-surface', id)
    .attr('data-flow-readonly', String(editor.readOnly))
    .attr('data-flow-connection-mode', editor.connectionMode ?? 'strict')
    .attr('data-flow-connection-drop-radius', String(dropRadius))
    .attr('data-flow-reconnection-drop-radius', String(dropRadius))
    .attr('data-flow-wheel-navigation', options.wheelNavigation ?? 'off')
    .attr('data-flow-pinch-zoom', 'true')
    .onMount(Mount.map(surfaceInput(), onInput))
    .children(
      h.div
        .class('zloz-ui-world')
        .style({
          transform: `translate(${editor.viewport.x}px, ${editor.viewport.y}px) scale(${editor.viewport.zoom})`,
        })
        .children(
          svg('svg')
            .class('zloz-ui-edges')
            .attr('aria-hidden', 'true')
            .children(
              svg('defs').children(
                svg('marker')
                  .id(marker)
                  .attr('viewBox', '0 0 10 10')
                  .attr('refX', '9')
                  .attr('refY', '5')
                  .attr('markerWidth', '6')
                  .attr('markerHeight', '6')
                  .attr('orient', 'auto')
                  .children(svg('path').attr('d', 'M 0 0 L 10 5 L 0 10 Z').children()),
              ),
              ...edgeViews.map(({ path }) => path),
              ...(preview
                ? [
                    svg('path')
                      .key('preview')
                      .class('zloz-ui-preview')
                      .attr('data-feedback', preview.feedback.type)
                      .attr('d', preview.path)
                      .children(),
                  ]
                : []),
            ),
          ...scene.nodes.map((node) => nodeView(h, editor, options, node, selecting.has(node.id))),
          ...(selection
            ? [
                h.div
                  .key('selection')
                  .class('zloz-ui-selection')
                  .attr('data-flow-selection-box', '')
                  .attr('aria-hidden', 'true')
                  .style({
                    left: `${selection.bounds.left}px`,
                    top: `${selection.bounds.top}px`,
                    width: `${selection.bounds.right - selection.bounds.left}px`,
                    height: `${selection.bounds.bottom - selection.bounds.top}px`,
                  })
                  .children(),
              ]
            : []),
          ...edgeViews.flatMap(({ label }) => (label ? [label] : [])),
          ...(handles.length > 0
            ? [
                svg('svg')
                  .key('reconnect')
                  .class('zloz-ui-handles')
                  .attr('aria-hidden', 'true')
                  .children(...handles),
              ]
            : []),
        ),
    );
}

function nodeView<Message>(
  h: Html.H<Message>,
  editor: EditorState,
  options: GraphSurfaceOptions<Message>,
  node: ZlozNode,
  selecting: boolean,
) {
  const note = options.nodeNote?.(node);
  return h.div
    .key(node.id)
    .class('zloz-ui-node')
    .attr('data-flow-node', node.id)
    .attr('data-selection-preview', selecting ? 'true' : undefined)
    .style({
      left: `${node.position.x}px`,
      top: `${node.position.y}px`,
      width: `${node.size.width}px`,
      height: `${node.size.height}px`,
    })
    .children(
      h.button
        .class('zloz-ui-node-title')
        .attr('type', 'button')
        .attr('data-flow-handle', node.id)
        .attr('aria-label', `Select ${node.label}`)
        .attr('aria-pressed', String(editor.selectedNodes.includes(node.id)))
        .children(node.label),
      ...(note ? [h.p.class('zloz-ui-node-note').children(note)] : []),
      ...node.ports.map((port) => {
        const endpoint = { node: node.id, port: port.id };
        const point = portBoundaryPosition(node, port.id);
        const active = editor.connection?.node === node.id && editor.connection.port === port.id;
        const drag = editor.gesture.type === 'connection-drag' ? editor.gesture : undefined;
        const target = drag?.target?.node === node.id && drag.target.port === port.id;
        const end = portConnectionEnd(editor, port);
        const reason = editor.readOnly
          ? 'This diagram is read-only.'
          : options.policy?.canConnectPort?.(endpoint, editor.graph);
        const label = options.portLabel?.({ port, end, reason: reason ?? null });
        return h.button
          .key(port.id)
          .class('zloz-ui-port', label !== undefined && 'zloz-ui-port-custom')
          .attr('type', 'button')
          .attr('data-flow-owner', node.id)
          .attr('data-flow-port', port.id)
          .attr('data-flow-port-kind', port.kind)
          .attr('data-flow-connection-end', end)
          .attr('data-custom-intent', label !== undefined ? end : undefined)
          .attr('data-target', target ? 'true' : undefined)
          .attr(
            'aria-label',
            `Connect ${end === 'source' ? 'from' : 'to'} ${node.label}: ${port.label ?? port.id}`,
          )
          .attr('aria-pressed', String(active))
          .attr('title', reason ?? undefined)
          .disabled(reason != null)
          .style({ left: `${point.x - node.position.x}px`, top: `${point.y - node.position.y}px` })
          .children(label ?? '');
      }),
    );
}
