import { zlozDddAuditControls, zlozDddAuditFindingButton } from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { workbenchDddAuditContext } from './ddd-audit';
import { Message } from './message';
import type { Model } from './model';
export function dddAuditPanel(model: Model, h: HtmlBuilder<Message>) {
  const onRequest = (request: Parameters<typeof Message.ObservedDddAuditInput>[0]['request']) =>
    Message.ObservedDddAuditInput({
      modelId: model.modelIdentity.id,
      epoch: model.modelEpoch,
      request,
    });
  return h.div(
    [h.Class('ddd-audit-panel')],
    [
      h.h3([], ['DDD findings']),
      h.p(
        [],
        [
          'Review declared DDD conventions. Choose a baseline to compare; resolved findings open the baseline, other findings open the target.',
        ],
      ),
      h.button(
        [h.Type('button'), h.OnClick(Message.ClickedDddAuditExample())],
        ['Load DDD audit example'],
      ),
      zlozDddAuditControls(h, workbenchDddAuditContext(model), onRequest, {
        showCounts: !model.minimalMode && model.diagnosticsEnabled,
        renderStatus: () => (model.minimalMode || !model.diagnosticsEnabled ? null : undefined),
        attributes: [
          h.Style({
            display: 'grid',
            gap: '8px',
            padding: '12px',
            border: '1px solid var(--rule)',
            borderRadius: '8px',
          }),
        ],
        renderEntry: (entry, builder, request) =>
          builder.li(
            [
              builder.Key(`${entry.kind}:${entry.finding.edgeId}`),
              builder.Style({ listStyle: 'none', marginBottom: '12px' }),
            ],
            [
              zlozDddAuditFindingButton(
                builder,
                entry,
                request,
                [
                  builder.Style({
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px',
                    border: '1px solid var(--rule)',
                    background: 'var(--panel)',
                    borderRadius: '6px',
                  }),
                ],
                [
                  builder.strong([], [entry.kind === 'current' ? 'Finding' : entry.kind]),
                  builder.span([], [` · ${entry.label}`]),
                ],
              ),
              builder.small(
                [builder.Style({ display: 'block', padding: '6px 0' })],
                [entry.finding.message],
              ),
              builder.small([builder.Style({ display: 'block' })], [entry.finding.relationshipKey]),
              zlozDddAuditFindingButton(
                builder,
                entry,
                request,
                [],
                ['View source'],
                undefined,
                'source',
              ),
              zlozDddAuditFindingButton(
                builder,
                entry,
                request,
                [],
                ['View target'],
                undefined,
                'target',
              ),
              ...(entry.reason ? [builder.p([], [entry.reason])] : []),
            ],
          ),
      }),
    ],
  );
}
