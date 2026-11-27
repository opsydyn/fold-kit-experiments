import type { Html } from '@effect/ui/html';
import {
  auditEditionSelect,
  auditFindingButton,
  auditFindingFilter,
  dddAuditFindingButton,
} from '@opsydyn/foldkit-zloz/effect-ui';

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
          .children(control.label, auditEditionSelect(h, control, request)),
      ),
      ...filterKinds.map((kind) => {
        const filter = context.filters[kind];
        return h.label
          .key(kind)
          .style({ display: 'flex', gap: '8px', alignItems: 'center' })
          .children(
            auditFindingFilter(h, filter, request),
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
              auditFindingButton(h, entry, request, {
                content: h.span.children(
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
              }).style(findingStyle),
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
          h.label
            .key(control.part)
            .children(control.label, auditEditionSelect(h, control, request)),
        ),
        ...(context.comparison
          ? filterKinds.map((kind) => {
              const filter = context.filters[kind];
              return h.label
                .key(kind)
                .children(
                  auditFindingFilter(h, filter, request),
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
            return h.li
              .key(JSON.stringify([entry.kind, entry.finding.edgeId, entry.finding.code]))
              .style({ listStyle: 'none', marginBottom: '12px' })
              .children(
                dddAuditFindingButton(h, entry, request, {
                  content: h.span.children(
                    h.strong.children(entry.kind === 'current' ? 'Finding' : entry.kind),
                    h.span.children(` · ${entry.label}`),
                  ),
                }).style(findingStyle),
                h.small
                  .style({ display: 'block', padding: '6px 0' })
                  .children(entry.finding.message),
                h.small.style({ display: 'block' }).children(entry.finding.relationshipKey),
                dddAuditFindingButton(h, entry, request, {
                  subject: 'source',
                  content: 'View source',
                }),
                dddAuditFindingButton(h, entry, request, {
                  subject: 'target',
                  content: 'View target',
                }),
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
