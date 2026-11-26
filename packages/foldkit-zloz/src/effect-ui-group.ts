import { Mount } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Match } from 'effect';

import { resolveZlozDiagnostics, visuallyHidden, type ZlozDiagnosticOptions } from './diagnostics';
import { surfaceInput } from './effect-ui-input';
import { edgeEndpoints, edgeGeometry, portPosition } from './geometry';
import type { ZlozGroupClipboardPolicyV3 } from './group-clipboard-v3';
import { planGroupConnectionV3 } from './group-connection-v3';
import { captureGroupEditorSourceV3, type ZlozGroupEditorPolicyV3 } from './group-editor-v3';
import { edgeIsVisible, groupsInPaintOrder, presentGroups } from './group-presentation';
import {
  groupClipboardActionsV3,
  groupInspectorEntriesV3,
  type GroupActionV3,
} from './group-workbench-controls-v3';
import {
  groupWorkbenchBoxSelectionV3,
  groupWorkbenchGraphV3,
  groupWorkbenchRoutesV3,
  type ZlozGroupWorkbenchEventV3,
  type ZlozGroupWorkbenchV3,
} from './group-workbench-v3';
import { portEditReason } from './port-edit';
import { zlozLightTheme, zlozThemeStyle, type ZlozTheme } from './theme';
import type { Point, ZlozGraph, ZlozNode, ZlozPortAnchorSnapBypassModifier } from './types';

export type GroupSurfaceOptionsV3<Message> = ZlozDiagnosticOptions &
  Readonly<{
    id: string;
    label?: string;
    theme?: ZlozTheme;
    policy?: ZlozGroupEditorPolicyV3;
    portAnchorSnapBypass?: ZlozPortAnchorSnapBypassModifier;
    onEvent: (event: ZlozGroupWorkbenchEventV3) => Message;
    nodeBadge?: (node: ZlozNode) => string | undefined;
  }>;

const position = (point: Point) => ({ left: `${point.x}px`, top: `${point.y}px` });
const frame = (node: ZlozNode) => ({
  ...position(node.position),
  width: `${node.size.width}px`,
  height: `${node.size.height}px`,
});
const protectedReason = (reason: string | null | undefined, fallback: string) =>
  reason == null ? null : reason.trim() || fallback;

function gestureControls<Message>(
  h: Html.H<Message>,
  model: ZlozGroupWorkbenchV3,
  options: GroupSurfaceOptionsV3<Message>,
  graph: ZlozGraph,
  nodes: readonly ZlozNode[],
) {
  const authored = model.editor.document.graph;
  const blocked = model.editor.readOnly
    ? 'This diagram is read-only.'
    : model.editor.activity.type === 'busy'
      ? model.editor.activity.reason
      : null;
  const why = (key: string, point: Point, reason: string | null) =>
    reason
      ? [h.p.key(key).class('zloz-ui-group-reason').style(position(point)).children(reason)]
      : [];
  const selected = new Set(model.selectedNodeIds);
  const controls = nodes
    .filter(({ id }) => selected.has(id))
    .flatMap((node) => {
      const point = { x: node.position.x + node.size.width, y: node.position.y + node.size.height };
      const resizeReason =
        blocked ??
        protectedReason(options.policy?.canResizeNode?.(node, authored), 'Size is protected.');
      return [
        h.button
          .key(`resize:${node.id}`)
          .class('zloz-ui-group-handle')
          .attr('type', 'button')
          .attr('data-flow-resize', node.id)
          .attr('data-flow-resize-handle', 'bottom-right')
          .attr('data-zloz-native-resize', '')
          .attr('aria-label', `Resize ${node.label}, bottom-right`)
          .attr('title', resizeReason ?? 'Drag or use arrow keys to resize. Escape cancels.')
          .disabled(resizeReason !== null)
          .style(position(point))
          .children('↘'),
        ...why(`resize-reason:${node.id}`, { x: point.x, y: point.y + 24 }, resizeReason),
        ...node.ports.flatMap((port) => {
          const anchor = portPosition(node, port.id);
          const point = {
            x: anchor.x + (port.side === 'left' ? -24 : 24),
            y: anchor.y + (port.side === 'top' ? -24 : port.side === 'bottom' ? 24 : 0),
          };
          const reason =
            blocked ??
            portEditReason(
              { operation: 'position', node, port },
              authored,
              options.policy?.canEditPort,
            );
          const gesture = model.gesture;
          const active =
            gesture.type === 'anchor' &&
            gesture.endpoint.node === node.id &&
            gesture.endpoint.port === port.id;
          const key = `anchor:${node.id}:${port.id}`;
          return [
            h.button
              .key(key)
              .class('zloz-ui-group-handle')
              .attr('type', 'button')
              .attr('data-flow-anchor-node', node.id)
              .attr('data-flow-anchor-port', port.id)
              .attr('data-flow-anchor-bypassed', active && gesture.bypassed ? 'true' : undefined)
              .attr(
                'data-flow-anchor-snapped',
                active ? (gesture.snap?.side ?? undefined) : undefined,
              )
              .attr('data-flow-anchor-corner', active ? gesture.snap?.corner : undefined)
              .attr('data-flow-anchor-midpoint', active ? gesture.snap?.midpoint : undefined)
              .attr('aria-label', `Move port anchor ${port.label ?? port.id} on ${node.label}`)
              .attr('aria-pressed', String(active))
              .attr('title', reason ?? 'Drag or use arrow keys to move the port anchor.')
              .disabled(reason !== null)
              .style(position(point))
              .children('⋮'),
            ...why(`${key}:reason`, { x: point.x, y: point.y + 24 }, reason),
          ];
        }),
      ];
    });
  const edge = graph.edges.find(({ id }) => id === model.selectedEdgeId);
  if (!edge) return controls;
  const points = edgeEndpoints(graph, edge);
  const reconnect = (['source', 'target'] as const).flatMap((end) => {
    const reason =
      blocked ??
      protectedReason(
        options.policy?.canReconnect?.(edge, end, authored),
        'This endpoint is protected.',
      );
    const point = points[end];
    const key = `reconnect:${edge.id}:${end}`;
    return [
      h.button
        .key(key)
        .class('zloz-ui-group-handle')
        .attr('type', 'button')
        .attr('data-flow-reconnect', edge.id)
        .attr('data-flow-edge-end', end)
        .attr('aria-label', `Reconnect ${end} of ${edge.label ?? edge.id}`)
        .attr('title', reason ?? 'Drag to another port. Escape cancels.')
        .disabled(reason !== null)
        .style(position({ x: point.x, y: point.y - 30 }))
        .children('↗'),
      ...why(`${key}:reason`, { x: point.x, y: point.y + 24 }, reason),
    ];
  });
  return [...controls, ...reconnect];
}

function groupNode<Message>(
  h: Html.H<Message>,
  model: ZlozGroupWorkbenchV3,
  node: ZlozNode,
  options: GroupSurfaceOptionsV3<Message>,
) {
  const badge = options.nodeBadge?.(node);
  const selected = model.selectedNodeIds.includes(node.id);
  return h.div
    .key(node.id)
    .class('zloz-ui-group-node')
    .attr('data-flow-node', node.id)
    .attr('data-group', node.kind === 'group' ? 'true' : undefined)
    .attr('data-selected', String(selected))
    .style(frame(node))
    .children(
      h.button
        .class('zloz-ui-group-title')
        .attr('type', 'button')
        .attr('data-flow-handle', node.id)
        .attr('aria-label', `Select or move ${node.label}`)
        .attr('aria-pressed', String(selected))
        .children(node.label),
      ...(badge
        ? [h.span.class('zloz-ui-group-badge').attr('data-zloz-workshop-badge', '').children(badge)]
        : []),
      ...node.ports.map((port) => {
        const point = portPosition(node, port.id);
        const endpoint = { node: node.id, port: port.id };
        const reason = protectedReason(
          options.policy?.canConnectPort?.(endpoint, model.editor.document.graph),
          'This port is protected.',
        );
        const plan = model.connectionSource
          ? planGroupConnectionV3(
              model.editor,
              {
                source: captureGroupEditorSourceV3(model.editor),
                edit: {
                  operation: 'create',
                  edges: [
                    {
                      id: `${model.editor.sessionId}:preview:${model.editor.revision}`,
                      source: model.connectionSource,
                      target: endpoint,
                    },
                  ],
                },
              },
              options.policy,
            )
          : null;
        const unavailable = reason ?? (plan?.type === 'blocked' ? plan.reason : null);
        return h.button
          .key(port.id)
          .class('zloz-ui-port', 'zloz-ui-group-port')
          .attr('type', 'button')
          .attr('data-flow-owner', node.id)
          .attr('data-flow-port', port.id)
          .attr('data-flow-port-kind', port.kind)
          .attr(
            'aria-label',
            `${node.label}, ${port.label ?? port.id}, ${port.kind}${unavailable ? `: ${unavailable}` : ''}`,
          )
          .attr(
            'aria-pressed',
            String(
              model.connectionSource?.node === node.id && model.connectionSource.port === port.id,
            ),
          )
          .attr('title', unavailable ?? `${port.label ?? port.id} — activate to connect`)
          .disabled(unavailable !== null || model.editor.readOnly)
          .style(position({ x: point.x - node.position.x, y: point.y - node.position.y }))
          .children(h.span.attr('aria-hidden', 'true').children(port.kind === 'input' ? '−' : '+'));
      }),
    );
}

/** Native view of the v3 editor. The parent applies scoped input to its complete-document reducer. */
export function groupSurfaceV3<Message>(
  h: Html.H<Message>,
  model: ZlozGroupWorkbenchV3,
  options: GroupSurfaceOptionsV3<Message>,
) {
  const { id, onEvent, policy } = options;
  const graph = groupWorkbenchGraphV3(model, policy);
  const scene = presentGroups(graph, model.collapsedGroupIds);
  const groups = groupsInPaintOrder(scene.nodes);
  const visible = [...groups, ...scene.nodes.filter((node) => node.kind !== 'group')];
  const byId = new Map(visible.map((node) => [node.id, node]));
  const geometryGraph = { ...graph, nodes: graph.nodes.map((node) => byId.get(node.id) ?? node) };
  const routes = new Map(groupWorkbenchRoutesV3(model).map((route) => [route.id, route]));
  const diagnostics = resolveZlozDiagnostics(options);
  const box = groupWorkbenchBoxSelectionV3(model, policy);
  const historyReason = model.editor.readOnly
    ? 'The v3 editor is read-only.'
    : model.editor.activity.type === 'busy'
      ? model.editor.activity.reason
      : model.gesture.type !== 'idle'
        ? 'Finish or cancel the active gesture first.'
        : null;
  const action = (label: string, event: ZlozGroupWorkbenchEventV3, reason: string | null = null) =>
    h.button
      .attr('type', 'button')
      .attr('title', reason ?? label)
      .disabled(reason !== null)
      .on('click', onEvent(event))
      .children(label);
  return h.div
    .class('zloz-ui-group-stage')
    .style(zlozThemeStyle(options.theme ?? zlozLightTheme))
    .children(
      h.div(
        action(
          'Undo',
          { type: 'UndoPressed' },
          historyReason ?? (model.editor.history.past.length ? null : 'No earlier edit.'),
        ),
        action(
          'Redo',
          { type: 'RedoPressed' },
          historyReason ?? (model.editor.history.future.length ? null : 'No later edit.'),
        ),
        action('Fit view', { type: 'FitViewRequested' }),
      ),
      ...(historyReason ? [h.p(historyReason)] : []),
      h.p
        .id(`${id}-help`)
        .style(diagnostics.instructions ? {} : visuallyHidden)
        .children(
          'Drag a node, or focus it and use arrow keys. Shift-click selects multiple nodes. Activate a source port, then a target. Escape cancels.',
        ),
      h.div
        .id(id)
        .key(`${id}:${model.editor.sessionId}`)
        .class('zloz-ui-surface', 'zloz-ui-group-surface')
        .attr('role', 'group')
        .attr('aria-label', options.label ?? 'V3 group editor')
        .attr('aria-describedby', `${id}-help`)
        .attr('tabindex', '0')
        .attr('data-flow-surface', '')
        .attr('data-flow-stable-pointer-origin', 'true')
        .attr('data-flow-connection-mode', model.editor.document.connectionMode)
        .attr('data-flow-readonly', String(model.editor.readOnly))
        .attr('data-flow-port-anchor-snap-bypass', options.portAnchorSnapBypass)
        .attr('data-flow-space-to-pan', 'true')
        .attr('data-flow-middle-button-pan', 'true')
        .attr('data-flow-pinch-zoom', 'true')
        .attr('data-flow-box-selection', 'true')
        .onMount(Mount.map(surfaceInput(), onEvent))
        .children(
          h.div
            .class('zloz-ui-world')
            .style({
              transform: `translate(${model.viewport.x}px, ${model.viewport.y}px) scale(${model.viewport.zoom})`,
            })
            .children(
              ...groups.map((node) =>
                h.div
                  .key(`fill:${node.id}`)
                  .class('zloz-ui-group-fill')
                  .attr('data-zloz-group-fill', node.id)
                  .attr('aria-hidden', 'true')
                  .style(frame(node))
                  .children(),
              ),
              new Html.Element<Message>('svg').class('zloz-ui-edges').children(
                ...graph.edges
                  .filter((edge) => edgeIsVisible(edge, scene.hiddenBy))
                  .map((edge) => {
                    const geometry = edgeGeometry(
                      geometryGraph,
                      edge,
                      routes.get(edge.id)?.points,
                      {
                        source: scene.hiddenBy.get(edge.source.node),
                        target: scene.hiddenBy.get(edge.target.node),
                      },
                    );
                    const selected = onEvent({
                      type: 'EdgeSelected',
                      id: edge.id,
                      additive: false,
                    });
                    return new Html.Element<Message, never, Html.Events>('path')
                      .key(edge.id)
                      .class('zloz-ui-edge')
                      .attr('d', geometry.path)
                      .attr('data-flow-edge', edge.id)
                      .attr('data-selected', String(model.selectedEdgeId === edge.id))
                      .attr('tabindex', '0')
                      .attr('role', 'button')
                      .attr('aria-label', `Select connection ${edge.label ?? edge.id}`)
                      .attr('aria-pressed', String(model.selectedEdgeId === edge.id))
                      .on(
                        'keydown',
                        ({ key }) => (key === 'Enter' || key === ' ' ? selected : undefined),
                        { preventDefault: true },
                      )
                      .children();
                  }),
              ),
              ...visible.map((node) => groupNode(h, model, node, options)),
              ...gestureControls(h, model, options, geometryGraph, visible),
              ...(box
                ? [
                    h.div
                      .class('zloz-ui-selection')
                      .attr('data-zloz-box-preview', '')
                      .attr('aria-hidden', 'true')
                      .style({
                        left: `${box.bounds.left}px`,
                        top: `${box.bounds.top}px`,
                        width: `${box.bounds.right - box.bounds.left}px`,
                        height: `${box.bounds.bottom - box.bounds.top}px`,
                      })
                      .children(),
                  ]
                : []),
            ),
        ),
      h.p
        .attr('role', 'status')
        .style(diagnostics.status || model.statusRequired ? {} : visuallyHidden)
        .children(model.status),
    );
}

type ControlsOptions<Message> = Pick<GroupSurfaceOptionsV3<Message>, 'onEvent' | 'theme'> &
  ZlozDiagnosticOptions &
  Readonly<{ policy?: ZlozGroupClipboardPolicyV3 }>;

function groupAction<Message>(
  h: Html.H<Message>,
  { label, event, reason }: GroupActionV3,
  onEvent: ControlsOptions<Message>['onEvent'],
) {
  return h.span.style({ display: 'inline-grid', gap: '4px', margin: '4px' }).children(
    h.button
      .attr('type', 'button')
      .disabled(reason !== null)
      .attr('title', reason ?? label)
      .on('click', onEvent(event))
      .children(label),
    ...(reason ? [h.small(reason)] : []),
  );
}

/** Native inspector backed by the same proposal and permission checks as the v3 reducer. */
export function groupInspectorV3<Message>(
  h: Html.H<Message>,
  model: ZlozGroupWorkbenchV3,
  options: ControlsOptions<Message>,
) {
  const action = (item: GroupActionV3) => groupAction(h, item, options.onEvent);
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'V3 modelling controls')
    .style(zlozThemeStyle(options.theme ?? zlozLightTheme))
    .children(
      ...groupInspectorEntriesV3(model, options.policy ?? {}).map((item) =>
        Match.value(item).pipe(
          Match.discriminatorsExhaustive('type')({
            action,
            text: ({ label }) => h.p(label),
            port: ({ id, label, actions }) =>
              h.div.key(id).children(h.p(label), ...actions.map(action)),
            reconnect: ({ end, actions }) =>
              h.details.children(h.summary(`Reconnect ${end}`), ...actions.map(action)),
          }),
        ),
      ),
    );
}

/** Session clipboard actions and findings for the current v3 editor. */
export function groupClipboardV3<Message>(
  h: Html.H<Message>,
  model: ZlozGroupWorkbenchV3,
  options: ControlsOptions<Message>,
  pasteOffset: Point = { x: 40, y: 40 },
) {
  const actions = groupClipboardActionsV3(model, options.policy ?? {}, pasteOffset);
  const diagnostics = resolveZlozDiagnostics(options);
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'V3 clipboard controls')
    .style(zlozThemeStyle(options.theme ?? zlozLightTheme))
    .children(
      ...actions.map((item) => groupAction(h, item, options.onEvent)),
      ...model.clipboardFindings.map(({ code, reason }) =>
        h.p.attr('data-zloz-clipboard-finding', code).children(reason),
      ),
      ...(diagnostics.instructions
        ? [
            h.p(
              'Copies groups and descendants with internal connections. External parents are detached; crossing connections are omitted. Clipboard state stays in this workbench session.',
            ),
          ]
        : []),
    );
}
