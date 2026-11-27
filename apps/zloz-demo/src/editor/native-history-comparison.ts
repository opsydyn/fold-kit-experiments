import type { Html } from '@effect/ui/html';
import type {
  ZlozHistoryChangeNavigatorContext,
  ZlozHistoryComparisonControlsContext,
} from '@opsydyn/foldkit-zloz';

import { Message } from './message';
import type { Model } from './model';

export function historyComparison<M>(
  h: Html.H<M>,
  { baseline, ghosts, statusText, reasons }: ZlozHistoryComparisonControlsContext,
  send: (message: Message) => M,
) {
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'History comparison controls')
    .style({
      display: 'grid',
      gap: '8px',
      padding: '12px',
      border: '1px solid var(--rule)',
      borderRadius: '8px',
    })
    .children(
      h.label.class('workbench-field').children(
        'Compare with',
        h.select
          .attr('aria-label', baseline.label)
          .value(baseline.value ?? '')
          .disabled(baseline.reason !== null)
          .attr('aria-description', baseline.reason ?? undefined)
          .attr('title', baseline.reason ?? undefined)
          .on('change', ({ value }) => send(Message.SelectedHistoryBaseline({ id: value })))
          .children(
            h.option.attr('value', '').children(baseline.noneLabel),
            ...baseline.choices.map((choice) =>
              h.option.key(choice.editionId).attr('value', choice.editionId).children(choice.label),
            ),
          ),
      ),
      ...(['enabled', 'nodes', 'edges', 'movements'] as const).map((part) => {
        const control = ghosts[part];
        return h.label
          .key(part)
          .style({ display: 'flex', gap: '8px', alignItems: 'center' })
          .children(
            h.input
              .attr('type', 'checkbox')
              .attr('aria-label', control.label)
              .checked(control.checked)
              .disabled(control.reason !== null)
              .attr('aria-description', control.reason ?? undefined)
              .attr('title', control.reason ?? undefined)
              .on('click', send(Message.ClickedHistoryGhost({ part }))),
            control.label,
          );
      }),
      h.p
        .attr('role', 'status')
        .attr('aria-live', 'polite')
        .attr('aria-label', 'History comparison status')
        .children(statusText),
      reasons.length > 0 &&
        h.p.attr('aria-label', 'History comparison availability').children(reasons.join(' ')),
    );
}

export function historyChanges<M>(
  h: Html.H<M>,
  model: Model,
  { filters, entries, statusText, reason }: ZlozHistoryChangeNavigatorContext,
  send: (message: Message) => M,
) {
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'History change navigator')
    .style({ display: 'grid', gap: '8px' })
    .children(
      ...(['added', 'removed', 'changed'] as const).map((kind) => {
        const control = filters[kind];
        return h.label
          .key(kind)
          .style({ display: 'flex', gap: '8px' })
          .children(
            h.input
              .attr('type', 'checkbox')
              .attr('aria-label', control.label)
              .checked(control.checked)
              .on('click', send(Message.ClickedHistoryChangeFilter({ kind }))),
            control.label,
          );
      }),
      !model.minimalMode &&
        h.p
          .attr('role', 'status')
          .attr('aria-live', 'polite')
          .attr('aria-label', 'History changes status')
          .children(statusText),
      h.ul.attr('aria-label', 'History changes').children(
        ...entries.map((entry) =>
          h.li.key(`${entry.entity}:${entry.id}`).children(
            h.button
              .attr('type', 'button')
              .attr('aria-label', `View ${entry.summary}`)
              .disabled(entry.reason !== null)
              .attr('aria-description', entry.reason ?? undefined)
              .attr('title', entry.reason ?? undefined)
              .style({ width: '100%', textAlign: 'left', padding: '8px', marginBottom: '4px' })
              .on(
                'click',
                send(
                  Message.ClickedHistoryChange({
                    ...entry.request,
                    modelId: model.modelIdentity.id,
                    epoch: model.modelEpoch,
                  }),
                ),
              )
              .children(
                h.span.style({ fontWeight: '650' }).children(entry.kind),
                ` ${entry.entity}: ${entry.label}`,
                h.small
                  .style({ display: 'block' })
                  .children(
                    entry.semanticChanged && entry.layoutChanged
                      ? 'Model + layout'
                      : entry.semanticChanged
                        ? 'Model'
                        : 'Layout',
                  ),
                entry.reason && h.span.children(` · ${entry.reason}`),
              ),
          ),
        ),
      ),
      reason && h.p.attr('aria-label', 'History changes availability').children(reason),
    );
}
