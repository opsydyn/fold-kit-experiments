import { Mount, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import type { BrowserInput } from './browser-input';
import {
  doubleClickZoomFactor,
  type ZlozSelectionMarqueeContext,
  type ZlozZoomAreaMarqueeContext,
} from './canvas-gestures';
import { resolveConnectionPreview } from './connection-preview';
import { resolveContextMapRelationship } from './context-map';
import { contextPanelPlacement, resolveContextMenu } from './context-menu-context';
import { resolveEdgeGeometry } from './edge-geometry';
import { connectionDropRadii } from './edge-presentation';
import {
  nativeAlignmentGuides,
  nativeBackground,
  type NativeAlignmentGuide,
  type NativeBackground,
} from './effect-ui-canvas-decoration';
import { contextMapLabel } from './effect-ui-context-map';
import { contextMenu, type NativeContextMenuOptions } from './effect-ui-context-menu';
import { edgeLabel, edgeToolbar, type NativeEdgeEditing } from './effect-ui-edge-editing';
import { connectionStroke, edgeStroke, type NativeEdgePresentation } from './effect-ui-edges';
import {
  anchorControls,
  anchorGuides,
  waypointControls,
  type NativePortAnchors,
  type NativeWaypointOptions,
} from './effect-ui-geometry-controls';
import { surfaceInput } from './effect-ui-input';
import { nodeToolbar, type NativeNodeToolbar } from './effect-ui-node-toolbar';
import { nodeView, type NativeNodeOptions } from './effect-ui-nodes';
import { portLabels } from './effect-ui-ports';
import { nodeResizeReadout, type NativeResizeReadout } from './effect-ui-resize';
import { boxBounds, portBoundaryPosition, portPosition } from './geometry';
import { groupsInPaintOrder, presentVisibleGraph } from './group-presentation';
import { resolveBoxSelection } from './selection-preview';
import { zlozThemeStyle, type ZlozTheme } from './theme';
import type { EditorState, ZlozNode } from './types';
import { viewportItems, type ZlozViewportCulling } from './viewport-culling';
import { resolveEdgeWaypointControls, waypointLabelPosition } from './waypoint-controls';
import { resolveEdgeWaypointPreview } from './waypoint-interaction';

export { canvasHelpContext, canvasStatusContext } from './canvas-accessibility';
export type { ZlozCanvasHelpContext, ZlozCanvasStatusContext } from './canvas-accessibility';
export { resolveConnectionList, toolbarControl } from './connections';
export type { ZlozConnectionsContext } from './connections';
export { visuallyHidden } from './diagnostics';
export { presentVisibleGraph } from './group-presentation';
export { BrowserInput } from './browser-input';
export type { NativeAlignmentGuide, NativeBackground } from './effect-ui-canvas-decoration';
export type { ZlozAlignmentGuideContext, ZlozBackgroundRenderContext } from './canvas-decoration';
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
export { edgeToolbarContent, type NativeEdgeToolbarOptions } from './effect-ui-edge-toolbar';
export type { ZlozEdgeToolbarContext } from './edge-toolbar';
export {
  edgeLabelControls,
  type EdgeLabelDesign,
  type NativeEdgeEditing,
} from './effect-ui-edge-editing';
export type { NativeEdgePresentation } from './effect-ui-edges';
export type {
  ZlozConnectionRenderContext,
  ZlozEdgeAppearance,
  ZlozEdgeRenderContext,
} from './edge-presentation';
export type { ZlozEdgeLabelContext, ZlozEdgeLabelEditorContext } from './edge-label';
export { eventStormingRelationshipControls } from './effect-ui-relationship-controls';
export { viewportControl } from './effect-ui-viewport-control';
export {
  groupClipboardV3,
  groupInspectorV3,
  groupSurfaceV3,
  type GroupSurfaceOptionsV3,
} from './effect-ui-group';

export type {
  NativePortControl,
  NativeSocketContext,
  NativePortLabelRenderer,
} from './effect-ui-ports';
export type { NativePortAnchors } from './effect-ui-geometry-controls';
export type { ZlozPortLabelContext, ZlozPortLabelOptions } from './port-label-presentation';
export type { ZlozPortAnchorHandleContext } from './port-anchor-presentation';
export type { ZlozPortAnchorGuideContext } from './port-anchor-guides';
export type { NativeNodeShell, NativeNodeShellContext } from './effect-ui-nodes';
export type { NativeNodeToolbar } from './effect-ui-node-toolbar';
export type { ZlozViewportCulling } from './viewport-culling';

export type GraphSurfaceOptions<Message> = NativeNodeOptions<Message> &
  NativeEdgePresentation<Message> &
  Readonly<{
    id: string;
    label: string;
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
    renderSelectionMarquee?:
      | ((
          context: ZlozSelectionMarqueeContext,
          h: Html.H<Message>,
        ) => View.Content<Message> | null | undefined)
      | undefined;
    /** Customize the decorative camera box. Undefined uses the default and null hides it. */
    renderZoomAreaMarquee?: (
      context: ZlozZoomAreaMarqueeContext,
      h: Html.H<Message>,
    ) => View.Content<Message> | null | undefined;
    dropRadius?: number;
    /** Defaults to the creation radius. Zero requires an exact reconnection target. */
    reconnectionDropRadius?: number | undefined;
    reconnect?: boolean;
    /** Show size during a resize or while a single expanded group is selected. */
    resizeReadout?: boolean;
    renderResizeReadout?: NativeResizeReadout<Message> | undefined;
    /** Defaults to the architecture notation setting. */
    contextMapPresentation?: boolean;
    portAnchors?: NativePortAnchors<Message> | undefined;
    edgeWaypoints?: NativeWaypointOptions<Message> | undefined;
    nodeToolbar?: NativeNodeToolbar<Message> | undefined;
    /** Enable on-canvas edge labels and optionally the selected-edge toolbar. */
    edgeEditing?: NativeEdgeEditing<Message>;
    /** Enable context actions from secondary click or the keyboard. */
    contextActions?: Omit<NativeContextMenuOptions<Message>, 'id'> &
      Readonly<{ measurements?: boolean }>;
    theme?: ZlozTheme;
    worldOverlay?: View.Content<Message> | null;
    /** Render a world layer against the same visible scene used for drawing and input. */
    renderWorldOverlay?: (
      visibleNodes: readonly ZlozNode[],
      h: Html.H<Message>,
    ) => View.Content<Message> | null | undefined;
    pinchZoom?: boolean;
    viewportCulling?: ZlozViewportCulling;
    background?: NativeBackground<Message>;
    alignmentGuides?: boolean;
    renderAlignmentGuide?: NativeAlignmentGuide<Message> | undefined;
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
  const { id, label, descriptionId, onInput, policy } = options;
  const { connectionDropRadius, reconnectionDropRadius } = connectionDropRadii(
    options.dropRadius,
    options.reconnectionDropRadius,
  );
  const svg = (tag: string) => new Html.Element<Message>(tag);
  const scene = presentVisibleGraph(editor);
  const worldOverlay = options.renderWorldOverlay
    ? options.renderWorldOverlay(scene.nodes, h)
    : options.worldOverlay;
  const context = options.contextActions
    ? resolveContextMenu(
        editor,
        { measurements: options.contextActions.measurements !== false },
        policy?.canDelete,
        policy?.canResizeNode,
      )
    : undefined;
  const routes = new Map(editor.routes.map((route) => [route.id, route]));
  const canvas = viewportItems(
    editor,
    scene,
    routes,
    Boolean(options.edgeGeometry || options.renderEdge || options.edgeEditing?.renderLabel),
    options.viewportCulling,
  );
  const nodes = [
    ...groupsInPaintOrder(canvas.nodes),
    ...canvas.nodes.filter((node) => node.kind !== 'group'),
  ];
  const preview = resolveConnectionPreview(editor, options.connectionGeometry);
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
  const waypointEdge = editor.selectedEdges.length === 1 ? editor.selectedEdges[0] : undefined;
  const edgeViews = canvas.edges.map((stored) => {
    const edge =
      waypointPreview?.type === 'allowed' && waypointPreview.edge.id === stored.id
        ? waypointPreview.edge
        : stored;
    const route = routes.get(edge.id);
    const geometry = resolveEdgeGeometry(editor.graph, edge, {
      policy: options.edgeGeometry,
      route: route?.points,
      labelPosition: route?.label?.position,
      sourceGroup: scene.hiddenBy.get(edge.source.node),
      targetGroup: scene.hiddenBy.get(edge.target.node),
    });
    const relationship =
      (options.contextMapPresentation ?? options.architectureNotation)
        ? resolveContextMapRelationship(editor.graph, edge)
        : null;
    const position = geometry.labelPosition;
    const selected = editor.selectedEdges.includes(edge.id);
    const path = edgeStroke(
      h,
      edge,
      geometry,
      selected,
      relationship && relationship.direction !== 'directed' ? '' : `url(#${marker})`,
      relationship?.edge.id,
      options,
    );
    const selectionDisabledReason = options.edgeEditing
      ? (policy?.canSelectEdge?.(stored, editor.graph) ?? undefined)
      : undefined;
    const displayedLabel =
      position &&
      options.edgeWaypoints &&
      !editor.readOnly &&
      waypointEdge === edge.id &&
      !scene.hiddenBy.has(edge.source.node) &&
      !scene.hiddenBy.has(edge.target.node)
        ? waypointLabelPosition(edge, position, editor.viewport.zoom)
        : position;
    const relationshipLabel =
      relationship && displayedLabel ? contextMapLabel(h, relationship, displayedLabel) : null;
    const label =
      options.edgeEditing && displayedLabel
        ? edgeLabel(
            h,
            {
              edge,
              labelPosition: displayedLabel,
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
          (edge.label && displayedLabel
            ? h.span
                .key(`label:${edge.id}`)
                .class('zloz-ui-edge-label')
                .style({ left: `${displayedLabel.x}px`, top: `${displayedLabel.y}px` })
                .children(edge.label)
            : null));
    return { path, label, position, edge, selectionDisabledReason };
  });
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
    .attr('data-flow-native-background', options.background?.type)
    .attr('data-flow-context-actions', String(options.contextActions !== undefined))
    .attr('data-flow-readonly', String(editor.readOnly))
    .attr('data-flow-connection-mode', editor.connectionMode ?? 'strict')
    .attr('data-flow-connection-drop-radius', String(connectionDropRadius))
    .attr('data-flow-reconnection-drop-radius', String(reconnectionDropRadius))
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
      options.background ? nativeBackground(h, editor, id, options.background) : null,
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
              ...(options.alignmentGuides
                ? nativeAlignmentGuides(h, editor, options.renderAlignmentGuide)
                : []),
              connectionStroke(h, preview, options),
            ),
          ...nodes.map((node) => nodeView(h, editor, options, node, selecting.has(node.id))),
          ...(worldOverlay
            ? [
                h.div
                  .key('world-overlay')
                  .attr('data-flow-world-overlay', '')
                  .style({ pointerEvents: 'none' })
                  .children(worldOverlay),
              ]
            : []),
          ...edgeViews.flatMap(({ label }) => (label ? [label] : [])),
          options.portAnchors?.guides
            ? anchorGuides(h, editor, nodes, policy, options.portAnchors.renderGuide)
            : null,
          ...portLabels(h, nodes, options),
          ...(options.portAnchors
            ? anchorControls(h, editor, nodes, policy, options.portAnchors)
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
      options.nodeToolbar ? nodeToolbar(h, editor, nodes, policy, options.nodeToolbar) : null,
      toolbarEdge?.position && options.edgeEditing
        ? edgeToolbar(
            h,
            id,
            editor,
            toolbarEdge.edge,
            toolbarEdge.position,
            reconnectPoints,
            policy,
            options.edgeEditing,
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
        ? nodeResizeReadout(h, editor, nodes, options.renderResizeReadout)
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

export { pngReview, svgReview } from './effect-ui-export-review';
export { zlozLightTheme, zlozDarkTheme } from './theme';
export { modellingPatchReview } from './effect-ui-patch-review';

export {
  historyChangeNavigatorV2,
  historyComparisonV2,
  historyGhosts,
  historyGhostsV2,
  historyMinimap,
} from './effect-ui-history';

export { placementHost, placementPalette, placementPreview } from './effect-ui-placement';

export { groupHeaderMeasurementProbe, labelMeasurementProbe } from './effect-ui-measurement';

export type { ZlozResizeReadoutContext } from './resize-readout';
