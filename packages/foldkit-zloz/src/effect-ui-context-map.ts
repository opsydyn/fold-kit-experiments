import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import type {
  ZlozContextMapBadge,
  ZlozContextMapParticipant,
  ZlozContextMapRelationship,
} from './context-map';
import type { ZlozEdgeRenderContext } from './edge-presentation';
import type { Point } from './types';

type Slot<M> = View.Content<M> | null | undefined;
type Part<M> = (relation: ZlozContextMapRelationship, h: Html.H<M>) => Slot<M>;
type ParticipantPart<M> = (
  participant: ZlozContextMapParticipant,
  relation: ZlozContextMapRelationship,
  h: Html.H<M>,
) => Slot<M>;

export type ZlozContextMapConnectorOptions<M> = Readonly<{
  markerEnd?: string | null;
  renderPath?: (
    context: ZlozEdgeRenderContext,
    relationship: ZlozContextMapRelationship,
    h: Html.H<M>,
  ) => Slot<M>;
}>;

export function contextMapConnector<M>(
  h: Html.H<M>,
  context: ZlozEdgeRenderContext,
  relationship: ZlozContextMapRelationship,
  options: ZlozContextMapConnectorOptions<M> = {},
) {
  const custom = options.renderPath?.(context, relationship, h);
  if (custom !== undefined) return custom;
  const marker =
    options.markerEnd === undefined
      ? relationship.direction === 'directed'
        ? context.markerEnd
        : null
      : options.markerEnd;
  return new Html.Element<M>('path')
    .attr('data-flow-edge-stroke', context.edge.id)
    .attr('data-zloz-context-map-edge', relationship.edge.id)
    .attr('d', context.path)
    .attr('fill', 'none')
    .attr('stroke', context.stroke)
    .attr('stroke-width', context.strokeWidth)
    .attr('stroke-dasharray', context.dashArray === 'none' ? undefined : context.dashArray)
    .attr('marker-end', marker || undefined)
    .children();
}

export type ZlozContextMapParticipantOptions<M> = Readonly<{
  renderName?: (participant: ZlozContextMapParticipant, h: Html.H<M>) => Slot<M>;
  renderBadge?: (badge: ZlozContextMapBadge, h: Html.H<M>) => Slot<M>;
}>;

export function contextMapParticipant<M>(
  h: Html.H<M>,
  participant: ZlozContextMapParticipant,
  options: ZlozContextMapParticipantOptions<M> = {},
) {
  const name = options.renderName?.(participant, h);
  return h.span.class('zloz-ui-context-participant').children(
    name === undefined ? participant.name : name,
    ...participant.badges.map((badge) => {
      const custom = options.renderBadge?.(badge, h);
      return custom === undefined
        ? h.span
            .key(badge.text)
            .class('zloz-ui-context-badge')
            .attr('title', badge.description)
            .attr('aria-label', badge.description)
            .children(badge.text)
        : custom;
    }),
  );
}

export type ZlozContextMapLabelParts<M> = Readonly<{
  pattern: View.Content<M> | null;
  name: View.Content<M> | null;
  source: View.Content<M> | null;
  target: View.Content<M> | null;
  reason: View.Content<M> | null;
}>;
export type ZlozContextMapLabelOptions<M> = Readonly<{
  renderPattern?: Part<M>;
  renderName?: Part<M>;
  renderSource?: ParticipantPart<M>;
  renderTarget?: ParticipantPart<M>;
  renderReason?: Part<M>;
  renderLayout?: (
    parts: ZlozContextMapLabelParts<M>,
    relationship: ZlozContextMapRelationship,
    h: Html.H<M>,
  ) => View.Input<M>;
}>;

function describeParticipant(participant: ZlozContextMapParticipant): string {
  return [participant.name, ...participant.badges.map((badge) => badge.description)].join(', ');
}

/** Decoration at a world-space position or inside an existing label frame. */
export function contextMapLabel<M>(
  h: Html.H<M>,
  relationship: ZlozContextMapRelationship,
  position: Point | undefined,
  options: ZlozContextMapLabelOptions<M> = {},
  action?: Readonly<{ edit: () => M; reason?: string | undefined }>,
) {
  const { edge, source, target, pattern, reason } = relationship;
  const patternContent = options.renderPattern?.(relationship, h);
  const nameContent = options.renderName?.(relationship, h);
  const sourceContent = options.renderSource?.(source, relationship, h);
  const targetContent = options.renderTarget?.(target, relationship, h);
  const reasonContent = options.renderReason?.(relationship, h);
  const parts = {
    pattern: patternContent === undefined ? h.strong(pattern) : patternContent,
    name: nameContent === undefined ? (edge.label ? h.span(edge.label) : null) : nameContent,
    source:
      sourceContent === undefined
        ? source.badges.length
          ? contextMapParticipant(h, source)
          : null
        : sourceContent,
    target:
      targetContent === undefined
        ? target.badges.length
          ? contextMapParticipant(h, target)
          : null
        : targetContent,
    reason: reasonContent === undefined ? (reason ? h.span(reason) : null) : reasonContent,
  };
  const content = options.renderLayout
    ? options.renderLayout(parts, relationship, h)
    : [parts.pattern, parts.name, parts.source, parts.target, parts.reason];
  const phrase = relationship.direction === 'directed' ? 'to' : 'and';
  const participants = `${describeParticipant(source)} ${phrase} ${describeParticipant(target)}`;
  const description = [pattern, participants, reason].filter(Boolean).join('. ');
  if (action && action.reason === undefined)
    return h.button
      .class('zloz-ui-context-label')
      .attr('type', 'button')
      .attr('data-flow-context-edge', edge.id)
      .attr('data-zloz-context-map-label', edge.id)
      .attr(
        'aria-label',
        edge.label
          ? `Edit edge label ${edge.label} for ${description}`
          : `Add label for ${description}`,
      )
      .on('click', action.edit)
      .children(content);

  return h.div
    .key(`label:${edge.id}`)
    .class(position ? 'zloz-ui-edge-label' : '', 'zloz-ui-context-label')
    .attr('role', 'group')
    .attr('aria-label', description)
    .attr('title', action?.reason)
    .attr('data-zloz-context-map-label', edge.id)
    .style(position ? { left: `${position.x}px`, top: `${position.y}px` } : {})
    .children(content);
}
