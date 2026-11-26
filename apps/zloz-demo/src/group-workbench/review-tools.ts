import type { Html } from '@effect/ui/html';
/* oxlint-disable linteffect/no-return-in-arrow -- Pure host review composition over public versioned package APIs. */
import {
  applyModellingPatchV3,
  captureModellingPatchSourceV3,
  captureModellingPatchV3,
  parseModellingPatchV3,
  resolveModellingPatchReviewV3,
  serializeModellingPatchReceiptV3,
  parseModellingPatchReceiptV3,
  applyEventStormingC4ConversionV3,
  createEventStormingC4ConversionPlanV3,
  serializeEventStormingC4ConversionV3,
  parseEventStormingC4ConversionV3,
  applyEventStormingDddConversionV3,
  createEventStormingDddConversionPlanV3,
  serializeEventStormingDddConversionV3,
  parseEventStormingDddConversionV3,
  captureModelDocumentV3,
  captureGroupDocumentV3,
  compareModelDddRelationshipsV3,
  compareModelEventStormingRelationshipsV3,
  type ZlozModellingPatchV3,
  type ZlozModelDocumentV3,
  type ZlozGroupDocumentV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorPolicyV3,
  type ZlozEventStormingC4ConversionOptions,
  type ZlozEventStormingDddMappingOptions,
} from '@opsydyn/foldkit-zloz';
import {
  createReviewPacketV3,
  parseReviewPacketV3,
  type ZlozReviewPacketV3,
} from '@opsydyn/foldkit-zloz-mermaid';
import { modellingPatchReview } from '@opsydyn/foldkit-zloz/effect-ui';
import { Match, Schema } from 'effect';
type Source = Readonly<{ document: ZlozModelDocumentV3; sessionId: string; revision: number }>;
type Proposal =
  | Readonly<{ kind: 'patch'; patch: ZlozModellingPatchV3 }>
  | Readonly<{ kind: 'c4'; source: Source; options: ZlozEventStormingC4ConversionOptions }>
  | Readonly<{ kind: 'ddd'; source: Source; options: ZlozEventStormingDddMappingOptions }>
  | Readonly<{ kind: 'packet'; source: Source; packet: ZlozReviewPacketV3 }>;
export type NativeReviewTools = Readonly<{
  text: string;
  proposal: Proposal | null;
  consentKey: string | null;
  artifact: Readonly<{ filename: string; text: string }> | null;
  opened: Readonly<{
    before: ZlozGroupDocumentV3;
    after: ZlozGroupDocumentV3;
    side: 'before' | 'after';
    sequence: number;
  }> | null;
  sequence: number;
  notice: string;
}>;
export type NativeReviewEvent =
  | Readonly<{ type: 'TextChanged'; text: string }>
  | Readonly<{
      type:
        | 'SamplePatchClicked'
        | 'PatchReviewed'
        | 'ApplyClicked'
        | 'OpenEvidenceClicked'
        | 'CloseEvidenceClicked';
    }>
  | Readonly<{ type: 'ConsentChanged'; key: string; accepted: boolean }>
  | Readonly<{ type: 'C4ChoiceClicked'; nodeId: string; role: 'person' | 'software-system' }>
  | Readonly<{ type: 'DddChoiceClicked'; nodeId: string; role: 'aggregate' | 'domain-service' }>
  | Readonly<{ type: 'RelationRetained'; family: 'c4' | 'ddd'; edgeId: string }>
  | Readonly<{ type: 'WorkshopNodeRetained'; family: 'c4' | 'ddd'; nodeId: string }>
  | Readonly<{ type: 'PacketClicked'; baselineId: string }>
  | Readonly<{ type: 'EvidenceSideChosen'; side: 'before' | 'after' }>;
export const createNativeReviewTools = (): NativeReviewTools => ({
  text: '',
  proposal: null,
  consentKey: null,
  artifact: null,
  opened: null,
  sequence: 0,
  notice: 'Choose a mapping or paste a v3 patch. Review the exact changes and losses before Apply.',
});
const sourceOf = (editor: ZlozGroupEditorStateV3, document: ZlozModelDocumentV3): Source => ({
  document: captureModelDocumentV3(document),
  sessionId: editor.sessionId,
  revision: editor.revision,
});
const busyReason = (busy: boolean) =>
  busy ? 'Return to the working canvas and finish or cancel active work first.' : null;
export function nativeReviewContext(
  tools: NativeReviewTools,
  editor: ZlozGroupEditorStateV3,
  document: ZlozModelDocumentV3,
  policy: ZlozGroupEditorPolicyV3,
  busy: boolean,
) {
  const p = tools.proposal;
  if (!p) return { key: null, reason: 'Choose a proposal first.', details: null, accepted: false };
  if (p.kind === 'patch') {
    const review = resolveModellingPatchReviewV3(editor, document.id, p.patch, {
      consent: tools.consentKey
        ? { key: tools.consentKey, reviewed: true, lossesAccepted: true }
        : null,
      policy,
      blockedReason: busyReason(busy),
    });
    return {
      key: review.key,
      reason: review.reason,
      details: review,
      accepted: review.acknowledged,
    };
  }
  const fresh = JSON.stringify(p.source) === JSON.stringify(sourceOf(editor, document));
  if (p.kind === 'packet') {
    const key = JSON.stringify(p);
    return {
      key,
      reason:
        busyReason(busy) ??
        (!fresh ? 'The packet source changed. Create a new review packet.' : null),
      details: p.packet,
      accepted: tools.consentKey === key,
    };
  }
  const plan =
    p.kind === 'c4'
      ? createEventStormingC4ConversionPlanV3(p.source, p.options)
      : createEventStormingDddConversionPlanV3(p.source, p.options);
  return {
    key: plan.key,
    reason:
      busyReason(busy) ??
      (!fresh
        ? 'The source changed. Choose the mapping again.'
        : editor.readOnly
          ? 'This editor is read-only.'
          : editor.activity.type === 'busy'
            ? editor.activity.reason
            : plan.type !== 'reviewable'
              ? 'Resolve every ambiguity and mapping before Apply.'
              : null),
    details: plan,
    accepted: tools.consentKey === plan.key,
  };
}
/** Pure host transition. Apply returns editor and retained receipt in the same value; failures publish neither. */
function previousC4Choices(
  tools: NativeReviewTools,
  source: Source,
): ZlozEventStormingC4ConversionOptions {
  const p = tools.proposal;
  if (p?.kind === 'c4' && JSON.stringify(p.source) === JSON.stringify(source)) return p.options;
  return {};
}
function previousDddChoices(
  tools: NativeReviewTools,
  source: Source,
): ZlozEventStormingDddMappingOptions {
  const p = tools.proposal;
  if (p?.kind === 'ddd' && JSON.stringify(p.source) === JSON.stringify(source)) return p.options;
  return {};
}
export type NativeReviewTransition = Readonly<{
  tools: NativeReviewTools;
  editor: ZlozGroupEditorStateV3;
  document: ZlozModelDocumentV3;
}>;
export function updateNativeReviewTools(
  tools: NativeReviewTools,
  event: NativeReviewEvent,
  editor: ZlozGroupEditorStateV3,
  document: ZlozModelDocumentV3,
  policy: ZlozGroupEditorPolicyV3 = {},
  busy = false,
): NativeReviewTransition {
  const done = (next: NativeReviewTools) => ({ tools: next, editor, document });
  const propose = (proposal: Proposal) =>
    done({
      ...tools,
      proposal,
      consentKey: null,
      notice:
        'Review provenance, proposed changes, ambiguities and losses. No document change yet.',
    });
  return Match.value(event).pipe(
    Match.when({ type: 'TextChanged' }, (event): NativeReviewTransition => {
      return done({ ...tools, text: event.text, proposal: null, consentKey: null });
    }),
    Match.when({ type: 'SamplePatchClicked' }, (): NativeReviewTransition => {
      const node = document.snapshot.graph.nodes[0];
      if (!node) return done({ ...tools, notice: 'Add a node before generating a sample patch.' });
      const patch = captureModellingPatchV3({
        format: 'foldkit-zloz-patch',
        version: 3,
        id: 'clarify-label',
        source: captureModellingPatchSourceV3(editor, document.id),
        provenance: {
          actor: { kind: 'human', id: 'workbench-reviewer' },
          reason: 'Clarify the selected model label',
          references: [],
        },
        operations: [
          {
            id: 'rename',
            type: 'node.replace',
            node: { ...node, label: `${node.label} · reviewed` },
          },
        ],
      });
      return done({
        ...tools,
        text: JSON.stringify(patch, null, 2),
        proposal: { kind: 'patch', patch },
        consentKey: null,
        notice: 'Sample patch captured from the exact current native source.',
      });
    }),
    Match.when({ type: 'PatchReviewed' }, (): NativeReviewTransition => {
      if (new TextEncoder().encode(tools.text).byteLength > 1048576)
        return done({
          ...tools,
          notice: 'Input exceeds 1 MiB UTF-8.',
          proposal: null,
          consentKey: null,
        });
      const decoded = parseModellingPatchV3(tools.text);
      return decoded.status === 'rejected'
        ? done({ ...tools, proposal: null, consentKey: null, notice: decoded.reason })
        : propose({ kind: 'patch', patch: decoded.value });
    }),
    Match.when({ type: 'C4ChoiceClicked' }, (event): NativeReviewTransition => {
      const source = sourceOf(editor, document),
        previous = previousC4Choices(tools, source);
      return propose({
        kind: 'c4',
        source,
        options: {
          mappings: {
            ...previous.mappings,
            nodes: [
              ...(previous.mappings?.nodes ?? []).filter((n) => n.nodeId !== event.nodeId),
              { nodeId: event.nodeId, architecture: { family: 'c4', role: event.role } },
            ],
          },
          memberships: [
            ...(previous.memberships ?? []).filter((n) => n.nodeId !== event.nodeId),
            { nodeId: event.nodeId, placement: { type: 'root' } },
          ],
        },
      });
    }),
    Match.when({ type: 'DddChoiceClicked' }, (event): NativeReviewTransition => {
      const source = sourceOf(editor, document),
        previous = previousDddChoices(tools, source);
      return propose({
        kind: 'ddd',
        source,
        options: {
          ...previous,
          nodes: [
            ...(previous.nodes ?? []).filter((n) => n.nodeId !== event.nodeId),
            { nodeId: event.nodeId, architecture: { family: 'ddd', role: event.role } },
          ],
        },
      });
    }),
    Match.when({ type: 'RelationRetained' }, (event): NativeReviewTransition => {
      const source = sourceOf(editor, document);
      if (event.family === 'c4') {
        const previous = previousC4Choices(tools, source);
        return propose({
          kind: 'c4',
          source,
          options: {
            ...previous,
            mappings: {
              ...previous.mappings,
              edges: [
                ...(previous.mappings?.edges ?? []).filter((e) => e.edgeId !== event.edgeId),
                { edgeId: event.edgeId, relationship: null },
              ],
            },
          },
        });
      }
      const previous = previousDddChoices(tools, source);
      return propose({
        kind: 'ddd',
        source,
        options: {
          ...previous,
          edges: [
            ...(previous.edges ?? []).filter((e) => e.edgeId !== event.edgeId),
            { edgeId: event.edgeId, architecture: null },
          ],
        },
      });
    }),
    Match.when({ type: 'WorkshopNodeRetained' }, (event): NativeReviewTransition => {
      const source = sourceOf(editor, document);
      if (event.family === 'c4') {
        const previous = previousC4Choices(tools, source);
        return propose({
          kind: 'c4',
          source,
          options: {
            ...previous,
            mappings: {
              ...previous.mappings,
              nodes: [
                ...(previous.mappings?.nodes ?? []).filter((n) => n.nodeId !== event.nodeId),
                { nodeId: event.nodeId, architecture: null },
              ],
            },
            memberships: (previous.memberships ?? []).filter((n) => n.nodeId !== event.nodeId),
          },
        });
      }
      const previous = previousDddChoices(tools, source);
      return propose({
        kind: 'ddd',
        source,
        options: {
          ...previous,
          nodes: [
            ...(previous.nodes ?? []).filter((n) => n.nodeId !== event.nodeId),
            { nodeId: event.nodeId, architecture: null },
          ],
        },
      });
    }),
    Match.when({ type: 'PacketClicked' }, (event): NativeReviewTransition => {
      const result = createReviewPacketV3(
        document,
        { baselineId: event.baselineId },
        { lossPolicy: 'report' },
      );
      return result.status === 'rejected'
        ? done({
            ...tools,
            notice: result.diagnostics.map((d) => d.message).join(' '),
            consentKey: null,
          })
        : propose({ kind: 'packet', source: sourceOf(editor, document), packet: result.value });
    }),
    Match.when({ type: 'ConsentChanged' }, (event): NativeReviewTransition => {
      const review = nativeReviewContext(tools, editor, document, policy, busy);
      return done({
        ...tools,
        consentKey:
          event.accepted && review.reason === null && event.key === review.key ? event.key : null,
      });
    }),
    Match.when({ type: 'ApplyClicked' }, (): NativeReviewTransition => {
      const review = nativeReviewContext(tools, editor, document, policy, busy),
        p = tools.proposal;
      if (!p || review.reason !== null || !review.accepted)
        return done({
          ...tools,
          notice:
            review.reason ?? 'Acknowledge this exact proposal and its disclosed losses first.',
        });
      if (p.kind === 'packet')
        return done({
          ...tools,
          artifact: { filename: 'zloz-review-v3.json', text: JSON.stringify(p.packet, null, 2) },
          notice: 'Reviewed packet retained for download. It grants no edit authority.',
        });
      if (p.kind === 'patch') {
        const result = applyModellingPatchV3(editor, document.id, p.patch, {
          consent: { key: tools.consentKey!, reviewed: true, lossesAccepted: true },
          policy,
          blockedReason: busyReason(busy),
        });
        if (result.type !== 'applied')
          return done({
            ...tools,
            notice: result.type === 'blocked' ? result.reason : 'No authored change.',
          });
        return {
          editor: result.editor,
          document: { ...document, snapshot: result.editor.document },
          tools: {
            ...tools,
            proposal: null,
            consentKey: null,
            artifact: {
              filename: 'zloz-patch-receipt-v3.json',
              text: serializeModellingPatchReceiptV3(result.receipt),
            },
            notice: 'Patch and receipt published together. One Undo restores the complete source.',
          },
        };
      }
      const consent = { planKey: tools.consentKey!, accepted: true as const };
      const result =
        p.kind === 'c4'
          ? applyEventStormingC4ConversionV3(editor, p.source, {
              conversion: p.options,
              consent,
              policy,
            })
          : applyEventStormingDddConversionV3(editor, p.source, {
              mappings: p.options,
              consent,
              policy,
            });
      if (result.type !== 'applied')
        return done({
          ...tools,
          notice: result.type === 'blocked' ? result.reason : 'No semantic change.',
        });
      const conversion = result.conversion;
      const text =
        conversion.format === 'foldkit-zloz-c4-conversion'
          ? serializeEventStormingC4ConversionV3(conversion)
          : serializeEventStormingDddConversionV3(conversion);
      return {
        editor: result.editor,
        document: conversion.document,
        tools: {
          ...tools,
          proposal: null,
          consentKey: null,
          artifact: { filename: `zloz-${p.kind}-receipt-v3.json`, text },
          notice:
            'Conversion and receipt published together. One Undo restores the complete source.',
        },
      };
    }),
    Match.when({ type: 'OpenEvidenceClicked' }, (): NativeReviewTransition => {
      if (new TextEncoder().encode(tools.text).byteLength > 1048576)
        return done({ ...tools, notice: 'Input exceeds 1 MiB UTF-8.' });
      // oxlint-disable-next-line linteffect/no-try-catch -- Dedicated strict native evidence parsers own validation; imported evidence never becomes edit authority.
      try {
        let before: ZlozGroupDocumentV3, after: ZlozGroupDocumentV3;
        const packet = parseReviewPacketV3(tools.text);
        if (packet.status === 'parsed') {
          before = packet.value.baseline.snapshot;
          after = packet.value.selected.snapshot;
        } else {
          // Header selects a codec only. Each codec recomputes provenance and the complete target from raw text.
          const marker = Schema.decodeUnknownSync(Schema.Struct({ format: Schema.String }))(
            JSON.parse(tools.text),
          );
          if (marker.format === 'foldkit-zloz-patch-receipt') {
            const r = parseModellingPatchReceiptV3(tools.text),
              s = r.patch.source;
            const base = {
              version: 3 as const,
              coordinateSpace: s.coordinateSpace,
              connectionMode: s.connectionMode,
              capabilities: s.capabilities,
              graph: s.graph,
            };
            before = captureGroupDocumentV3(s.viewport ? { ...base, viewport: s.viewport } : base);
            after = r.snapshot;
          } else if (marker.format === 'foldkit-zloz-c4-conversion') {
            const r = parseEventStormingC4ConversionV3(tools.text);
            before = r.source.document.snapshot;
            after = r.document.snapshot;
          } else {
            const r = parseEventStormingDddConversionV3(tools.text);
            before = r.source.document.snapshot;
            after = r.document.snapshot;
          }
        }
        const sequence = tools.sequence + 1;
        return done({
          ...tools,
          proposal: null,
          consentKey: null,
          sequence,
          opened: { before, after, side: 'after', sequence },
          notice:
            'Opened validated evidence read-only. Working model and its Undo history are retained.',
        });
      } catch (error) {
        return done({ ...tools, notice: String(error) });
      }
    }),
    Match.when({ type: 'EvidenceSideChosen' }, (event): NativeReviewTransition => {
      return done({
        ...tools,
        opened: tools.opened ? { ...tools.opened, side: event.side } : null,
      });
    }),
    Match.when({ type: 'CloseEvidenceClicked' }, (): NativeReviewTransition => {
      return done({ ...tools, opened: null, notice: 'Returned to the working model.' });
    }),
    Match.exhaustive,
  );
}
/** Replaceable host layout over public headless review contracts. Required loss/protection content stays visible in minimal mode. */
export function nativeReviewToolsView<M>(
  h: Html.H<M>,
  tools: NativeReviewTools,
  editor: ZlozGroupEditorStateV3,
  document: ZlozModelDocumentV3,
  policy: ZlozGroupEditorPolicyV3,
  busy: boolean,
  onEvent: (event: NativeReviewEvent) => M,
  onDownload: () => M,
  onFiles: (files: readonly File[]) => M,
) {
  const review = nativeReviewContext(tools, editor, document, policy, busy),
    event = (label: string, e: NativeReviewEvent, disabled = false) =>
      h.button.attr('type', 'button').on('click', onEvent(e)).disabled(disabled).children(label);
  const chosen = tools.proposal;
  return h.details
    .key('native-review')
    .attr('data-native-v3-review-tools', '')
    .children(
      h.summary.children('Native mapping, patches and portable review'),
      h.p.attr('role', 'status').attr('aria-live', 'polite').children(tools.notice),
      event('Generate sample patch', { type: 'SamplePatchClicked' }),
      h.label.children(
        'V3 patch or downloaded evidence JSON',
        h.textarea
          .attr('aria-label', 'V3 patch or evidence JSON')
          .value(tools.text)
          .on('input', ({ value: text }) => onEvent({ type: 'TextChanged', text }))
          .children(),
      ),
      event('Review patch', { type: 'PatchReviewed' }),
      event('Reopen evidence read-only', { type: 'OpenEvidenceClicked' }),
      h.label.children(
        'Open downloaded native evidence',
        h.input
          .attr('type', 'file')
          .attr('accept', 'application/json,.json')
          .attr('aria-label', 'Open native evidence file')
          .on('change', ({ files }) => onFiles(files)),
      ),
      ...document.snapshot.graph.nodes
        .filter((n) => n.architecture?.family === 'event-storming')
        .map((node) =>
          h.div.children(
            h.strong.children(`Choose meaning for ${node.label}`),
            event('C4 system at root', {
              type: 'C4ChoiceClicked',
              nodeId: node.id,
              role: 'software-system',
            }),
            event('C4 person at root', {
              type: 'C4ChoiceClicked',
              nodeId: node.id,
              role: 'person',
            }),
            event('DDD domain service', {
              type: 'DddChoiceClicked',
              nodeId: node.id,
              role: 'domain-service',
            }),
            event('DDD aggregate', {
              type: 'DddChoiceClicked',
              nodeId: node.id,
              role: 'aggregate',
            }),
          ),
        ),
      ...(chosen?.kind === 'c4' || chosen?.kind === 'ddd'
        ? [
            h.p.children(
              'Explicitly retain any workshop meaning or relation that should not be converted. Nothing is dropped to satisfy a mapping.',
            ),
            ...document.snapshot.graph.nodes
              .filter((n) => n.architecture?.family === 'event-storming')
              .map((n) =>
                event(`Keep workshop meaning: ${n.label}`, {
                  type: 'WorkshopNodeRetained',
                  family: chosen.kind,
                  nodeId: n.id,
                }),
              ),
            ...document.snapshot.graph.edges.map((e) =>
              event(`Keep relation: ${e.label ?? e.id}`, {
                type: 'RelationRetained',
                family: chosen.kind,
                edgeId: e.id,
              }),
            ),
          ]
        : []),
      ...document.editions.map((e) =>
        h.div.children(
          event(`Review packet against ${e.name}`, { type: 'PacketClicked', baselineId: e.id }),
          h.details.children(
            h.summary.children('Edition audit findings'),
            h.pre.children(
              JSON.stringify(
                {
                  ddd: compareModelDddRelationshipsV3(document, { baselineId: e.id }),
                  eventStorming: compareModelEventStormingRelationshipsV3(document, {
                    baselineId: e.id,
                  }),
                },
                null,
                2,
              ),
            ),
          ),
        ),
      ),
      ...(chosen?.kind === 'patch'
        ? [
            modellingPatchReview(
              h,
              resolveModellingPatchReviewV3(editor, document.id, chosen.patch, {
                consent: tools.consentKey
                  ? { key: tools.consentKey, reviewed: true, lossesAccepted: true }
                  : null,
                policy,
                blockedReason: busyReason(busy),
              }),
              (request) =>
                onEvent(
                  request.type === 'ApplyClicked'
                    ? { type: 'ApplyClicked' }
                    : { type: 'ConsentChanged', key: request.key, accepted: request.accepted },
                ),
            ),
          ]
        : chosen
          ? [
              h.details
                .attr('open', '')
                .children(
                  h.summary.children('Provenance, changes, ambiguities and loss findings'),
                  h.pre.children(
                    JSON.stringify(
                      review.details,
                      (key, value) => (key === 'key' ? undefined : value),
                      2,
                    ),
                  ),
                ),
              h.label.children(
                h.input
                  .attr('type', 'checkbox')
                  .attr('aria-label', 'Accept native proposal and loss findings')
                  .checked(review.accepted)
                  .disabled(review.reason !== null)
                  .on(
                    'click',
                    onEvent({
                      type: 'ConsentChanged',
                      key: review.key ?? '',
                      accepted: !review.accepted,
                    }),
                  ),
                'I reviewed this exact source and accept the disclosed losses.',
              ),
              event(
                chosen.kind === 'packet' ? 'Retain reviewed packet' : 'Apply reviewed conversion',
                { type: 'ApplyClicked' },
                review.reason !== null || !review.accepted,
              ),
            ]
          : []),
      ...(review.reason && chosen ? [h.p.children(review.reason)] : []),
      ...(tools.artifact
        ? [
            h.button
              .attr('type', 'button')
              .on('click', onDownload())
              .children('Download retained artifact'),
          ]
        : []),
      ...(tools.opened
        ? [
            h.p.children('Read-only evidence comparison'),
            event('Before', { type: 'EvidenceSideChosen', side: 'before' }),
            event('After', { type: 'EvidenceSideChosen', side: 'after' }),
            event('Return to working canvas', { type: 'CloseEvidenceClicked' }),
          ]
        : []),
    );
}
