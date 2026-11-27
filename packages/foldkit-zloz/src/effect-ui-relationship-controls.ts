import type { Html } from '@effect/ui/html';

import type {
  ZlozEventStormingRelationshipControlsContext,
  ZlozEventStormingRelationshipRequest,
} from './relationship-controls';

/** Show the current relationship and dispatch requests against the inspected edge. */
export function eventStormingRelationshipControls<M>(
  h: Html.H<M>,
  context: ZlozEventStormingRelationshipControlsContext,
  onRequest: (request: ZlozEventStormingRelationshipRequest) => M,
  options: Readonly<{ fieldClass?: string; statusPrefix?: string }> = {},
) {
  const { edge, inference } = context;
  const inferenceRequest = inference.request;
  const reasons = [...new Set([context.reason, inference.reason])].filter(
    (reason): reason is string => reason !== null,
  );
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'Causal relationship controls')
    .children(
      h.label.class(options.fieldClass).children(
        context.label,
        h.select
          .attr('aria-label', context.label)
          .attr('aria-description', context.reason ?? undefined)
          .attr('title', context.reason ?? undefined)
          .disabled(context.reason !== null)
          .on('change', ({ value }) =>
            edge && context.reason === null
              ? onRequest({ type: 'RelationshipSelected', edgeId: edge.id, key: value || null })
              : undefined,
          )
          .children(
            ...context.choices.map((choice) =>
              h.option
                .key(choice.key ?? 'untyped')
                .attr('value', choice.key ?? '')
                .attr('title', choice.reason ?? undefined)
                .selected(choice.key === context.value)
                .disabled(choice.reason !== null)
                .children(choice.label),
            ),
          ),
      ),
      h.button
        .attr('type', 'button')
        .attr('aria-label', inference.label)
        .attr('aria-description', inference.reason ?? undefined)
        .attr('title', inference.reason ?? undefined)
        .disabled(inference.reason !== null || inferenceRequest === null)
        .style({ padding: '8px' })
        .on('click', () => (inferenceRequest ? onRequest(inferenceRequest) : undefined))
        .children(inference.label),
      h.p
        .attr('role', 'status')
        .attr('aria-label', 'Causal relationship status')
        .attr('aria-live', 'polite')
        .children(
          options.statusPrefix ? h.strong.children(options.statusPrefix) : null,
          context.statusText,
        ),
      reasons.length || context.choices.length
        ? h.div
            .attr('role', 'group')
            .attr('aria-label', 'Relationship compatibility')
            .children(
              ...reasons.map((reason) => h.p.key(reason).children(reason)),
              context.choices.length
                ? h.ul.children(
                    ...context.choices.map((choice) =>
                      h.li
                        .key(choice.key ?? 'untyped')
                        .children(
                          `${choice.label}: ${choice.reason ?? choice.compatibilityReason ?? 'compatible'}`,
                        ),
                    ),
                  )
                : null,
            )
        : null,
    );
}
