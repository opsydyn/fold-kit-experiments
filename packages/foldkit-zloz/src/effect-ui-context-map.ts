import type { Html } from '@effect/ui/html';

import type { ZlozContextMapParticipant, ZlozContextMapRelationship } from './context-map';
import type { Point } from './types';

function participantDescription(participant: ZlozContextMapParticipant): string {
  return [participant.name, ...participant.badges.map((badge) => badge.description)].join(', ');
}

function participant<M>(h: Html.H<M>, context: ZlozContextMapParticipant) {
  if (!context.badges.length) return null;
  return h.span
    .class('zloz-ui-context-participant')
    .children(
      context.name,
      ...context.badges.map((badge) =>
        h.span
          .key(badge.text)
          .class('zloz-ui-context-badge')
          .attr('title', badge.description)
          .attr('aria-label', badge.description)
          .children(badge.text),
      ),
    );
}

export function contextMapLabel<M>(
  h: Html.H<M>,
  relationship: ZlozContextMapRelationship,
  position: Point,
) {
  const { edge, source, target, pattern, reason } = relationship;
  const phrase = relationship.direction === 'directed' ? 'to' : 'and';
  const participants = `${participantDescription(source)} ${phrase} ${participantDescription(target)}`;
  return h.div
    .key(`label:${edge.id}`)
    .class('zloz-ui-edge-label', 'zloz-ui-context-label')
    .attr('role', 'group')
    .attr('aria-label', `${pattern}. ${participants}`)
    .attr('data-zloz-context-map-label', edge.id)
    .style({ left: `${position.x}px`, top: `${position.y}px` })
    .children(
      h.strong(pattern),
      edge.label ? h.span(edge.label) : null,
      participant(h, source),
      participant(h, target),
      reason ? h.span(reason) : null,
    );
}
