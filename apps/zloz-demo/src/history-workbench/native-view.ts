import type { HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import {
  nativeAudits,
  nativeBlocked,
  nativePacket,
  nativePacketKey,
  nativeReview,
  nativeSource,
} from './native-authoring';
import type { Model } from './state';
export function nativeView(model: Model, h: HtmlBuilder<Message>) {
  const review = nativeReview(model),
    packet = nativePacket(model),
    inspection = model.native.inspection;
  const audits = nativeAudits(model);
  const button = (label: string, message: Message, disabled = false) =>
    h.button([h.Type('button'), h.OnClick(message), h.Disabled(disabled)], [label]);
  const checkbox = (label: string, checked: boolean, message: Message, disabled = false) =>
    h.label(
      [],
      [
        h.input([h.Type('checkbox'), h.Checked(checked), h.Disabled(disabled), h.OnClick(message)]),
        label,
      ],
    );
  const evidence = (
    label: string,
    value: ReturnType<typeof nativeAudits> | NonNullable<Model['native']['patch']>['provenance'],
  ) =>
    h.details(
      [],
      [
        h.summary([], [label]),
        h.pre(
          [h.Style({ 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' })],
          [JSON.stringify(value, null, 2)],
        ),
      ],
    );
  const file = (kind: 'proposal' | 'receipt' | 'packet', label: string) =>
    h.label(
      [],
      [
        label,
        h.input([
          h.Type('file'),
          h.Key(`native-${kind}-${model.native.sequence}`),
          h.AriaLabel(label),
          h.Accept('.json,application/json'),
          h.Disabled(!!model.reading || !!model.native.pending || !!model.review || !!inspection),
          h.OnFileChange((files) => Message.ChoseNativeFile({ kind, files })),
        ]),
      ],
    );
  return h.div(
    [h.Class('native-authoring-panel')],
    [
      ...(model.review
        ? [
            h.p(
              [],
              ['Return from edition review before opening an artifact or applying a proposal.'],
            ),
            button('Return to working model', Message.ClickedPresent()),
          ]
        : []),
      h.div(
        [h.Hidden(model.section !== 'authoring')],
        [
          h.h2([], ['Native v2 authoring']),
          h.p(
            [],
            [
              'Review a proposal against this exact working session. Apply records a receipt and one Undo.',
            ],
          ),
          h.p(
            [],
            [
              `Source: ${nativeSource(model).sessionId} · revision ${model.editor.revision} · ${model.editor.connectionMode}`,
            ],
          ),
          ...(nativeBlocked(model) ? [h.p([h.Role('status')], [nativeBlocked(model)!])] : []),
          ...(!model.native.sessionId
            ? [button('Initialize authoring session', Message.ClickedStartNativeSession())]
            : []),
          button(
            'Prepare rename example',
            Message.ClickedExampleProposal(),
            !!nativeBlocked(model),
          ),
          h.label(
            [],
            [
              'Proposal JSON',
              h.textarea([
                h.AriaLabel('Proposal JSON'),
                h.Value(model.native.text),
                h.Rows(7),
                h.OnInput((text) => Message.ChangedProposalText({ text })),
              ]),
            ],
          ),
          file('proposal', 'Open v2 proposal'),
          button('Review proposal', Message.ClickedReviewProposal(), !!model.native.pending),
          ...(review
            ? [
                evidence('Proposal provenance', model.native.patch!.provenance),
                h.h3([], ['Changes and findings']),
                ...(review.preview.type !== 'rejected'
                  ? [
                      h.ul(
                        [],
                        review.preview.changes.map((change) =>
                          h.li(
                            [],
                            [
                              `${change.entity} ${change.id}: ${change.before ? (change.after ? 'replace' : 'remove') : 'add'}`,
                            ],
                          ),
                        ),
                      ),
                      h.h3([], ['Authored losses']),
                      h.ul(
                        [],
                        review.preview.losses.map((loss) =>
                          h.li([], [`${loss.id}: ${loss.code} — ${loss.fields.join(', ')}`]),
                        ),
                      ),
                    ]
                  : []),
                h.ul(
                  [],
                  review.preview.findings.map((finding) =>
                    h.li([], [`${finding.severity}: ${finding.message}`]),
                  ),
                ),
                ...(review.reason ? [h.p([h.Role('status')], [review.reason])] : []),
                checkbox(
                  'I reviewed this exact proposal',
                  review.acknowledged || !!model.native.consent?.reviewed,
                  Message.ClickedPatchAcknowledgement({ part: 'reviewed' }),
                  !!review.reason,
                ),
                checkbox(
                  'I accept the listed authored losses',
                  !!model.native.consent?.lossesAccepted,
                  Message.ClickedPatchAcknowledgement({ part: 'lossesAccepted' }),
                  !!review.reason,
                ),
                button(
                  'Apply reviewed proposal',
                  Message.ClickedApplyProposal({ key: review.key ?? '' }),
                  !review.canApply,
                ),
                button('Download v2 proposal', Message.ClickedDownloadNative({ kind: 'proposal' })),
              ]
            : []),
          checkbox('Protect patch Apply', model.native.protected, Message.ClickedPatchProtection()),
          button(
            'Download latest patch receipt',
            Message.ClickedDownloadNative({ kind: 'receipt' }),
            model.native.receipts.length === 0,
          ),
          h.p([], [`Retained patch receipts: ${model.native.receipts.length}`]),
          h.h3([], ['Live architecture audits']),
          ...Object.entries(audits).map(([name, decision]) => {
            if (decision.type === 'blocked') return h.p([], [`${name}: ${decision.reason}`]);
            const comparison = decision.comparison;
            const findings = [
              ...comparison.introduced.map((f) => `Introduced — ${f.edgeId}: ${f.message}`),
              ...comparison.resolved.map((f) => `Resolved — ${f.edgeId}: ${f.message}`),
              ...comparison.persisting.map(
                (f) => `Persisting — ${f.after.edgeId}: ${f.after.message}`,
              ),
            ];
            return h.div(
              [],
              [
                h.h4([], [name === 'ddd' ? 'DDD relationships' : 'EventStorming relationships']),
                h.p(
                  [],
                  [
                    `Baseline: ${comparison.baseline.connectionMode}. Working: ${comparison.selected.connectionMode}.`,
                  ],
                ),
                h.p(
                  [],
                  [
                    model.minimal
                      ? comparison.status
                      : `${comparison.summary.introduced} introduced · ${comparison.summary.resolved} resolved · ${comparison.summary.persisting} persisting`,
                  ],
                ),
                h.ul(
                  [],
                  findings.map((message) => h.li([], [message])),
                ),
                h.p(
                  [],
                  [
                    'Findings reflect authored conventions; untyped edges do not prove architecture correctness.',
                  ],
                ),
              ],
            );
          }),
          evidence('Structured audit evidence', audits),
        ],
      ),
      h.div(
        [h.Hidden(model.section !== 'evidence')],
        [
          h.h2([], ['Portable native v2 review']),
          h.p(
            [],
            [
              'Packets compare the chosen baseline with the working model. Reopening evidence never imports or grants Apply permission.',
            ],
          ),
          h.label(
            [],
            [
              'Packet baseline',
              h.select(
                [
                  h.AriaLabel('Packet baseline'),
                  h.Value(model.baselineId),
                  h.Disabled(!!inspection || !!model.native.pending),
                  h.OnChange((id) => Message.SelectedPacketBaseline({ id })),
                ],
                model.editions.map((e) =>
                  h.option([h.Value(e.id), h.Selected(e.id === model.baselineId)], [e.name]),
                ),
              ),
            ],
          ),
          h.h3([], ['Mermaid projection losses']),
          h.ul(
            [],
            packet.diagnostics.map((d) => h.li([], [`${d.side}: ${d.message}`])),
          ),
          checkbox(
            'I reviewed and accept these packet projection losses',
            model.native.packetConsent === nativePacketKey(model),
            Message.ClickedPacketAcceptance(),
            packet.status !== 'created',
          ),
          button(
            'Download v2 review packet',
            Message.ClickedDownloadNative({ kind: 'packet' }),
            packet.status !== 'created' || model.native.packetConsent !== nativePacketKey(model),
          ),
          file('receipt', 'Open v2 receipt'),
          file('packet', 'Open v2 review packet'),
          ...(inspection
            ? [
                h.h3([], [inspection.title]),
                h.p([], ['Read-only imported evidence. Working graph and Undo are retained.']),
                h.details(
                  [],
                  [
                    h.summary([], ['Validated provenance and evidence']),
                    h.pre(
                      [h.Style({ 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' })],
                      [inspection.text],
                    ),
                  ],
                ),
                button(
                  'Before',
                  Message.SelectedNativeSide({ side: 'baseline' }),
                  inspection.side === 'baseline',
                ),
                button(
                  'After',
                  Message.SelectedNativeSide({ side: 'selected' }),
                  inspection.side === 'selected',
                ),
                h.p(
                  [h.AriaLabel('Artifact comparison side')],
                  [
                    `${inspection.side === 'baseline' ? 'Before' : 'After'} · ${inspection.review.editor.connectionMode}`,
                  ],
                ),
                button('Return to working model', Message.ClickedCloseNativeReview()),
              ]
            : []),
        ],
      ),
      ...(model.native.pending
        ? [button('Cancel artifact read', Message.ClickedCancelNativeRead())]
        : []),
      h.p([h.Role('status'), h.AriaLive('polite')], [model.native.notice]),
    ],
  );
}
