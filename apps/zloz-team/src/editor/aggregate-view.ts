import type { Html } from '@effect/ui/html';
import type { ZlozAggregateLink, ZlozAggregateProjection } from '@opsydyn/foldkit-zloz';

export function aggregateViewContent<M>(h: Html.H<M>, aggregate: ZlozAggregateProjection | null) {
  const panel = h.section.class('zloz-aggregate-view').attr('aria-label', 'Aggregate view');
  if (!aggregate)
    return panel.children(h.p.children('Select an aggregate or aggregate root on the canvas.'));
  const label = (link: ZlozAggregateLink) => [
    link.label,
    link.evidence === 'inferred' ? h.small.children(' (inferred)') : null,
  ];
  return panel.children(
    h.h2.children(aggregate.label),
    h.h3.children('Handled commands'),
    aggregate.commands.length
      ? h.ul.children(
          ...aggregate.commands.map((command) =>
            h.li.key(command.edgeId).children(...label(command)),
          ),
        )
      : h.p.children('No handled commands modeled.'),
    h.h3.children('Emitted events'),
    aggregate.events.length
      ? h.ul.children(
          ...aggregate.events.map((event) =>
            h.li
              .key(event.edgeId)
              .children(
                ...label(event),
                event.policies.length > 0 &&
                  h.ul.children(
                    ...event.policies.map((policy) =>
                      h.li.key(policy.edgeId).children('Activates ', ...label(policy)),
                    ),
                  ),
              ),
          ),
        )
      : h.p.children('No emitted events modeled.'),
  );
}
