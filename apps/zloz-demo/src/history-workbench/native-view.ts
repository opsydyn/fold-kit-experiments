import type { Html } from '@effect/ui/html';

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
export function nativeView(model: Model, h: Html.H<Message>) {
  const review = nativeReview(model),
    packet = nativePacket(model),
    inspection = model.native.inspection;
  const audits = nativeAudits(model);
  const button = (label: string, message: Message, disabled = false) =>
    h.button.attr('type', 'button').on('click', message).disabled(disabled).children(label);
  const checkbox = (label: string, checked: boolean, message: Message, disabled = false) =>
    h.label.children(
      h.input.attr('type', 'checkbox').checked(checked).disabled(disabled).on('click', message),
      label,
    );
  const evidence = (
    label: string,
    value: ReturnType<typeof nativeAudits> | NonNullable<Model['native']['patch']>['provenance'],
  ) =>
    h.details.children(
      h.summary.children(label),
      h.pre
        .style({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
        .children(JSON.stringify(value, null, 2)),
    );
  const file = (kind: 'proposal' | 'receipt' | 'packet', label: string) =>
    h.label.children(
      label,
      h.input
        .attr('type', 'file')
        .key(`native-${kind}-${model.native.sequence}`)
        .attr('aria-label', label)
        .attr('accept', '.json,application/json')
        .disabled(!!model.reading || !!model.native.pending || !!model.review || !!inspection)
        .on('change', ({ files }) => Message.ChoseNativeFile({ kind, files })),
    );
  return h.div
    .key('native-authoring')
    .class('native-authoring-panel')
    .children(
      ...(model.review
        ? [
            h.p.children(
              'Return from edition review before opening an artifact or applying a proposal.',
            ),
            button('Return to working model', Message.ClickedPresent()),
          ]
        : []),
      h.div.attr('hidden', model.section !== 'authoring' ? '' : undefined).children(
        h.h2.children('Native v2 authoring'),
        h.p.children(
          'Review a proposal against this exact working session. Apply records a receipt and one Undo.',
        ),
        h.p.children(
          `Source: ${nativeSource(model).sessionId} · revision ${model.editor.revision} · ${model.editor.connectionMode}`,
        ),
        ...(nativeBlocked(model)
          ? [h.p.attr('role', 'status').children(nativeBlocked(model)!)]
          : []),
        ...(!model.native.sessionId
          ? [button('Initialize authoring session', Message.ClickedStartNativeSession())]
          : []),
        button('Prepare rename example', Message.ClickedExampleProposal(), !!nativeBlocked(model)),
        h.label.children(
          'Proposal JSON',
          h.textarea
            .attr('aria-label', 'Proposal JSON')
            .value(model.native.text)
            .attr('rows', '7')
            .on('input', ({ value: text }) => Message.ChangedProposalText({ text }))
            .children(),
        ),
        file('proposal', 'Open v2 proposal'),
        button('Review proposal', Message.ClickedReviewProposal(), !!model.native.pending),
        ...(review
          ? [
              evidence('Proposal provenance', model.native.patch!.provenance),
              h.h3.children('Changes and findings'),
              ...(review.preview.type !== 'rejected'
                ? [
                    h.ul.children(
                      ...review.preview.changes.map((change) =>
                        h.li.children(
                          `${change.entity} ${change.id}: ${change.before ? (change.after ? 'replace' : 'remove') : 'add'}`,
                        ),
                      ),
                    ),
                    h.h3.children('Authored losses'),
                    h.ul.children(
                      ...review.preview.losses.map((loss) =>
                        h.li.children(`${loss.id}: ${loss.code} — ${loss.fields.join(', ')}`),
                      ),
                    ),
                  ]
                : []),
              h.ul.children(
                ...review.preview.findings.map((finding) =>
                  h.li.children(`${finding.severity}: ${finding.message}`),
                ),
              ),
              ...(review.reason ? [h.p.attr('role', 'status').children(review.reason)] : []),
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
        h.p.children(`Retained patch receipts: ${model.native.receipts.length}`),
        h.h3.children('Live architecture audits'),
        ...Object.entries(audits).map(([name, decision]) => {
          if (decision.type === 'blocked') return h.p.children(`${name}: ${decision.reason}`);
          const comparison = decision.comparison;
          const findings = [
            ...comparison.introduced.map((f) => `Introduced — ${f.edgeId}: ${f.message}`),
            ...comparison.resolved.map((f) => `Resolved — ${f.edgeId}: ${f.message}`),
            ...comparison.persisting.map(
              (f) => `Persisting — ${f.after.edgeId}: ${f.after.message}`,
            ),
          ];
          return h.div.children(
            h.h4.children(name === 'ddd' ? 'DDD relationships' : 'EventStorming relationships'),
            h.p.children(
              `Baseline: ${comparison.baseline.connectionMode}. Working: ${comparison.selected.connectionMode}.`,
            ),
            h.p.children(
              model.minimal
                ? comparison.status
                : `${comparison.summary.introduced} introduced · ${comparison.summary.resolved} resolved · ${comparison.summary.persisting} persisting`,
            ),
            h.ul.children(...findings.map((message) => h.li.children(message))),
            h.p.children(
              'Findings reflect authored conventions; untyped edges do not prove architecture correctness.',
            ),
          );
        }),
        evidence('Structured audit evidence', audits),
      ),
      h.div.attr('hidden', model.section !== 'evidence' ? '' : undefined).children(
        h.h2.children('Portable native v2 review'),
        h.p.children(
          'Packets compare the chosen baseline with the working model. Reopening evidence never imports or grants Apply permission.',
        ),
        h.label.children(
          'Packet baseline',
          h.select
            .attr('aria-label', 'Packet baseline')
            .value(model.baselineId)
            .disabled(!!inspection || !!model.native.pending)
            .on('change', ({ value: id }) => Message.SelectedPacketBaseline({ id }))
            .children(
              ...model.editions.map((e) =>
                h.option
                  .attr('value', e.id)
                  .selected(e.id === model.baselineId)
                  .children(e.name),
              ),
            ),
        ),
        h.h3.children('Mermaid projection losses'),
        h.ul.children(...packet.diagnostics.map((d) => h.li.children(`${d.side}: ${d.message}`))),
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
              h.h3.children(inspection.title),
              h.p.children('Read-only imported evidence. Working graph and Undo are retained.'),
              h.details.children(
                h.summary.children('Validated provenance and evidence'),
                h.pre
                  .style({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
                  .children(inspection.text),
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
              h.p
                .attr('aria-label', 'Artifact comparison side')
                .children(
                  `${inspection.side === 'baseline' ? 'Before' : 'After'} · ${inspection.review.editor.connectionMode}`,
                ),
              button('Return to working model', Message.ClickedCloseNativeReview()),
            ]
          : []),
      ),
      ...(model.native.pending
        ? [button('Cancel artifact read', Message.ClickedCancelNativeRead())]
        : []),
      h.p.attr('role', 'status').attr('aria-live', 'polite').children(model.native.notice),
    );
}
