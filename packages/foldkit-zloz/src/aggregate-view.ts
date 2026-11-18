import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozAggregateLink, ZlozAggregateProjection } from './aggregate';

/** Read-only aggregate inspector. The host supplies selection and the current graph projection. */
export function zlozAggregateView<M>(
  h: HtmlBuilder<M>,
  aggregate: ZlozAggregateProjection | null,
): Html {
  const attrs = [h.Class('zloz-aggregate-view'), h.AriaLabel('Aggregate view')];
  if (!aggregate)
    return h.section(attrs, [h.p([], ['Select an aggregate or aggregate root on the canvas.'])]);
  const label = (link: ZlozAggregateLink) =>
    link.evidence === 'inferred' ? [link.label, h.small([], [' (inferred)'])] : [link.label];
  return h.section(attrs, [
    h.h2([], [aggregate.label]),
    h.h3([], ['Handled commands']),
    aggregate.commands.length
      ? h.ul(
          [],
          aggregate.commands.map((command) => h.li([h.Key(command.edgeId)], label(command))),
        )
      : h.p([], ['No handled commands modeled.']),
    h.h3([], ['Emitted events']),
    aggregate.events.length
      ? h.ul(
          [],
          aggregate.events.map((event) =>
            h.li(
              [h.Key(event.edgeId)],
              [
                ...label(event),
                ...(event.policies.length
                  ? [
                      h.ul(
                        [],
                        event.policies.map((policy) =>
                          h.li([h.Key(policy.edgeId)], ['Activates ', ...label(policy)]),
                        ),
                      ),
                    ]
                  : []),
              ],
            ),
          ),
        )
      : h.p([], ['No emitted events modeled.']),
  ]);
}
