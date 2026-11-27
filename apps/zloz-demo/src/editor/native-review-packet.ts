import type { Html } from '@effect/ui/html';
import { reviewPacket } from '@opsydyn/foldkit-zloz-mermaid/effect-ui';

import { Message } from './message';
import type { Model } from './model';
import { workbenchPacketContext } from './review-packet';

export function renderReviewPacket<M>(
  h: Html.H<M>,
  model: Model,
  request: (message: Message) => M,
) {
  const controls = workbenchPacketContext(model);
  const {
    modelIdentity: { id: modelId },
    modelEpoch: epoch,
  } = model;
  const showStatus = !model.minimalMode && model.diagnosticsEnabled;
  const contents = reviewPacket(
    h,
    controls,
    (input) => request(Message.ObservedReviewPacketInput({ request: input, modelId, epoch })),
    {
      showStatus,
      scopeHeading: 'Selected snapshots only',
      diagnosticsDisclosure: 'Inspect projection losses',
      renderDiagnostic: (item, builder) =>
        builder.li
          .style({
            listStyle: 'none',
            padding: '8px',
            marginBottom: '4px',
            borderLeft: '3px solid var(--rule)',
            background: 'var(--panel)',
          })
          .children(
            builder.strong(
              { baseline: 'Baseline', selected: 'Target', packet: 'Packet' }[item.side],
            ),
            ` · ${item.severity}${item.subject ? ` · ${item.subject}` : ''}`,
            builder.p(item.message),
          ),
    },
  ).style({
    display: 'grid',
    gap: '8px',
    padding: '12px',
    border: '1px solid var(--rule)',
    borderRadius: '8px',
  });
  return h.div.attr('data-architecture-effect-ui', 'review-packet-export').children(contents);
}
