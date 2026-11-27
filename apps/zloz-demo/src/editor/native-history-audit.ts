import type { Html } from '@effect/ui/html';
import type { ZlozAuditEditionControl } from '@opsydyn/foldkit-zloz';

import { workbenchAuditContext } from './audit-comparison';
import { workbenchDddAuditContext } from './ddd-audit';
import { Message } from './message';
import type { Model } from './model';

const auditFrame = {
  display: 'grid',
  gap: '8px',
  padding: '12px',
  border: '1px solid var(--rule)',
  borderRadius: '8px',
};
const findingStyle = {
  width: '100%',
  textAlign: 'left',
  padding: '10px',
  border: '1px solid var(--rule)',
  borderRadius: '6px',
  background: 'var(--panel)',
};
const filterKinds = ['introduced', 'resolved', 'persisting'] as const;

function auditEditionSelect<M>(
  h: Html.H<M>,
  control: ZlozAuditEditionControl,
  select: (editionId: string | null) => M,
) {
  const missing = control.value !== null && !control.choices.some(({ id }) => id === control.value);
  return h.select
    .attr('aria-label', control.label)
    .value(control.value ?? '')
    .disabled(control.reason !== null)
    .attr('aria-description', control.reason ?? undefined)
    .attr('title', control.reason ?? undefined)
    .on('change', ({ value }) => select(value || null))
    .children(
      h.option.attr('value', '').children(control.noneLabel),
      missing
        ? h.option
            .attr('value', control.value ?? '')
            .disabled(true)
            .children(`Unavailable edition: ${control.value}`)
        : null,
      ...control.choices.map(({ id, label }) => h.option.key(id).attr('value', id).children(label)),
    );
}

export function historyAudit<M>(h: Html.H<M>, model: Model, send: (message: Message) => M) {
  const context = workbenchAuditContext(model);
  const showStatus = !model.minimalMode && model.diagnosticsEnabled;
  const request = (
    request: Parameters<typeof Message.ObservedAuditComparisonInput>[0]['request'],
  ) =>
    send(
      Message.ObservedAuditComparisonInput({
        modelId: model.modelIdentity.id,
        epoch: model.modelEpoch,
        request,
      }),
    );
  return h.div
    .style(auditFrame)
    .attr('role', 'group')
    .attr('aria-label', 'Causal audit comparison')
    .children(
      ...[context.baseline, context.target].map((control) =>
        h.label
          .key(control.part)
          .class('workbench-field')
          .children(
            control.label,
            auditEditionSelect(h, control, (editionId) =>
              request({
                type: control.part === 'baseline' ? 'BaselineSelected' : 'TargetSelected',
                editionId,
              }),
            ),
          ),
      ),
      ...filterKinds.map((kind) => {
        const filter = context.filters[kind];
        return h.label
          .key(kind)
          .style({ display: 'flex', gap: '8px', alignItems: 'center' })
          .children(
            h.input
              .attr('type', 'checkbox')
              .attr('aria-label', filter.label)
              .checked(filter.checked)
              .on('click', request({ type: 'FilterToggled', kind })),
            filter.label,
            showStatus ? ` · ${filter.count}` : null,
          );
      }),
      showStatus
        ? h.p
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .attr('aria-label', 'Audit comparison status')
            .children(context.statusText)
        : null,
      h.ul.attr('aria-label', 'Causal audit findings').children(
        ...context.entries.map((entry) =>
          h.li
            .key(JSON.stringify([entry.kind, entry.finding.edgeId, entry.finding.code]))
            .style({ listStyle: 'none', marginBottom: '8px' })
            .children(
              h.button
                .attr('type', 'button')
                .attr(
                  'aria-label',
                  `View ${entry.kind} finding: ${entry.label} in ${entry.source.kind === 'current' ? 'current graph' : entry.source.name}`,
                )
                .disabled(entry.reason !== null)
                .attr('aria-description', entry.reason ?? undefined)
                .attr('title', entry.reason ?? undefined)
                .style(findingStyle)
                .on('click', request(entry.request))
                .children(
                  h.strong
                    .style({ display: 'block', textTransform: 'capitalize' })
                    .children(entry.kind),
                  h.span.children(entry.label),
                  h.small
                    .style({ display: 'block' })
                    .children(
                      entry.source.kind === 'current' ? 'Current graph' : entry.source.name,
                    ),
                ),
              h.small.style({ display: 'block', padding: '4px 0' }).children(entry.finding.message),
              entry.reason ? h.p.children(entry.reason) : null,
            ),
        ),
      ),
      context.reason
        ? h.p.attr('aria-label', 'Audit comparison availability').children(context.reason)
        : null,
    );
}

export function dddAuditPanel<M>(h: Html.H<M>, model: Model, send: (message: Message) => M) {
  const context = workbenchDddAuditContext(model);
  const showStatus = !model.minimalMode && model.diagnosticsEnabled;
  const request = (request: Parameters<typeof Message.ObservedDddAuditInput>[0]['request']) =>
    send(
      Message.ObservedDddAuditInput({
        modelId: model.modelIdentity.id,
        epoch: model.modelEpoch,
        request,
      }),
    );
  return h.div.class('ddd-audit-panel').children(
    h.h3.children('DDD findings'),
    h.p.children(
      'Review declared DDD conventions. Choose a baseline to compare; resolved findings open the baseline, other findings open the target.',
    ),
    h.button
      .attr('type', 'button')
      .on('click', send(Message.ClickedDddAuditExample()))
      .children('Load DDD audit example'),
    h.div
      .style(auditFrame)
      .attr('role', 'group')
      .attr('aria-label', 'DDD audit review')
      .children(
        ...[context.baseline, context.target].map((control) =>
          h.label.key(control.part).children(
            control.label,
            auditEditionSelect(h, control, (editionId) =>
              request({
                type: control.part === 'baseline' ? 'BaselineSelected' : 'TargetSelected',
                editionId,
              }),
            ),
          ),
        ),
        ...(context.comparison
          ? filterKinds.map((kind) => {
              const filter = context.filters[kind];
              return h.label.key(kind).children(
                h.input
                  .attr('type', 'checkbox')
                  .attr('aria-label', filter.label)
                  .checked(filter.checked)
                  .on('click', request({ type: 'FilterToggled', kind })),
                showStatus ? `${filter.label} (${filter.count})` : filter.label,
              );
            })
          : []),
        showStatus
          ? h.p
              .attr('role', 'status')
              .attr('aria-live', 'polite')
              .attr('aria-label', 'DDD audit status')
              .children(context.statusText)
          : null,
        h.ul.attr('aria-label', 'DDD audit findings').children(
          ...context.entries.map((entry) => {
            const button = (subject: 'edge' | 'source' | 'target') =>
              h.button
                .attr('type', 'button')
                .attr(
                  'aria-label',
                  `View ${subject} for ${entry.kind} DDD finding: ${entry.label} in ${entry.source.kind === 'current' ? 'current graph' : entry.source.name}`,
                )
                .disabled(entry.reason !== null)
                .attr('aria-description', entry.reason ?? undefined)
                .attr('title', entry.reason ?? undefined)
                .on('click', request({ ...entry.request, subject }));
            return h.li
              .key(JSON.stringify([entry.kind, entry.finding.edgeId, entry.finding.code]))
              .style({ listStyle: 'none', marginBottom: '12px' })
              .children(
                button('edge')
                  .style(findingStyle)
                  .children(
                    h.strong.children(entry.kind === 'current' ? 'Finding' : entry.kind),
                    h.span.children(` · ${entry.label}`),
                  ),
                h.small
                  .style({ display: 'block', padding: '6px 0' })
                  .children(entry.finding.message),
                h.small.style({ display: 'block' }).children(entry.finding.relationshipKey),
                button('source').children('View source'),
                button('target').children('View target'),
                entry.reason ? h.p.children(entry.reason) : null,
              );
          }),
        ),
        context.reason
          ? h.p.attr('aria-label', 'DDD audit availability').children(context.reason)
          : null,
      ),
  );
}
