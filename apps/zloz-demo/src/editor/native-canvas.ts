import { Html } from '@effect/ui/html';
import type {
  EditorEvent,
  EditorPolicy,
  ZlozHistoryComparison,
  ZlozHistoryGhostVisibility,
  ZlozPlacementControlsContext,
  ZlozNode,
} from '@opsydyn/foldkit-zloz';
import {
  graphSurface,
  historyGhosts,
  placementPreview,
  type GraphSurfaceOptions,
  type ZlozAlignmentGuideContext,
  type ZlozBackgroundRenderContext,
  type NativeSocketContext,
  type ZlozResizeReadoutContext,
  type ZlozPortAnchorGuideContext,
} from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { Message } from './message';
import type { Model } from './model';
import { architectureBadgeDesign } from './native-edge-label';
import { orbitArtwork } from './native-orbit';
import { architectureNativePanel } from './native-panel';
import { raisedConnection, raisedEdge, releaseGatePosition } from './presentation';
import { workbenchThemes } from './theme';
import { workbenchArchitectureBadge, workbenchHotspotStatus } from './workbench-notation';

type Canvas = Readonly<{
  model: Model;
  policy: EditorPolicy;
  placement: ZlozPlacementControlsContext;
  scheme: keyof typeof workbenchThemes;
  measurements: boolean;
  alignmentGuides: boolean;
  edgeToolbar: boolean;
  history: Readonly<{
    comparison: ZlozHistoryComparison | null;
    ghosts: ZlozHistoryGhostVisibility;
  }>;
}>;

function resizeDimensions<M>(context: ZlozResizeReadoutContext, h: Html.H<M>) {
  const dimension = (name: string, value: string) =>
    h.span.class('architecture-resize-dimension').children(name, h.strong.children(value));
  return h.div
    .class('labeled-resize-readout')
    .attr('data-resize-phase', context.phase)
    .children(
      h.strong.children(context.node.label),
      dimension('Width', context.widthText),
      dimension('Height', context.heightText),
    );
}

function anchorGuide<M>({ target, start, end, active, viewport }: ZlozPortAnchorGuideContext) {
  const svg = (tag: string) => new Html.Element<M>(tag);
  const stroke = 'var(--flow-node-color, #172033)';
  const extent = 4 / viewport.zoom;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    svg('line')
      .attr('x1', String(x1))
      .attr('y1', String(y1))
      .attr('x2', String(x2))
      .attr('y2', String(y2))
      .attr('stroke', stroke);
  const targetMark =
    target.type === 'edge'
      ? line(start.x, start.y, end.x, end.y)
      : svg('circle')
          .attr('cx', String(start.x))
          .attr('cy', String(start.y))
          .attr('r', String((active ? 6 : 4) / viewport.zoom))
          .attr('stroke', stroke);
  const points = target.type === 'edge' ? [start, end] : [start];
  return svg('g')
    .class('workbench-snap-guide')
    .children(
      targetMark
        .attr('stroke-width', String((active ? 3 : 2) / viewport.zoom))
        .attr('stroke-dasharray', active ? 'none' : '3 3')
        .children(),
      ...points.flatMap(({ x, y }) => [
        line(x - extent, y, x + extent, y).children(),
        line(x, y - extent, x, y + extent).children(),
      ]),
    );
}

function cardControls<M>(
  h: Html.H<M>,
  node: ZlozNode,
  resizeDisabled: boolean,
  measurements: boolean,
  observe: (event: EditorEvent) => M,
) {
  const minWidth =
    node.resizeLimits?.minWidth ??
    Math.min(140, node.size.width, node.resizeLimits?.maxWidth ?? Infinity);
  const maxWidth =
    node.resizeLimits?.maxWidth ?? Math.max(320, node.size.width, node.resizeLimits?.minWidth ?? 0);
  return h.div.class('architecture-native-card-controls').children(
    h.input
      .attr('type', 'text')
      .attr('aria-label', `Label for ${node.id}`)
      .value(node.label)
      .on('input', ({ value: label }) => observe({ type: 'NodeLabelChanged', id: node.id, label })),
    measurements
      ? h.label.children(
          'Width',
          h.input
            .attr('type', 'range')
            .attr('aria-label', `Width for ${node.label}`)
            .attr('min', String(minWidth))
            .attr('max', String(maxWidth))
            .attr('step', '10')
            .value(String(node.size.width))
            .disabled(resizeDisabled)
            .on('change', ({ value }) =>
              observe({ type: 'NodeWidthChanged', id: node.id, width: Number(value) }),
            ),
        )
      : null,
  );
}

function releaseGate<M>(
  h: Html.H<M>,
  nodes: readonly ZlozNode[],
  observe: (event: EditorEvent) => M,
) {
  const position = releaseGatePosition(nodes);
  if (!position) return undefined;
  return h.div
    .class('architecture-release-gate')
    .style({ left: `${position.x}px`, top: `${position.y}px` })
    .children(
      h.span.attr('aria-hidden', 'true').attr('data-release-gate-leader', ''),
      h.button
        .attr('type', 'button')
        .attr('aria-label', 'Inspect Review')
        .attr('data-flow-no-drag', '')
        .on('click', observe({ type: 'NodeSelected', id: 'review', additive: false }))
        .children(h.span.children('RELEASE GATE'), h.strong.children('Review required')),
    );
}

function graphPaper<M>({ spacing, viewport }: ZlozBackgroundRenderContext, h: Html.H<M>) {
  const pitch = spacing * viewport.zoom;
  const grid = (color: string, size: number) => ({
    position: 'absolute',
    inset: '0',
    backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
  });
  return h.div
    .attr('data-custom-flow-grid', 'graph-paper')
    .style(grid('var(--flow-grid-line, #94a3b833)', pitch))
    .children(h.div.style(grid('var(--flow-grid-dot, #64748b66)', pitch * 5)));
}

function endpointGuide<M>(context: ZlozAlignmentGuideContext) {
  const { start, end, phase, viewport } = context;
  const svg = (tag: 'g' | 'line' | 'circle') => new Html.Element<M>(tag);
  const color = phase === 'drag' ? 'var(--flow-valid-target)' : 'light-dark(#be185d, #f5a6d0)';
  return svg('g')
    .class('endpoint-alignment-guide')
    .attr('data-guide-phase', phase)
    .children(
      svg('line')
        .attr('x1', String(start.x))
        .attr('y1', String(start.y))
        .attr('x2', String(end.x))
        .attr('y2', String(end.y))
        .attr('stroke', color)
        .attr('stroke-width', '2')
        .attr('vector-effect', 'non-scaling-stroke'),
      ...[start, end].map((point) =>
        svg('circle')
          .attr('cx', String(point.x))
          .attr('cy', String(point.y))
          .attr('r', String(4 / viewport.zoom))
          .attr('fill', color),
      ),
    );
}

function workbenchSocket<M>(
  { node, port, target, active, disabledReason }: NativeSocketContext,
  h: Html.H<M>,
  showReason: boolean,
) {
  const output = port.kind === 'output';
  const reasonId =
    disabledReason && showReason
      ? `flow-demo-port-reason-${encodeURIComponent(JSON.stringify([node.id, port.id]))}`
      : undefined;
  const svg = (tag: 'svg' | 'path') => new Html.Element<M>(tag);
  return {
    className: 'architecture-native-socket',
    describedBy: reasonId,
    style: {
      borderStyle: disabledReason ? 'dashed' : 'solid',
      background:
        target || active
          ? 'var(--flow-valid-target, #0f766e)'
          : 'var(--flow-node-background, #fff)',
      color:
        target || active ? 'var(--flow-control-color, #fff)' : 'var(--flow-node-color, #172033)',
      opacity: disabledReason && !showReason ? '0.5' : '1',
    },
    content: h.span.children(
      svg('svg')
        .attr('viewBox', '0 0 20 20')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('aria-hidden', 'true')
        .children(
          svg('path')
            .attr('d', output ? 'M4,4 L12,10 L4,16 M12,10 H17' : 'M16,4 L8,10 L16,16 M8,10 H3')
            .attr('fill', 'none')
            .attr('stroke', 'currentColor')
            .attr('stroke-width', '2'),
        ),
      reasonId
        ? h.span.id(reasonId).class('architecture-native-socket-reason').children(disabledReason)
        : null,
    ),
  };
}

export const nativeArchitectureCanvas = architectureNativePanel<Canvas>(
  'ArchitectureNativeCanvas',
  Schema.is(Message.cases.ObservedModelInput),
  (
    h,
    { model, policy, placement, scheme, measurements, alignmentGuides, edgeToolbar, history },
    request,
  ) => {
    const state = model.editor;
    const observe = (message: EditorEvent) =>
      request(
        Message.ObservedModelInput({
          modelId: model.modelIdentity.id,
          epoch: model.modelEpoch,
          message,
        }),
      );
    const orbit = model.historyReview === null && model.nodeDesign === 'orbits';
    const ddd = model.nodeDesign === 'ddd' || model.nodeDesign === 'event-storming';
    const compactToolbar = model.nodeToolbarDesign === 'compact';
    const options: GraphSurfaceOptions<ReturnType<typeof observe>> = {
      id: 'flow-demo',
      label: 'Workflow editor',
      descriptionId: 'flow-demo-help',
      onInput: observe,
      policy,
      wheelNavigation: model.wheelNavigation,
      doubleClickZoom: model.doubleClickZoom,
      spaceToPan: model.spaceToPan,
      middleButtonPan: model.middleButtonPan,
      autoPan: true,
      stablePointerOrigin: true,
      pinchZoom: true,
      theme: workbenchThemes[scheme],
      viewportCulling: model.viewportCulling,
      background:
        model.background === 'custom'
          ? { type: 'custom', render: graphPaper }
          : { type: model.background },
      alignmentGuides,
      renderAlignmentGuide:
        model.alignmentGuideDesign === 'endpoints'
          ? (context) => endpointGuide<ReturnType<typeof observe>>(context)
          : undefined,
      renderSelectionMarquee:
        model.selectionMarqueeDesign === 'hatched'
          ? (context, builder) =>
              builder.div
                .class('architecture-native-hatched')
                .style({
                  borderWidth: `${2 / context.viewport.zoom}px`,
                })
                .children()
          : undefined,
      renderZoomAreaMarquee: ({ viewport }, builder) =>
        builder.div
          .class('workbench-zoom-area', 'architecture-native-zoom-area')
          .style({ borderWidth: `${2 / viewport.zoom}px` })
          .children(),
      dropRadius: model.snapConnections ? 32 : 0,
      reconnectionDropRadius:
        model.reconnectionSnap === 'match'
          ? undefined
          : model.reconnectionSnap === 'exact'
            ? 0
            : 48,
      reconnect: true,
      resizeHandles: true,
      resizeReadout: measurements,
      renderResizeReadout: model.resizeReadoutDesign === 'labeled' ? resizeDimensions : undefined,
      contextMapPresentation: model.contextMapPresentation,
      architectureNotation: model.historyReview !== null || ddd || model.nodeDesign === 'c4',
      notationLabels: { badge: workbenchArchitectureBadge, hotspotStatus: workbenchHotspotStatus },
      contextActions: { onEvent: observe, design: model.contextMenuDesign, measurements },
      nodeContextAction: (node) =>
        observe({
          type: 'ContextOpened',
          context: {
            kind: 'node',
            id: node.id,
            point: {
              x: state.viewport.x + (node.position.x + node.size.width) * state.viewport.zoom - 36,
              y: state.viewport.y + node.position.y * state.viewport.zoom + 44,
            },
          },
        }),
      onToggleGroup: (id) => observe({ type: 'GroupCollapseToggled', id }),
      nodeToolbar:
        model.nodeToolbarDesign === 'off'
          ? undefined
          : {
              compact: compactToolbar,
              placement: compactToolbar ? 'bottom' : undefined,
              offset: compactToolbar ? 12 : 8,
              onEvent: observe,
            },
      portLabels: model.portLabels && { offset: 22 },
      renderPortLabel: ({ label }, builder) =>
        builder.span.class('architecture-native-port-label').children(label),
      renderPort: (context, builder) => {
        if (model.customPorts) return workbenchSocket(context, builder, model.socketReasonBadges);
        if (!orbit) return undefined;
        const output = context.port.kind === 'output';
        return {
          className: 'architecture-native-orbit-socket',
          style: { background: output ? '#fb923c' : '#7dd3fc' },
          content: output ? '→' : '←',
        };
      },
      portAnchors: model.portAnchorHandles
        ? {
            keyboardTargets: model.keyboardPortTargets,
            snapBypass: model.portAnchorSnapBypass ? 'Alt' : undefined,
            guides: alignmentGuides && model.portAnchorGuides,
            renderGuide: model.customPortAnchorGuides ? anchorGuide : undefined,
            renderHandle: ({ snappedCorner, snappedMidpoint }) => {
              if (!snappedCorner && !snappedMidpoint) return undefined;
              return {
                className: snappedCorner ? 'workbench-corner-handle' : 'workbench-midpoint-handle',
                content: snappedCorner
                  ? `◆ Pinned ${snappedCorner}`
                  : `⊙ Centered ${snappedMidpoint}`,
                style: { width: 'max-content', padding: '4px 8px', whiteSpace: 'nowrap' },
              };
            },
          }
        : undefined,
      edgeWaypoints:
        model.waypointDesign === 'off'
          ? undefined
          : {
              onEdit: observe,
              measurements,
              instructions: !model.minimalMode,
              presentation:
                model.waypointDesign === 'custom'
                  ? {
                      className: 'architecture-routing-studio',
                      heading: 'Routing studio',
                      marker: '◆',
                    }
                  : undefined,
            },
      edgeGeometry: model.edgeDesign === 'raised' ? raisedEdge : undefined,
      edgeAppearance: (edge) =>
        edge.data === 'dashed' ? { dashArray: '9 5', strokeWidth: 4 } : {},
      connectionGeometry: model.edgeDesign === 'raised' ? raisedConnection : undefined,
      renderConnection: (context) => {
        // oxlint-disable-next-line linteffect/no-return-null -- The renderer contract uses null to suppress preview artwork.
        if (model.connectionDesign === 'hidden') return null;
        if (model.connectionDesign !== 'ribbon') return undefined;
        const pointer = context.movingEnd === 'source' ? context.source : context.target;
        const svg = (tag: 'g' | 'path' | 'circle') =>
          new Html.Element<ReturnType<typeof observe>>(tag);
        return svg('g')
          .attr('data-preview-design', 'ribbon')
          .children(
            svg('path')
              .attr('d', context.path)
              .attr('fill', 'none')
              .attr('stroke', context.stroke)
              .attr('stroke-width', '10')
              .attr('opacity', '.25'),
            svg('path')
              .attr('d', context.path)
              .attr('fill', 'none')
              .attr('stroke', context.stroke)
              .attr('stroke-width', '3')
              .attr('stroke-linecap', 'round'),
            svg('circle')
              .attr('cx', String(pointer.x))
              .attr('cy', String(pointer.y))
              .attr('r', '6')
              .attr('fill', context.stroke),
          );
      },
      edgeEditing: {
        toolbar: edgeToolbar,
        toolbarDesign: model.edgeToolbarDesign,
        pathLabel: 'Selected edge path style',
        labelDesign: model.edgeLabelDesign === 'badge' ? architectureBadgeDesign : undefined,
        onEdit: observe,
        reconnection: { onEvent: observe },
      },
      renderWorldOverlay: (nodes, builder) => {
        if (model.historyReview)
          return history.comparison
            ? historyGhosts<ReturnType<typeof observe>>(history.comparison, history.ghosts)
            : undefined;
        const preview = placementPreview(builder, placement);
        const gate = model.showWorldAnnotation ? releaseGate(builder, nodes, observe) : undefined;
        return preview || gate ? builder.div.children(preview, gate) : undefined;
      },
      renderNodeShell: ({ node, selected, selectionPreview, readOnly }, builder) => {
        if (orbit)
          return {
            className: 'architecture-native-orbit',
            outline: false,
            title: {
              style: {
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                color: '#fff',
              },
              content: orbitArtwork(builder, {
                id: node.id,
                label: node.label,
                selected,
                preview: selectionPreview,
              }),
            },
          };
        if (readOnly || model.minimalMode || model.nodeDesign !== 'cards') return undefined;
        return {
          body: cardControls(
            builder,
            node,
            policy.canResizeNode?.(node, state.graph) != null,
            measurements,
            observe,
          ),
        };
      },
      renderGroupShell: ({ node, collapsed }, builder) =>
        orbit
          ? {
              className: 'architecture-native-orbit-group',
              title: {
                content: orbitArtwork(builder, { id: node.id, label: node.label, group: true }),
              },
              style: {
                borderStyle: 'dotted',
                background: collapsed ? 'light-dark(#dbeafe, #253b58)' : 'rgb(56 189 248 / 0.05)',
              },
            }
          : undefined,
    };
    return graphSurface<ReturnType<typeof observe>>(h, state, options);
  },
);
