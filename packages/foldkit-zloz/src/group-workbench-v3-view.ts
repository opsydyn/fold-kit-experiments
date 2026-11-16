import { Option } from 'effect';
/* oxlint-disable linteffect/no-return-in-arrow -- Pure render callbacks derive geometry and bounded live policy previews; no Effect state transitions occur here. */
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { resolveZlozDiagnostics, visuallyHidden, type ZlozDiagnosticOptions } from './diagnostics';
import { edgeGeometry, fittedGroupBounds, portPosition } from './geometry';
import {
  copyGroupSelectionV3,
  planGroupPasteV3,
  type ZlozGroupClipboardPolicyV3,
} from './group-clipboard-v3';
import { planGroupConnectionV3 } from './group-connection-v3';
import { captureGroupEditorSourceV3 } from './group-editor-v3';
import { planGroupOperationV3 } from './group-operations-v3';
import { planGroupPortEditV3 } from './group-port-edit-v3';
import { edgeIsVisible, groupsInPaintOrder, presentGroups } from './group-presentation';
import {
  groupWorkbenchGraphV3,
  groupWorkbenchPasteRequestV3,
  groupWorkbenchRoutesV3,
  type ZlozGroupWorkbenchV3,
  type ZlozGroupWorkbenchEventV3,
} from './group-workbench-v3';
import { ZlozInput } from './mount';
import { zlozThemeStyle, type ZlozTheme } from './theme';
import type { Port, ZlozNode, ZlozEdge } from './types';
export type ZlozGroupWorkbenchViewOptionsV3<M> = ZlozDiagnosticOptions &
  Readonly<{
    /** Unique per simultaneously mounted instance. */
    id: string;
    label?: string;
    theme?: ZlozTheme;
    policy?: ZlozGroupClipboardPolicyV3;
    onEvent: (event: ZlozGroupWorkbenchEventV3) => M;
    /** Complete content inside the authored node frame, beside live ports. Compose zlozGroupDragHandleV3. */
    renderNode?: (node: ZlozNode, selected: boolean, h: HtmlBuilder<M>) => Html;
    renderPort?: (node: ZlozNode, port: Port, h: HtmlBuilder<M>) => Html;
    renderEdge?: (
      edge: ZlozEdge,
      geometry: ReturnType<typeof edgeGeometry>,
      h: HtmlBuilder<M>,
    ) => Html;
    /** Null hides optional parts. Required policy explanations stay with their controls. */
    renderControls?: (model: ZlozGroupWorkbenchV3, h: HtmlBuilder<M>) => Html | null;
  }>;
/** Composable native drag/selection handle. Keep custom controls outside this button. */
export function zlozGroupDragHandleV3<M>(
  h: HtmlBuilder<M>,
  node: ZlozNode,
  selected: boolean,
  children: Parameters<HtmlBuilder<M>['button']>[1] = [node.label],
): Html {
  return h.button(
    [
      h.Type('button'),
      h.DataAttribute('flow-handle', node.id),
      h.AriaLabel(`Select or move ${node.label}`),
      h.AriaPressed(String(selected)),
      h.Style({
        display: 'block',
        width: '100%',
        'min-height': '40px',
        padding: '8px',
        background: 'transparent',
        color: 'inherit',
        border: '0',
        cursor: 'grab',
        margin: '0',
        'pointer-events': 'auto',
        'box-sizing': 'border-box',
        'text-align': 'left',
      }),
    ],
    children,
  );
}
/** Unstyled composable control with a visible protection reason, independent of diagnostics. */
export function zlozGroupActionV3<M>(
  h: HtmlBuilder<M>,
  label: string,
  event: ZlozGroupWorkbenchEventV3,
  reason: string | null,
  onEvent: ZlozGroupWorkbenchViewOptionsV3<M>['onEvent'],
): Html {
  return h.span(
    [h.Style({ display: 'inline-grid', gap: '4px', margin: '4px' })],
    [
      h.button(
        [
          h.Type('button'),
          h.Disabled(reason !== null),
          h.Title(reason ?? label),
          h.OnClick(onEvent(event)),
          h.Style({
            'min-height': '36px',
            padding: '6px 10px',
            color: 'inherit',
            background: 'var(--flow-node-background, #fff)',
            border: '1px solid var(--flow-node-border, #94a3b8)',
            'border-radius': '6px',
          }),
        ],
        [label],
      ),
      ...(reason ? [h.small([], [reason])] : []),
    ],
  );
}
/** Optional session-clipboard controls. Compose separately or replace with headless planners/custom controls. */
export function zlozGroupClipboardV3<M>(
  h: HtmlBuilder<M>,
  model: ZlozGroupWorkbenchV3,
  options: ZlozGroupWorkbenchViewOptionsV3<M>,
  pasteOffset = { x: 40, y: 40 },
): Html {
  const policy = options.policy ?? {},
    copy = copyGroupSelectionV3(model.editor, model.selectedNodeIds, policy);
  const request = groupWorkbenchPasteRequestV3(model, pasteOffset);
  const paste = request ? planGroupPasteV3(model.editor, request, policy) : null;
  const busy = model.gesture.type !== 'idle' ? 'Finish or cancel the active gesture first.' : null;
  const copyReason = busy ?? (copy.type === 'blocked' ? copy.reason : null);
  const pasteReason =
    busy ??
    (paste?.type === 'blocked'
      ? paste.reason
      : request
        ? null
        : 'Copy a selection before pasting.');
  const diagnostics = resolveZlozDiagnostics(options);
  return h.div(
    [
      h.Role('group'),
      h.AriaLabel('V3 clipboard controls'),
      h.Style({ ...zlozThemeStyle(options.theme ?? {}), color: 'var(--flow-node-color, #172033)' }),
    ],
    [
      zlozGroupActionV3(h, 'Copy selection', { type: 'CopyPressed' }, copyReason, options.onEvent),
      zlozGroupActionV3(
        h,
        'Paste copy',
        request ? { type: 'GroupPasteRequested', request } : { type: 'PastePressed' },
        pasteReason,
        options.onEvent,
      ),
      ...model.clipboardFindings.map((f) =>
        h.p([h.DataAttribute('zloz-clipboard-finding', f.code)], [f.reason]),
      ),
      ...(diagnostics.instructions
        ? [
            h.p(
              [],
              [
                'Copies groups and descendants with internal connections. External parents are detached; crossing connections are omitted. Clipboard state stays in this workbench session.',
              ],
            ),
          ]
        : []),
    ],
  );
}
/** Optional native inspector. Every prospective action uses the live source and same pure planners. */
export function zlozGroupInspectorV3<M>(
  h: HtmlBuilder<M>,
  model: ZlozGroupWorkbenchV3,
  options: ZlozGroupWorkbenchViewOptionsV3<M>,
): Html {
  const policy = options.policy ?? {},
    source = captureGroupEditorSourceV3(model.editor);
  const action = (label: string, event: ZlozGroupWorkbenchEventV3) => {
    const plan =
      event.type === 'GroupOperationRequested'
        ? planGroupOperationV3(model.editor, { source, operation: event.operation }, policy)
        : event.type === 'GroupPortEditRequested'
          ? planGroupPortEditV3(model.editor, { source, edit: event.edit }, policy)
          : event.type === 'ConnectionEditRequested'
            ? planGroupConnectionV3(model.editor, { source, edit: event.edit }, policy)
            : null;
    const reason =
      model.gesture.type !== 'idle'
        ? 'Finish or cancel the active gesture first.'
        : plan?.type === 'blocked'
          ? plan.reason
          : null;
    return zlozGroupActionV3(h, label, event, reason, options.onEvent);
  };
  const node =
    model.selectedNodeIds.length === 1
      ? model.editor.document.graph.nodes.find((n) => n.id === model.selectedNodeIds[0])
      : undefined;
  const edge = model.editor.document.graph.edges.find((e) => e.id === model.selectedEdgeId);
  const selectedNodes = model.editor.document.graph.nodes.filter((n) =>
    model.selectedNodeIds.includes(n.id),
  );
  const groupId = `${model.editor.sessionId}:group:${model.editor.revision + 1}`;
  const bounds = selectedNodes.length ? fittedGroupBounds(selectedNodes) : null;

  const operation = (
    label: string,
    value: Extract<ZlozGroupWorkbenchEventV3, { type: 'GroupOperationRequested' }>['operation'],
  ) => action(label, { type: 'GroupOperationRequested', operation: value });
  return h.div(
    [
      h.Role('group'),
      h.AriaLabel('V3 modelling controls'),
      h.Style({ ...zlozThemeStyle(options.theme ?? {}), color: 'var(--flow-node-color, #172033)' }),
    ],
    [
      ...(bounds
        ? [
            operation('Group selected nodes', {
              operation: 'group',
              nodeIds: model.selectedNodeIds,
              node: {
                id: groupId,
                label: 'New group',
                kind: 'group',
                position: bounds.position,
                size: bounds.size,
                ports: [],
              },
            }),
            ...model.editor.document.graph.nodes
              .filter((n) => n.kind === 'group' && !model.selectedNodeIds.includes(n.id))
              .map((parent) =>
                operation(`Move into ${parent.label}`, {
                  operation: 'reparent',
                  nodeIds: model.selectedNodeIds,
                  parentId: parent.id,
                }),
              ),
          ]
        : []),

      ...(model.selectedNodeIds.length
        ? [
            h.p([], [node?.label ?? `${model.selectedNodeIds.length} selected nodes`]),
            ...[
              { x: -20, y: 0, label: 'Move left' },
              { x: 20, y: 0, label: 'Move right' },
              { x: 0, y: -20, label: 'Move up' },
              { x: 0, y: 20, label: 'Move down' },
            ].map(({ x, y, label }) =>
              operation(label, {
                operation: 'move',
                nodeIds: model.selectedNodeIds,
                delta: { x, y },
              }),
            ),
            operation('Detach from parent', {
              operation: 'reparent',
              nodeIds: model.selectedNodeIds,
              parentId: null,
            }),
            operation('Delete selected nodes', {
              operation: 'delete',
              nodeIds: model.selectedNodeIds,
              edgeIds: [],
            }),
          ]
        : [h.p([], ['Select a node or connection to inspect it.'])]),
      ...(node
        ? [
            operation('Wider', {
              operation: 'resize',
              id: node.id,
              size: { ...node.size, width: node.size.width + 20 },
            }),
            operation('Narrower', {
              operation: 'resize',
              id: node.id,
              size: { ...node.size, width: Math.max(1, node.size.width - 20) },
            }),
            operation('Taller', {
              operation: 'resize',
              id: node.id,
              size: { ...node.size, height: node.size.height + 20 },
            }),
            operation('Shorter', {
              operation: 'resize',
              id: node.id,
              size: { ...node.size, height: Math.max(1, node.size.height - 20) },
            }),
          ]
        : []),
      ...(node?.kind === 'group'
        ? [
            action(model.collapsedGroupIds.includes(node.id) ? 'Expand group' : 'Collapse group', {
              type: 'GroupCollapseToggled',
              id: node.id,
            }),
            operation('Ungroup', { operation: 'ungroup', id: node.id }),
            action('Add output port', {
              type: 'GroupPortEditRequested',
              edit: {
                operation: 'add',
                nodeId: node.id,
                port: {
                  id: `${node.id}:port:${model.editor.revision + 1}`,
                  kind: 'output',
                  side: 'right',
                  offset: 0.5,
                },
              },
            }),
            ...node.ports.map((port) =>
              h.div(
                [h.Key(port.id)],
                [
                  h.p([], [`${port.label ?? port.id} (${port.kind})`]),
                  action('Anchor at top', {
                    type: 'GroupPortEditRequested',
                    edit: {
                      operation: 'position',
                      endpoint: { node: node.id, port: port.id },
                      position: { side: 'top', offset: 0.5 },
                    },
                  }),
                  action('Anchor at right', {
                    type: 'GroupPortEditRequested',
                    edit: {
                      operation: 'position',
                      endpoint: { node: node.id, port: port.id },
                      position: { side: 'right', offset: 0.5 },
                    },
                  }),
                  action('Remove port and attached connections', {
                    type: 'GroupPortEditRequested',
                    edit: { operation: 'remove', endpoint: { node: node.id, port: port.id } },
                  }),
                ],
              ),
            ),
          ]
        : []),
      ...(edge
        ? [
            h.p([], [edge.label ?? edge.id]),
            operation('Delete connection', {
              operation: 'delete',
              nodeIds: [],
              edgeIds: [edge.id],
            }),
            ...(['source', 'target'] as const).map((end) =>
              h.details(
                [],
                [
                  h.summary([], [`Reconnect ${end}`]),
                  ...model.editor.document.graph.nodes.flatMap((n) =>
                    n.ports.map((port) =>
                      action(`${n.label}: ${port.label ?? port.id}`, {
                        type: 'ConnectionEditRequested',
                        edit: {
                          operation: 'reconnect',
                          edgeId: edge.id,
                          end,
                          endpoint: { node: n.id, port: port.id },
                        },
                      }),
                    ),
                  ),
                ],
              ),
            ),
          ]
        : []),
    ],
  );
}
/** Native v3 surface. Uses the scoped package input resource; never constructs a legacy EditorState. */
export function zlozGroupWorkbenchV3<M>(
  h: HtmlBuilder<M>,
  model: ZlozGroupWorkbenchV3,
  options: ZlozGroupWorkbenchViewOptionsV3<M>,
): Html {
  const policy = options.policy ?? {},
    graph = groupWorkbenchGraphV3(model, policy),
    presentation = presentGroups(graph, model.collapsedGroupIds),
    diagnostics = resolveZlozDiagnostics(options);
  const layoutRoutes = new Map(groupWorkbenchRoutesV3(model).map((route) => [route.id, route]));
  const byId = new Map(presentation.nodes.map((node) => [node.id, node]));
  const geometryGraph = { ...graph, nodes: graph.nodes.map((node) => byId.get(node.id) ?? node) };
  const button = (label: string, event: ZlozGroupWorkbenchEventV3, reason: string | null = null) =>
    zlozGroupActionV3(h, label, event, reason, options.onEvent);
  const historyReason = model.editor.readOnly
    ? 'The v3 editor is read-only.'
    : model.editor.activity.type === 'busy'
      ? model.editor.activity.reason
      : model.gesture.type !== 'idle'
        ? 'Finish or cancel the active gesture first.'
        : null;
  const controls = options.renderControls
    ? options.renderControls(model, h)
    : h.div(
        [],
        [
          button(
            'Undo',
            { type: 'UndoPressed' },
            historyReason ?? (model.editor.history.past.length ? null : 'No earlier edit.'),
          ),
          button(
            'Redo',
            { type: 'RedoPressed' },
            historyReason ?? (model.editor.history.future.length ? null : 'No later edit.'),
          ),
          button('Fit view', { type: 'FitViewRequested' }),
        ],
      );
  const selected = new Set(model.selectedNodeIds),
    viewport = model.viewport;
  const nodes = [
    ...groupsInPaintOrder(presentation.nodes),
    ...presentation.nodes.filter((node) => node.kind !== 'group'),
  ];
  return h.div(
    [
      h.Style({
        ...zlozThemeStyle(options.theme ?? {}),
        height: '100%',
        display: 'flex',
        'flex-direction': 'column',
        'min-height': '0',
        color: 'var(--flow-node-color, #172033)',
      }),
    ],
    [
      ...(controls ? [controls] : []),
      h.p(
        [h.Id(`${options.id}-help`), h.Style(diagnostics.instructions ? {} : visuallyHidden)],
        [
          'Drag a node, or focus it and use arrow keys. Shift-click selects multiple nodes. Activate a source port, then a target. Escape cancels. Use the inspector for resizing, group ports and reconnection.',
        ],
      ),
      h.div(
        [
          h.Id(options.id),
          h.DataAttribute('flow-surface', ''),
          h.DataAttribute('flow-connection-mode', model.editor.document.connectionMode),
          h.DataAttribute('flow-readonly', String(model.editor.readOnly)),
          h.DataAttribute('flow-space-to-pan', 'true'),
          h.DataAttribute('flow-middle-button-pan', 'true'),
          h.Tabindex(0),
          h.Role('group'),
          h.AriaLabel(options.label ?? 'V3 group editor'),
          h.AriaDescribedBy(`${options.id}-help`),
          h.OnMount(Mount.mapMessage(ZlozInput(), (message) => options.onEvent(message.event))),
          h.Style({
            position: 'relative',
            flex: '1',
            'min-height': '280px',
            overflow: 'hidden',
            'touch-action': 'none',
            background: 'var(--flow-background, #eef2f6)',
            border: '1px solid var(--flow-canvas-border, #94a3b8)',
            'border-radius': '10px',
          }),
        ],
        [
          h.div(
            [
              h.Style({
                position: 'absolute',
                inset: '0',
                'transform-origin': '0 0',
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
              }),
            ],
            [
              ...groupsInPaintOrder(presentation.nodes).map((node) =>
                h.div(
                  [
                    h.Key(`group-fill:${node.id}`),
                    h.AriaHidden(true),
                    h.DataAttribute('zloz-group-fill', node.id),
                    h.Style({
                      position: 'absolute',
                      left: `${node.position.x}px`,
                      top: `${node.position.y}px`,
                      width: `${node.size.width}px`,
                      height: `${node.size.height}px`,
                      background: 'var(--flow-group-background, #e4eaf4)',
                      'border-radius': '8px',
                      'pointer-events': 'none',
                    }),
                  ],
                  [],
                ),
              ),
              h.svg(
                [
                  h.Width('1'),
                  h.Height('1'),
                  h.Style({ position: 'absolute', overflow: 'visible' }),
                ],
                graph.edges
                  .filter((edge) => edgeIsVisible(edge, presentation.hiddenBy))
                  .map((edge) => {
                    const geometry = edgeGeometry(
                      geometryGraph,
                      edge,
                      layoutRoutes.get(edge.id)?.points,
                      {
                        source: presentation.hiddenBy.get(edge.source.node),
                        target: presentation.hiddenBy.get(edge.target.node),
                      },
                    );
                    return (
                      options.renderEdge?.(edge, geometry, h) ??
                      h.path([
                        h.Key(edge.id),
                        h.D(geometry.path),
                        h.Fill('none'),
                        h.Stroke(
                          model.selectedEdgeId === edge.id
                            ? 'var(--flow-selection, #2563eb)'
                            : 'var(--flow-edge, #64748b)',
                        ),
                        h.StrokeWidth('3'),
                        h.DataAttribute('flow-edge', edge.id),
                        h.Tabindex(0),
                        h.Role('button'),
                        h.AriaLabel(`Select connection ${edge.label ?? edge.id}`),
                        h.OnKeyDownSelfPreventDefault((key) =>
                          key === 'Enter' || key === ' '
                            ? Option.some(
                                options.onEvent({
                                  type: 'EdgeSelected',
                                  id: edge.id,
                                  additive: false,
                                }),
                              )
                            : Option.none(),
                        ),
                        h.OnClick(
                          options.onEvent({ type: 'EdgeSelected', id: edge.id, additive: false }),
                        ),
                      ])
                    );
                  }),
              ),
              ...nodes.map((node) =>
                h.div(
                  [
                    h.Key(node.id),
                    h.DataAttribute('flow-node', node.id),
                    h.Style({
                      position: 'absolute',
                      left: `${node.position.x}px`,
                      top: `${node.position.y}px`,
                      width: `${node.size.width}px`,
                      height: `${node.size.height}px`,
                      'box-sizing': 'border-box',
                      background:
                        node.kind === 'group' ? 'transparent' : 'var(--flow-node-background, #fff)',
                      color: 'var(--flow-node-color, #172033)',
                      border: '0',
                      'box-shadow': `inset 0 0 0 2px ${selected.has(node.id) ? 'var(--flow-selection, #2563eb)' : 'var(--flow-node-border, #94a3b8)'}`,
                      'pointer-events': node.kind === 'group' ? 'none' : 'auto',
                      'border-radius': '8px',
                    }),
                  ],
                  [
                    options.renderNode
                      ? h.div(
                          [h.Style({ 'pointer-events': 'auto' })],
                          [options.renderNode(node, selected.has(node.id), h)],
                        )
                      : zlozGroupDragHandleV3(h, node, selected.has(node.id)),
                    ...node.ports.map((port) => {
                      const point = portPosition(node, port.id),
                        endpoint = { node: node.id, port: port.id };
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
                            policy,
                          )
                        : null;
                      const portReason = policy.canConnectPort?.(
                        endpoint,
                        model.editor.document.graph,
                      );
                      const reason =
                        portReason != null
                          ? portReason.trim() || 'This port is protected.'
                          : plan?.type === 'blocked'
                            ? plan.reason
                            : null;
                      return h.button(
                        [
                          h.Key(port.id),
                          h.Type('button'),
                          h.DataAttribute('flow-owner', node.id),
                          h.DataAttribute('flow-port', port.id),
                          h.DataAttribute('flow-port-kind', port.kind),
                          h.AriaLabel(
                            `${node.label}, ${port.label ?? port.id}, ${port.kind}${reason ? `: ${reason}` : ''}`,
                          ),
                          h.Title(reason ?? `${port.label ?? port.id} — activate to connect`),
                          h.Disabled(reason !== null || model.editor.readOnly),
                          h.Style({
                            position: 'absolute',
                            margin: '0',
                            'pointer-events': 'auto',
                            'box-sizing': 'border-box',
                            left: `${point.x - node.position.x}px`,
                            top: `${point.y - node.position.y}px`,
                            transform: 'translate(-50%, -50%)',
                            width: '24px',
                            height: '24px',
                            padding: '0',
                            'border-radius': '50%',
                            border: '2px solid var(--flow-port-border, #fff)',
                            background:
                              port.kind === 'input'
                                ? 'var(--flow-input-port, #2563eb)'
                                : 'var(--flow-output-port, #b45309)',
                            color: 'var(--flow-control-color, #fff)',
                          }),
                        ],
                        [
                          options.renderPort?.(node, port, h) ??
                            h.span([h.AriaHidden(true)], [port.kind === 'input' ? '−' : '+']),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      h.p(
        [h.Role('status'), h.AriaLive('polite'), h.Style(diagnostics.status ? {} : visuallyHidden)],
        [model.status],
      ),
    ],
  );
}
