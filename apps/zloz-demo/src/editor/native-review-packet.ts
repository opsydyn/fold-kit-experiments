import { reviewPacket } from '@opsydyn/foldkit-zloz-mermaid/effect-ui';
import { Schema } from 'effect';

import { Message } from './message';
import { architectureNativePanel } from './native-panel';
import { workbenchPacketContext } from './review-packet';

export const nativeReviewPacket = architectureNativePanel<
  Readonly<{
    controls: ReturnType<typeof workbenchPacketContext>;
    modelId: string;
    epoch: number;
    showStatus: boolean;
  }>
>(
  'ArchitectureReviewPacket',
  Schema.is(Message.cases.ObservedReviewPacketInput),
  (h, { controls, modelId, epoch, showStatus }, request) =>
    reviewPacket(
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
    }),
);
