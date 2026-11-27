import type { Html } from '@effect/ui/html';

import type { ZlozConnectionCreationFieldContext } from './connection-creation';
import type { ZlozEdgeReconnectionContext } from './edge-reconnection';
import { resolveEndpointChoices } from './endpoint-search';
import type { EditorEvent } from './types';

type EndpointField = ZlozConnectionCreationFieldContext | ZlozEdgeReconnectionContext;

export type NativeEndpointFieldOptions<M> = Readonly<{
  id: string;
  heading?: string;
  search?: Readonly<{
    label: string;
    query: string;
    onChange: (query: string) => M;
  }>;
  onEvent: (event: EditorEvent) => M;
}>;

/** Renders the current creation or reconnection proposal with native selection and policy feedback. */
export function endpointField<M>(
  h: Html.H<M>,
  field: EndpointField,
  { id, heading, search, onEvent }: NativeEndpointFieldOptions<M>,
) {
  const choices = resolveEndpointChoices<EndpointField['entries'][number]>(field.entries, {
    query: search?.query,
  });
  const creation = 'cancel' in field ? field : undefined;
  const hint = 'hint' in field ? field.hint : field.emptyReason;
  const reasons = [
    ...(field.reason ? [field.reason] : []),
    ...(hint ? [hint] : []),
    ...(choices.emptyReason ? [choices.emptyReason] : []),
    ...choices.entries
      .filter(({ reason }) => reason !== null && reason !== field.reason && reason !== hint)
      .map(({ label, reason }) => `${label}: ${reason}`),
  ];
  const feedbackId = `${id}-search-feedback`;
  const reasonsId = `${id}-reasons`;
  const cancel = () =>
    creation?.cancel.reason === null ? onEvent(creation.cancel.event) : undefined;
  const select = h.select
    .id(`${id}-select`)
    .attr('aria-label', field.label)
    .attr('aria-describedby', reasons.length ? reasonsId : undefined)
    .disabled(field.reason !== null)
    .value(field.value)
    .on('change', ({ value }) => {
      if (field.reason !== null) return undefined;
      if (value === '') return cancel();
      const candidate = choices.entries.find((choice) => choice.value === value);
      return candidate?.reason === null ? onEvent(candidate.event) : undefined;
    })
    .on('keydown', ({ key }) => (key === 'Escape' ? cancel() : undefined), { preventDefault: true })
    .children(
      creation
        ? h.option.key('placeholder').attr('value', '').children(creation.placeholder)
        : null,
      ...choices.groups.map(({ id, label, entries }) =>
        h.optgroup
          .key(id)
          .attr('label', label)
          .children(
            ...entries.map((choice) =>
              h.option
                .key(choice.value)
                .attr('value', choice.value)
                .disabled(choice.reason !== null)
                .children(
                  `${choice.label}${choice.hidden ? ' (hidden)' : ''}${choice.reason ? ' — unavailable' : ''}`,
                ),
            ),
          ),
      ),
    );
  return h.div
    .key(id)
    .class('zloz-ui-endpoint-field')
    .children(
      h.label.attr('for', `${id}-select`).children(heading ?? field.label),
      search
        ? h.div.class('zloz-ui-endpoint-search').children(
            h.input
              .attr('type', 'search')
              .attr('aria-label', search.label)
              .attr('aria-describedby', choices.emptyReason ? feedbackId : undefined)
              .attr('placeholder', 'Find a node or port…')
              .value(choices.query)
              .on('input', ({ value }) => search.onChange(value))
              .on(
                'keydown',
                ({ key }) =>
                  key === 'Escape' && choices.query !== '' ? search.onChange('') : undefined,
                { preventDefault: true },
              ),
            h.button
              .attr('type', 'button')
              .attr('aria-label', `Clear ${search.label.toLowerCase()}`)
              .on('click', search.onChange(''))
              .children('Clear'),
            h.div
              .id(feedbackId)
              .class('zloz-ui-endpoint-search-feedback')
              .attr('role', 'status')
              .attr('aria-live', 'polite')
              .children(choices.emptyReason),
          )
        : null,
      select,
      h.div
        .id(reasonsId)
        .class('zloz-ui-endpoint-reasons')
        .children(...reasons.map((reason, index) => h.p.key(String(index)).children(reason))),
    );
}
