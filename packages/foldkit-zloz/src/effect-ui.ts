import { Mount, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import type { BrowserInput } from './browser-input';
import {
  doubleClickZoomFactor,
  type ZlozSelectionMarqueeContext,
  type ZlozZoomAreaMarqueeContext,
} from './canvas-gestures';
import { portConnectionEnd } from './connection-mode';
import { resolveConnectionPreview } from './connection-preview';
import { resolveContextMapRelationship } from './context-map';
import { contextPanelPlacement, resolveContextMenu } from './context-menu-context';
import { resolveEdgeGeometry } from './edge-geometry';
import { contextMapLabel } from './effect-ui-context-map';
import { contextMenu, type NativeContextMenuOptions } from './effect-ui-context-menu';
import { edgeLabel, edgeToolbar, type NativeEdgeEditing } from './effect-ui-edge-editing';
import {
  anchorControls,
  anchorGuides,
  waypointControls,
  type NativeWaypointOptions,
} from './effect-ui-geometry-controls';
import { surfaceInput } from './effect-ui-input';
import { notationView, notationDash, notationPrefix, notationStroke } from './effect-ui-notation';
import { nodeResizeControls, nodeResizeReadout } from './effect-ui-resize';
import { boxBounds, portBoundaryPosition, portPosition } from './geometry';
import { groupsInPaintOrder, presentVisibleGraph } from './group-presentation';
// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Reuse the canonical authored outline.
import { nodeShapeGeometry } from './node-shape';
import { resolveBoxSelection } from './selection-preview';
import { zlozThemeStyle, type ZlozTheme } from './theme';
import type {
  EditorPolicy,
  EditorState,
  Port,
  ZlozNode,
  ZlozPortAnchorSnapBypassModifier,
} from './types';
import { resolveEdgeWaypointControls } from './waypoint-controls';
import { resolveEdgeWaypointPreview } from './waypoint-interaction';

export { BrowserInput } from './browser-input';
export type { ZlozSelectionMarqueeContext, ZlozZoomAreaMarqueeContext } from './canvas-gestures';
export {
  viewportControlActions,
  type ZlozViewportActions,
  type ZlozViewportControl,
} from './viewport-controls';

export { surfaceInput } from './effect-ui-input';
export { contextMenu, type NativeContextMenuOptions } from './effect-ui-context-menu';
export type { ZlozContextMenuContext } from './context-menu';
export { endpointField, type NativeEndpointFieldOptions } from './effect-ui-endpoints';
export type { NativeEdgeEditing } from './effect-ui-edge-editing';
export type { ZlozEdgeLabelContext, ZlozEdgeLabelEditorContext } from './edge-label';
export { viewportControl } from './effect-ui-viewport-control';
export {
  groupClipboardV3,
  groupInspectorV3,
  groupSurfaceV3,
  type GroupSurfaceOptionsV3,
} from './effect-ui-group';

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
  /** Background double-click zoom. True uses 1.25. A custom factor must exceed 1. */
  doubleClickZoom?: boolean | number;
  spaceToPan?: boolean;
  middleButtonPan?: boolean;
  /** Pan near the canvas boundary while dragging nodes or connections. */
  autoPan?: boolean;
  /** Keep pointer coordinates relative to the surface's position at pointer down. */
  stablePointerOrigin?: boolean;
  /** Show pending node highlights during box selection. Defaults to true. */
  selectionPreviewHighlights?: boolean;
  /** Customize the decorative box. Undefined uses the default and null hides it. */
  renderSelectionMarquee?: (
    context: ZlozSelectionMarqueeContext,
    h: Html.H<Message>,
  ) => View.Content<Message> | null | undefined;
  /** Customize the decorative camera box. Undefined uses the default and null hides it. */
  renderZoomAreaMarquee?: (
    context: ZlozZoomAreaMarqueeContext,
    h: Html.H<Message>,
  ) => View.Content<Message> | null | undefined;
  dropRadius?: number;
  reconnect?: boolean;
  /** Expose native width controls and eight-direction controls for expanded selected groups. */
  resizeHandles?: boolean;
  /** Show size during a resize or while a single expanded group is selected. */
  resizeReadout?: boolean;
  portAnchors?: Readonly<{
    keyboardTargets?: boolean;
    guides?: boolean;
    snapBypass?: ZlozPortAnchorSnapBypassModifier;
  }>;
  edgeWaypoints?: NativeWaypointOptions<Message>;
  /** Enable on-canvas edge labels and optionally the selected-edge toolbar. */
  edgeEditing?: NativeEdgeEditing<Message>;
  /** Enable context actions from secondary click or the keyboard. */
  contextActions?: Omit<NativeContextMenuOptions<Message>, 'id'> &
    Readonly<{ measurements?: boolean }>;
  portLabel?: (context: GraphPortContext) => string | undefined;
  policy?: EditorPolicy;
  nodeNote?: (node: ZlozNode) => string;
  architectureNotation?: boolean;
  onToggleGroup?: (id: string) => Message;
  theme?: ZlozTheme;
  worldOverlay?: View.Content<Message> | null;
  pinchZoom?: boolean;
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
  const context = options.contextActions
    ? resolveContextMenu(
        editor,
        { measurements: options.contextActions.measurements !== false },
        policy?.canDelete,
        policy?.canResizeNode,
      )
    : undefined;
  const nodes = [
    ...groupsInPaintOrder(scene.nodes),
    ...scene.nodes.filter((node) => node.kind !== 'group'),
  ];
  const preview = resolveConnectionPreview(editor);
  const selection =
    editor.gesture.type === 'box-selection'
      ? resolveBoxSelection(editor, editor.gesture, scene.nodes, policy?.canSelectNode)
      : undefined;
  const selecting = new Set(
    options.selectionPreviewHighlights === false ? undefined : selection?.previewNodeIds,
  );
  const zoomArea =
    editor.gesture.type === 'zoom-area'
      ? {
          bounds: boxBounds(editor.gesture.origin, editor.gesture.point),
          viewport: editor.viewport,
        }
      : null;
  const doubleClickFactor = doubleClickZoomFactor(options.doubleClickZoom);
  const marker = `${id}-arrow`;
  const waypointPreview = options.edgeWaypoints ? resolveEdgeWaypointPreview(editor, policy) : null;
  const edgeViews = scene.edges.map((stored) => {
    const edge =
      waypointPreview?.type === 'allowed' && waypointPreview.edge.id === stored.id
        ? waypointPreview.edge
        : stored;
    const route = editor.routes.find((item) => item.id === edge.id);
    const geometry = resolveEdgeGeometry(editor.graph, edge, {
      route: route?.points,
      labelPosition: route?.label?.position,
      sourceGroup: scene.hiddenBy.get(edge.source.node),
      targetGroup: scene.hiddenBy.get(edge.target.node),
    });
    const relationship = options.architectureNotation
      ? resolveContextMapRelationship(editor.graph, edge)
      : null;
    const path = svg('path')
      .key(edge.id)
      .class('zloz-ui-edge')
      .attr('d', geometry.path)
      .attr('data-flow-edge', edge.id)
      .attr('data-selected', String(editor.selectedEdges.includes(edge.id)))
      .attr('data-zloz-context-map-edge', relationship?.edge.id)
      .attr(
        'marker-end',
        relationship && relationship.direction !== 'directed' ? undefined : `url(#${marker})`,
      )
      .children();
    const position = geometry.labelPosition;
    const selected = editor.selectedEdges.includes(edge.id);
    const selectionDisabledReason = options.edgeEditing
      ? (policy?.canSelectEdge?.(stored, editor.graph) ?? undefined)
      : undefined;
    const relationshipLabel =
      relationship && position ? contextMapLabel(h, relationship, position) : null;
    const label =
      options.edgeEditing && position
        ? edgeLabel(
            h,
            {
              edge,
              labelPosition: position,
              description: `${edge.source.node}:${edge.source.port} → ${edge.target.node}:${edge.target.port}`,
              selected,
              readOnly: editor.readOnly,
              selectionDisabledReason,
            },
            editor,
            options.edgeEditing,
            relationshipLabel,
          )
        : (relationshipLabel ??
          (edge.label && position
            ? h.span
                .key(`label:${edge.id}`)
                .class('zloz-ui-edge-label')
                .style({ left: `${position.x}px`, top: `${position.y}px` })
                .children(edge.label)
            : null));
    return { path, label, position, edge, selectionDisabledReason };
  });
  const waypointEdge = editor.selectedEdges.length === 1 ? editor.selectedEdges[0] : undefined;
  const waypoint =
    options.edgeWaypoints &&
    !editor.readOnly &&
    waypointEdge !== undefined &&
    scene.edges.some(({ id }) => id === waypointEdge)
      ? resolveEdgeWaypointControls(editor, waypointEdge, policy)
      : null;
  const reconnectPoints =
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
              return [{ edge, end, x: point.x + x, y: point.y + y }];
            }),
          )
      : [];
  const handles = reconnectPoints.map(({ edge, end, x, y }) =>
    svg('circle')
      .key(`reconnect:${edge.id}:${end}`)
      .class('zloz-ui-reconnect')
      .attr('data-flow-reconnect', edge.id)
      .attr('data-flow-edge-end', end)
      .attr('cx', String(x))
      .attr('cy', String(y))
      .attr('r', '9')
      .children(),
  );
  const toolbarEdge =
    options.edgeEditing?.toolbar &&
    waypointEdge !== undefined &&
    !editor.readOnly &&
    editor.gesture.type === 'idle' &&
    !editor.connection &&
    !editor.context &&
    !editor.edgeLabelDraft
      ? edgeViews.find(
          ({ edge, selectionDisabledReason }) =>
            edge.id === waypointEdge && selectionDisabledReason === undefined,
        )
      : undefined;
  return h.div
    .key(id)
    .id(`${id}-surface`)
    .class('zloz-ui-surface')
    .attr('role', 'region')
    .attr('aria-label', label)
    .attr('aria-describedby', descriptionId)
    .attr('tabindex', '0')
    .attr('data-flow-surface', id)
    .attr('data-flow-context-actions', String(options.contextActions !== undefined))
    .attr('data-flow-readonly', String(editor.readOnly))
    .attr('data-flow-connection-mode', editor.connectionMode ?? 'strict')
    .attr('data-flow-connection-drop-radius', String(dropRadius))
    .attr('data-flow-reconnection-drop-radius', String(dropRadius))
    .attr('data-flow-wheel-navigation', options.wheelNavigation ?? 'off')
    .attr('data-flow-double-click-zoom', doubleClickFactor?.toString())
    .attr('data-flow-space-to-pan', String(options.spaceToPan === true))
    .attr('data-flow-middle-button-pan', String(options.middleButtonPan === true))
    .attr('data-flow-auto-pan', String(options.autoPan === true))
    .attr('data-flow-stable-pointer-origin', String(options.stablePointerOrigin === true))
    .attr('data-flow-gesture', editor.gesture.type)
    .attr('data-flow-pinch-zoom', String(options.pinchZoom ?? true))
    .attr('data-flow-grid-snap', String(editor.snapToGrid))
    .attr('data-flow-grid-spacing', String(editor.gridSpacing))
    .attr(
      'data-flow-anchor-keyboard-targets',
      String(options.portAnchors?.keyboardTargets === true),
    )
    .attr('data-flow-port-anchor-snap-bypass', options.portAnchors?.snapBypass)
    .attr('data-flow-selection-mode', String(editor.selectionMode))
    .attr('data-flow-zoom-area-mode', String(Boolean(editor.zoomAreaMode)))
    .attr(
      'data-flow-fit-animation',
      editor.fitViewTransition.type === 'fitting' ? String(editor.fitViewTransition.id) : '',
    )
    .style(zlozThemeStyle(options.theme ?? {}))
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
          ...nodes.map((node) => nodeView(h, editor, options, node, selecting.has(node.id))),
          ...(options.worldOverlay
            ? [
                h.div
                  .key('world-overlay')
                  .attr('data-flow-world-overlay', '')
                  .style({ pointerEvents: 'none' })
                  .children(options.worldOverlay),
              ]
            : []),
          ...edgeViews.flatMap(({ label }) => (label ? [label] : [])),
          options.portAnchors?.guides ? anchorGuides<Message>(editor, nodes, policy) : null,
          ...(options.portAnchors
            ? anchorControls(h, editor, nodes, policy, options.portAnchors.keyboardTargets === true)
            : []),
          waypoint && options.edgeWaypoints
            ? waypointControls(h, waypoint, options.edgeWaypoints)
            : null,
          ...(handles.length > 0
            ? [
                svg('svg')
                  .key('reconnect')
                  .class('zloz-ui-handles')
                  .attr('aria-hidden', 'true')
                  .children(...handles),
              ]
            : []),
          selection
            ? gestureMarquee(
                h,
                'selection',
                selection.bounds,
                options.renderSelectionMarquee?.(
                  { ...selection, match: editor.boxSelectionMatch, viewport: editor.viewport },
                  h,
                ),
              )
            : null,
          zoomArea
            ? gestureMarquee(
                h,
                'zoom-area',
                zoomArea.bounds,
                options.renderZoomAreaMarquee?.(zoomArea, h),
              )
            : null,
        ),
      toolbarEdge?.position && options.edgeEditing
        ? edgeToolbar(
            h,
            editor,
            toolbarEdge.edge,
            toolbarEdge.position,
            reconnectPoints,
            policy,
            options.edgeEditing.onEdit,
          )
        : null,
      context && options.contextActions
        ? h.div
            .key(
              `context:${context.kind}:${context.kind === 'node' ? context.node.id : context.edge.id}`,
            )
            .class('zloz-ui-context-panel')
            .attr('role', 'group')
            .attr(
              'aria-label',
              context.kind === 'node' ? 'Node context actions' : 'Edge context actions',
            )
            .attr('data-flow-context-panel', '')
            .attr('data-flow-no-drag', '')
            .attr('tabindex', '-1')
            .style(contextPanelPlacement(context))
            .children(contextMenu(h, context, { ...options.contextActions, id }))
        : null,
      options.resizeHandles && options.resizeReadout !== false
        ? nodeResizeReadout(h, editor, nodes)
        : null,
    );
}

function gestureMarquee<Message>(
  h: Html.H<Message>,
  kind: 'selection' | 'zoom-area',
  bounds: ZlozZoomAreaMarqueeContext['bounds'],
  content: View.Content<Message> | null | undefined,
) {
  if (content === null) return null;
  return h.div
    .key(kind)
    .class(
      'zloz-ui-marquee',
      kind === 'selection' ? 'zloz-ui-selection' : '',
      content === undefined ? 'zloz-ui-marquee--default' : '',
    )
    .attr(`data-flow-${kind}-box`, '')
    .attr('aria-hidden', 'true')
    .style({
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.right - bounds.left}px`,
      height: `${bounds.bottom - bounds.top}px`,
    })
    .children(content);
}

function nodeView<Message>(
  h: Html.H<Message>,
  editor: EditorState,
  options: GraphSurfaceOptions<Message>,
  node: ZlozNode,
  selecting: boolean,
) {
  const note = options.nodeNote?.(node);
  const selected = editor.selectedNodes.includes(node.id);
  const architecture = options.architectureNotation ? node.architecture : undefined;
  const prefix = architecture && notationPrefix(architecture);
  const notation = architecture ? notationView(h, node, architecture) : null;
  const accent = notationStroke(architecture);
  const group = node.kind === 'group';
  const collapsed = group && editor.collapsedGroups.includes(node.id);
  const toggle = group ? options.onToggleGroup : undefined;
  const hasOutline = architecture ? !group : node.appearance !== undefined;
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Use the authored outline geometry.
  const outline = hasOutline ? nodeShapeGeometry(node) : null;
  const content = outline?.contentBounds;
  const svg = (tag: 'svg' | 'path') => new Html.Element<Message>(tag);
  return (
    h.div
      .key(node.id)
      .class('zloz-ui-node')
      .attr('data-flow-node', node.id)
      .attr('data-node-kind', node.kind)
      .attr('data-flow-group-collapsed', group ? String(collapsed) : undefined)
      .attr('data-notation', architecture?.family)
      .attr(prefix ? `data-${prefix}-${group ? 'group' : 'node'}` : 'data-node-id', node.id)
      // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Read the canonical authored geometry.
      .attr('data-node-outline', outline?.shape)
      .attr('data-selection-preview', selecting ? 'true' : undefined)
      .style({
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
        height: `${node.size.height}px`,
        '--zloz-ui-notation-accent': accent,
      })
      .children(
        outline
          ? svg('svg')
              .class('zloz-ui-node-outline')
              .attr('aria-hidden', 'true')
              .attr('viewBox', `0 0 ${node.size.width} ${node.size.height}`)
              .children(
                svg('path')
                  .attr('d', outline.outlinePath)
                  .attr('stroke-dasharray', notationDash(architecture, selecting))
                  .attr('vector-effect', 'non-scaling-stroke')
                  .attr(prefix ? `data-${prefix}-outline` : 'data-outline', ''),
                ...outline.decorationPaths.map((path) =>
                  svg('path')
                    .attr('d', path)
                    .attr('fill', 'none')
                    .attr(prefix ? `data-${prefix}-cap` : 'data-outline-decoration', ''),
                ),
              )
          : null,
        h.button
          .class('zloz-ui-node-title')
          .attr('type', 'button')
          .attr('data-flow-handle', node.id)
          .attr('aria-label', `Select ${node.label}`)
          .attr('aria-description', notation?.accessibleDescription)
          .attr('aria-pressed', String(selected))
          .style(
            architecture && content
              ? {
                  inset: `${content.y}px auto auto ${content.x}px`,
                  width: `${content.width}px`,
                  height: `${content.height}px`,
                }
              : {},
          )
          .children(notation?.content ?? node.label),
        toggle && !editor.readOnly
          ? h.button
              .key('collapse-toggle')
              .class('zloz-ui-collapse-toggle')
              .attr('type', 'button')
              .attr('data-flow-no-drag', '')
              .attr('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${node.label}`)
              .attr('aria-expanded', String(!collapsed))
              .disabled(editor.gesture.type !== 'idle')
              .on('click', toggle(node.id))
              .children(collapsed ? 'Expand' : 'Collapse')
          : null,
        ...(note ? [h.p.class('zloz-ui-node-note').children(note)] : []),
        ...(options.resizeHandles
          ? nodeResizeControls(h, node, editor, options.policy, options.descriptionId)
          : []),
        ...node.ports.map((port) => {
          const endpoint = { node: node.id, port: port.id };
          const point = portPosition(node, port.id);
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
            .style({
              left: `${point.x - node.position.x}px`,
              top: `${point.y - node.position.y}px`,
            })
            .children(label ?? '');
        }),
      )
  );
}

export { pngReview, svgReview } from './effect-ui-export-review';
export { zlozLightTheme, zlozDarkTheme } from './theme';
export { modellingPatchReview } from './effect-ui-patch-review';

export {
  historyChangeNavigatorV2,
  historyComparisonV2,
  historyGhostsV2,
  historyMinimap,
} from './effect-ui-history';

export { placementHost, placementPalette, placementPreview } from './effect-ui-placement';
