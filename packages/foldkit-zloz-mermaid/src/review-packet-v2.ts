import {
  captureModelDocumentV2,
  compareModelEventStormingRelationshipsV2,
  eventStormingRelationshipRules,
  createHistoryReviewV2,
  type EditorState,
  type ZlozModelDocumentV2,
  type ZlozConnectionDocument,
  type ZlozRelationshipAuditComparisonV2,
  type ZlozRelationshipAuditSelection,
  type ZlozHistoryReviewV2,
} from '@opsydyn/foldkit-zloz';

import { exportConnectionMermaid, type MermaidBundleV2 } from './export-mermaid';
import { parseReviewPacketV2, decodeReviewJson } from './parse-review-packet';
import {
  isReviewPacketOptions,
  type ZlozReviewPacket,
  type ZlozReviewPacketOptions,
  type ZlozReviewPacketDiagnostic,
} from './review-packet';
export type ZlozReviewPacketV2 = Omit<
  ZlozReviewPacket,
  'version' | 'baseline' | 'selected' | 'comparison' | 'projections'
> &
  Readonly<{
    version: 2;
    baseline: Omit<ZlozReviewPacket['baseline'], 'snapshot'> &
      Readonly<{ snapshot: ZlozConnectionDocument }>;
    selected: Omit<ZlozReviewPacket['selected'], 'snapshot'> &
      Readonly<{ snapshot: ZlozConnectionDocument }>;
    comparison: ZlozRelationshipAuditComparisonV2;
    projections: Readonly<{ baseline: MermaidBundleV2; selected: MermaidBundleV2 }>;
  }>;
export type ZlozReviewPacketResultV2 =
  | Readonly<{
      status: 'created';
      value: ZlozReviewPacketV2;
      diagnostics: readonly ZlozReviewPacketDiagnostic[];
    }>
  | Readonly<{
      status: 'rejected';
      reason: 'input' | 'projection';
      diagnostics: readonly ZlozReviewPacketDiagnostic[];
    }>;
function freeze<T>(value: T): T {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Freeze traversal visits already validated data, not an external representation guard.
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
/** Selected-snapshot evidence only; source mode is retained and no model import or Apply occurs. */
export function createReviewPacketV2(
  document: ZlozModelDocumentV2,
  selection: ZlozRelationshipAuditSelection,
  options: ZlozReviewPacketOptions = {},
): ZlozReviewPacketResultV2 {
  if (!isReviewPacketOptions(options))
    return {
      status: 'rejected',
      reason: 'input',
      diagnostics: [
        {
          side: 'packet',
          code: 'invalid-options',
          severity: 'error',
          dimension: 'semantics',
          subject: null,
          message: 'Review packets require data-only options and relationship rules.',
        },
      ],
    };
  const model = captureModelDocumentV2(document);
  const rules = options.rules ?? eventStormingRelationshipRules;
  const comparison = compareModelEventStormingRelationshipsV2(model, selection, { rules });
  if (comparison.type === 'blocked')
    return {
      status: 'rejected',
      reason: 'input',
      diagnostics: [
        {
          side: 'packet',
          code: comparison.code,
          severity: 'error',
          dimension: 'identity',
          subject: comparison.editionId,
          message: comparison.reason,
        },
      ],
    };
  const baseline = model.editions.find((e) => e.id === selection.baselineId);
  const selected =
    selection.selectedId === undefined
      ? null
      : model.editions.find((e) => e.id === selection.selectedId);
  if (!baseline || selected === undefined)
    return {
      status: 'rejected',
      reason: 'input',
      diagnostics: [
        {
          side: 'packet',
          code: 'unknown-edition',
          severity: 'error',
          dimension: 'identity',
          subject: selection.selectedId ?? selection.baselineId,
          message: 'The selected snapshot is unavailable.',
        },
      ],
    };
  const before = baseline.snapshot,
    after = selected?.snapshot ?? model.snapshot;
  const projectionOptions = {
    direction: options.direction ?? 'LR',
    lossPolicy: options.lossPolicy ?? 'reject',
  };
  const beforeProjection = exportConnectionMermaid(before, projectionOptions),
    afterProjection = exportConnectionMermaid(after, projectionOptions);
  const diagnostics = [
    ...beforeProjection.diagnostics.map((d) => ({ ...d, side: 'baseline' as const })),
    ...afterProjection.diagnostics.map((d) => ({ ...d, side: 'selected' as const })),
  ];
  if (beforeProjection.status === 'rejected' || afterProjection.status === 'rejected')
    return { status: 'rejected', reason: 'projection', diagnostics };
  const value: ZlozReviewPacketV2 = {
    format: 'foldkit-zloz-review',
    version: 2,
    scope: 'selected-snapshots',
    model: { id: model.id, name: model.name },
    baseline: {
      source: { kind: 'edition', id: baseline.id, name: baseline.name },
      snapshot: before,
    },
    selected: { source: comparison.comparison.selected.source, snapshot: after },
    conventions: {
      source: options.rules === undefined ? 'builtin' : 'custom',
      roleInterpretation: 'zloz-event-storming/v1',
      rules: rules.map((r) => ({
        architecture: { ...r.architecture },
        sources: [...r.sources],
        targets: [...r.targets],
        label: r.label,
      })),
    },
    comparison: comparison.comparison,
    projectionOptions,
    projections: { baseline: beforeProjection.value, selected: afterProjection.value },
    diagnostics,
  };
  const budget = decodeReviewJson(JSON.stringify(value));
  if (budget.status === 'rejected')
    return {
      status: 'rejected',
      reason: 'projection',
      diagnostics: [
        {
          side: 'packet',
          code: 'packet-limit',
          severity: 'error',
          dimension: 'syntax',
          subject: null,
          message: budget.reason,
        },
      ],
    };
  return freeze({ status: 'created', value, diagnostics });
}
/** Revalidate the packet before creating an independent, read-only checkpoint review. */
export function openReviewPacketV2(
  text: string,
  side: 'baseline' | 'selected',
  present: EditorState,
):
  | Readonly<{ status: 'opened'; packet: ZlozReviewPacketV2; review: ZlozHistoryReviewV2 }>
  | Exclude<ReturnType<typeof parseReviewPacketV2>, { status: 'parsed' }> {
  const result = parseReviewPacketV2(text);
  if (result.status === 'rejected') return result;
  const chosen = result.value[side];
  return {
    status: 'opened',
    packet: result.value,
    review: createHistoryReviewV2(
      {
        id: chosen.source.kind === 'edition' ? chosen.source.id : 'packet:current',
        name: chosen.source.kind === 'edition' ? chosen.source.name : 'Packet current snapshot',
        snapshot: chosen.snapshot,
      },
      present,
    ),
  };
}
