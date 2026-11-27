import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import type { ZlozConnectionGeometryPolicy, ZlozConnectionPreview } from './connection-preview';
import type { ZlozContextMapRelationship } from './context-map';
import type { ZlozEdgeGeometry, ZlozEdgeGeometryPolicy } from './edge-geometry';
import {
  connectionRenderContext,
  edgeHitWidth,
  type ZlozConnectionRenderContext,
  type ZlozEdgeAppearance,
  type ZlozEdgeRenderContext,
} from './edge-presentation';
import { contextMapConnector } from './effect-ui-context-map';
import type { ZlozEdge } from './types';

export type NativeEdgePresentation<M> = Readonly<{
  edgeGeometry?: ZlozEdgeGeometryPolicy | undefined;
  edgeAppearance?: (edge: ZlozEdge) => ZlozEdgeAppearance;
  /** Draw decoration or return null to hide it. The surface owns pointer selection. */
  renderEdge?: (context: ZlozEdgeRenderContext, h: Html.H<M>) => View.Content<M> | null | undefined;
  connectionGeometry?: ZlozConnectionGeometryPolicy | undefined;
  /** Draw the current preview, or use null to hide its artwork. */
  renderConnection?: (
    context: ZlozConnectionRenderContext,
    h: Html.H<M>,
  ) => View.Content<M> | null | undefined;
}>;

export function edgeStroke<M>(
  h: Html.H<M>,
  edge: ZlozEdge,
  geometry: ZlozEdgeGeometry,
  selected: boolean,
  markerEnd: string,
  relationship: ZlozContextMapRelationship | null,
  options: NativeEdgePresentation<M>,
) {
  const appearance = options.edgeAppearance?.(edge);
  const context = {
    ...geometry,
    edge,
    selected,
    stroke: selected
      ? 'var(--flow-selection, var(--blue, #2563eb))'
      : (appearance?.stroke ?? 'var(--flow-edge, var(--muted, #64748b))'),
    strokeWidth: String(appearance?.strokeWidth ?? 'var(--flow-edge-width, 3)'),
    dashArray: appearance?.dashArray ?? 'none',
    markerEnd,
  };
  const path = () => new Html.Element<M>('path');
  const artwork = options.renderEdge?.(context, h);
  const decoration =
    artwork !== undefined
      ? artwork
      : relationship
        ? contextMapConnector(h, context, relationship)
        : path()
            .attr('data-flow-edge-stroke', edge.id)
            .attr('d', geometry.path)
            .attr('fill', 'none')
            .attr('stroke', context.stroke)
            .attr('stroke-width', context.strokeWidth)
            .attr('stroke-dasharray', context.dashArray === 'none' ? undefined : context.dashArray)
            .attr('marker-end', markerEnd || undefined)
            .children();
  return new Html.Element<M>('g')
    .key(`edge:${edge.id}`)
    .children(
      new Html.Element<M>('g').style({ pointerEvents: 'none' }).children(decoration),
      path()
        .attr('data-flow-edge', edge.id)
        .attr('data-selected', String(selected))
        .attr('d', geometry.path)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', edgeHitWidth(appearance?.hitWidth))
        .style({ pointerEvents: 'stroke', cursor: 'pointer' })
        .children(),
    );
}

export function connectionStroke<M>(
  h: Html.H<M>,
  preview: ZlozConnectionPreview | undefined,
  options: NativeEdgePresentation<M>,
) {
  if (!preview) return null;
  const context = connectionRenderContext(preview);
  const artwork = options.renderConnection?.(context, h);
  return new Html.Element<M>('g')
    .key('connection-preview')
    .attr('data-flow-connection-preview', '')
    .attr('data-flow-connection-state', preview.feedback.type)
    .attr('aria-hidden', 'true')
    .style({ pointerEvents: 'none' })
    .children(
      artwork === undefined
        ? new Html.Element<M>('path')
            .class('zloz-ui-preview')
            .attr('data-feedback', preview.feedback.type)
            .attr('d', context.path)
            .attr('fill', 'none')
            .attr('stroke', context.stroke)
            .attr('stroke-width', context.strokeWidth)
            .attr('stroke-dasharray', context.dashArray)
            .children()
        : artwork,
    );
}
