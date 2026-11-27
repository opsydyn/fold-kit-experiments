import type { Html } from '@effect/ui/html';
import type { ZlozConnectionsContext } from '@opsydyn/foldkit-zloz/effect-ui';

const workshopLinkLabels = {
  produces: 'Produces',
  activates: 'Activates',
  triggers: 'Triggers',
} as const;

export function createConnectionsView<M>(onSelected: (id: string) => M) {
  const button = (
    h: Html.H<M>,
    id: string,
    label: string,
    selected: boolean,
    disabledReason: string | undefined,
  ) =>
    h.button
      .key(id)
      .class('shared-connection')
      .attrs({
        type: 'button',
        'aria-label': label,
        'aria-pressed': String(selected),
        title: disabledReason,
      })
      .disabled(disabledReason !== undefined)
      .on('click', onSelected(id))
      .children(label);
  return (context: ZlozConnectionsContext, h: Html.H<M>) =>
    h.div
      .class('shared-connections')
      .attr('data-flow-connections', '')
      .children(
        ...context.entries.map((entry) => {
          const meaning = entry.edge.architecture;
          const verb =
            meaning?.family === 'event-storming' &&
            (meaning.role === 'produces' ||
              meaning.role === 'activates' ||
              meaning.role === 'triggers')
              ? meaning.role
              : null;
          const endpoints = verb
            ? `${entry.sourceLabel} ${verb} ${entry.targetLabel}`
            : `${entry.sourceLabel} → ${entry.targetLabel}`;
          const label =
            entry.edge.label && !(verb && entry.edge.label === workshopLinkLabels[verb])
              ? `${entry.edge.label} — ${endpoints}`
              : endpoints;
          return h.lazy(
            button,
            entry.edge.id,
            label,
            entry.selected,
            entry.selectionDisabledReason,
          );
        }),
      );
}
