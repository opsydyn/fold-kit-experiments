import type { Html } from '@effect/ui/html';

import type { ZlozWorkshopControlsContext, ZlozWorkshopRequest } from './workshop-controls';

/** Render authored workshop meaning and emit requests scoped to the displayed node and revision. */
export function workshopControls<M>(
  h: Html.H<M>,
  context: ZlozWorkshopControlsContext,
  onRequest: (request: ZlozWorkshopRequest) => M,
  options: Readonly<{ fieldClass?: string }> = {},
) {
  const { role, status, scope } = context;
  const restrictions = [
    ...new Set([
      context.reason,
      role.reason,
      status?.reason,
      ...role.choices.map((choice) => choice.reason),
      ...(status?.choices.map((choice) => choice.reason) ?? []),
    ]),
  ].filter((reason): reason is string => reason != null);

  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'Workshop node controls')
    .children(
      h.label.class(options.fieldClass).children(
        role.label,
        h.select
          .value(role.value)
          .attr('aria-label', role.label)
          .attr('aria-description', role.reason ?? undefined)
          .attr('title', role.reason ?? undefined)
          .disabled(role.reason !== null || scope === null)
          .on('change', ({ value }) =>
            scope && role.choices.some((choice) => choice.key === value && choice.reason === null)
              ? onRequest({ ...scope, type: 'RoleSelected', key: value })
              : undefined,
          )
          .children(
            ...role.choices.map((choice) =>
              h.option
                .key(choice.key)
                .attr('value', choice.key)
                .disabled(choice.reason !== null)
                .children(choice.reason ? [choice.label, ' — ', choice.reason] : choice.label),
            ),
          ),
      ),
      scope && status
        ? h.div
            .attr('role', 'group')
            .attr('aria-label', status.label)
            .style({ display: 'grid', gap: '6px' })
            .children(
              h.span.children(status.label),
              h.div.style({ display: 'flex', gap: '8px' }).children(
                ...status.choices.map((choice) => {
                  const reason = context.reason ?? choice.reason;
                  return h.button
                    .key(choice.key)
                    .attr('type', 'button')
                    .attr('aria-label', `Set hotspot status to ${choice.label}`)
                    .attr('aria-pressed', String(status.value === choice.key))
                    .attr('aria-description', reason ?? undefined)
                    .attr('title', reason ?? undefined)
                    .disabled(reason !== null)
                    .on('click', () =>
                      reason === null
                        ? onRequest({ ...scope, type: 'StatusSelected', value: choice.key })
                        : undefined,
                    )
                    .children(choice.label);
                }),
              ),
            )
        : null,
      h.p
        .attr('role', 'status')
        .attr('aria-live', 'polite')
        .attr('aria-label', 'Workshop meaning')
        .children(context.statusText),
      restrictions.length
        ? h.ul
            .attr('aria-label', 'Workshop restrictions')
            .children(...restrictions.map((reason) => h.li.key(reason).children(reason)))
        : null,
    );
}
