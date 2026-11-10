import {
  captureModelDocument,
  compareModelEventStormingRelationships,
  auditEventStormingRelationships,
  eventStormingRelationshipRules,
  isEdgeArchitecture,
  type ZlozModelDocument,
  type ZlozSnapshot,
  type ZlozRelationshipAuditSelection,
  type ZlozRelationshipAuditSource,
  type ZlozRelationshipAuditComparison,
  type ZlozEventStormingRelationshipRule,
  type JsonValue,
} from '@opsydyn/foldkit-zloz';

import {
  exportMermaid,
  type MermaidBundle,
  type MermaidExportOptions,
  type MermaidDiagnostic,
} from './export-mermaid';

export type ZlozReviewPacketOptions = MermaidExportOptions &
  Readonly<{
    /** Complete replacement catalogue. Packet interpretation is deliberately data-only. */
    rules?: readonly ZlozEventStormingRelationshipRule[];
  }>;
export type ZlozReviewPacketDiagnostic = Readonly<{
  side: 'packet' | 'baseline' | 'selected';
  code:
    | MermaidDiagnostic['code']
    | 'invalid-options'
    | 'unknown-baseline'
    | 'unknown-edition'
    | 'viewport-omitted';
  severity: 'error' | 'loss';
  dimension: MermaidDiagnostic['dimension'];
  message: string;
  subject: string | null;
}>;
export type ZlozReviewSnapshot = Readonly<{
  source: ZlozRelationshipAuditSource;
  snapshot: ZlozSnapshot;
}>;
export type ZlozReviewPacket = Readonly<{
  format: 'foldkit-zloz-review';
  version: 1;
  scope: 'selected-snapshots';
  model: Readonly<{ id: string; name: string }>;
  baseline: Readonly<{
    source: Extract<ZlozRelationshipAuditSource, { kind: 'edition' }>;
    snapshot: ZlozSnapshot;
  }>;
  selected: ZlozReviewSnapshot;
  conventions: Readonly<{
    source: 'builtin' | 'custom';
    roleInterpretation: 'zloz-event-storming/v1';
    rules: readonly ZlozEventStormingRelationshipRule[];
  }>;
  comparison: ZlozRelationshipAuditComparison;
  projectionOptions: Readonly<Required<MermaidExportOptions>>;
  projections: Readonly<{ baseline: MermaidBundle; selected: MermaidBundle }>;
  diagnostics: readonly ZlozReviewPacketDiagnostic[];
}>;
export type ZlozReviewPacketResult =
  | Readonly<{
      status: 'created';
      value: ZlozReviewPacket;
      diagnostics: readonly ZlozReviewPacketDiagnostic[];
    }>
  | Readonly<{
      status: 'rejected';
      reason: 'input' | 'projection';
      diagnostics: readonly ZlozReviewPacketDiagnostic[];
    }>;
const isRecord = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
function isDataRule(value: unknown): value is ZlozEventStormingRelationshipRule {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      ['architecture', 'sources', 'targets', 'label'].includes(key),
    ) &&
    isEdgeArchitecture(value.architecture) &&
    typeof value.label === 'string' &&
    Array.isArray(value.sources) &&
    value.sources.every(isString) &&
    Array.isArray(value.targets) &&
    value.targets.every(isString)
  );
}
function isReviewPacketOptions(value: unknown): value is ZlozReviewPacketOptions {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => ['direction', 'lossPolicy', 'rules'].includes(key)) &&
    (value.direction === undefined ||
      (typeof value.direction === 'string' &&
        ['LR', 'RL', 'TB', 'BT'].includes(value.direction))) &&
    (value.lossPolicy === undefined ||
      value.lossPolicy === 'reject' ||
      value.lossPolicy === 'report') &&
    (value.rules === undefined || (Array.isArray(value.rules) && value.rules.every(isDataRule)))
  );
}
function projection(
  side: 'baseline' | 'selected',
  snapshot: ZlozSnapshot,
  options: MermaidExportOptions,
) {
  const result = exportMermaid(snapshot.graph, options);
  const diagnostics: readonly ZlozReviewPacketDiagnostic[] = [
    ...result.diagnostics.map((item) => ({ ...item, side })),
    ...(snapshot.viewport
      ? [
          {
            side,
            code: 'viewport-omitted' as const,
            severity: 'loss' as const,
            dimension: 'layout' as const,
            subject: null,
            message:
              'The snapshot camera is retained in the packet but omitted from its Mermaid projection.',
          },
        ]
      : []),
  ];
  return { result, diagnostics };
}
/** ADR-0035: Data-only composition in the optional adapter; no I/O, clocks, imports or graph writes.
 * Invalid model/rule data throws at the existing core validation boundary. Selector/options and
 * projection failures return rejected results. Created packets may contain introduced audit findings. */
export function createReviewPacket(
  document: ZlozModelDocument,
  selection: ZlozRelationshipAuditSelection,
  options: ZlozReviewPacketOptions = {},
): ZlozReviewPacketResult {
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
          message:
            'Review packets accept only direction, lossPolicy and data-only relationship rules; callbacks and unknown fields are not portable.',
        },
      ],
    };
  const model = captureModelDocument(document);
  const rules = (options.rules ?? eventStormingRelationshipRules).map((item) => ({
    architecture: { ...item.architecture },
    sources: [...item.sources],
    targets: [...item.targets],
    label: item.label,
  }));
  auditEventStormingRelationships({ nodes: [], edges: [] }, { rules });
  const result = compareModelEventStormingRelationships(model, selection, { rules });
  if (result.type === 'blocked')
    return {
      status: 'rejected',
      reason: 'input',
      diagnostics: [
        {
          side: 'packet',
          code: result.code,
          severity: 'error',
          dimension: 'identity',
          subject: result.editionId,
          message: result.reason,
        },
      ],
    };
  const baseline = model.editions.find((edition) => edition.id === selection.baselineId);
  const selected =
    selection.selectedId === undefined
      ? null
      : model.editions.find((edition) => edition.id === selection.selectedId);
  // Successful core comparison guarantees owned selectors; retain a total defensive branch.
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
          message: 'The chosen review snapshot is unavailable.',
        },
      ],
    };
  const before = baseline.snapshot,
    after = selected?.snapshot ?? model.snapshot;
  const projectionOptions = {
    direction: options.direction ?? 'LR',
    lossPolicy: options.lossPolicy ?? 'reject',
  };
  const beforeProjection = projection('baseline', before, projectionOptions);
  const afterProjection = projection('selected', after, projectionOptions);
  const diagnostics = [...beforeProjection.diagnostics, ...afterProjection.diagnostics];
  if (
    beforeProjection.result.status === 'rejected' ||
    afterProjection.result.status === 'rejected' ||
    (projectionOptions.lossPolicy === 'reject' &&
      diagnostics.some((item) => item.severity === 'loss'))
  )
    return { status: 'rejected', reason: 'projection', diagnostics };
  const value: ZlozReviewPacket = {
    format: 'foldkit-zloz-review',
    version: 1,
    scope: 'selected-snapshots',
    model: { id: model.id, name: model.name },
    baseline: {
      source: { kind: 'edition', id: baseline.id, name: baseline.name },
      snapshot: before,
    },
    selected: { source: result.comparison.selected.source, snapshot: after },
    conventions: {
      source: options.rules === undefined ? 'builtin' : 'custom',
      roleInterpretation: 'zloz-event-storming/v1',
      rules,
    },
    comparison: result.comparison,
    projectionOptions,
    projections: {
      baseline: beforeProjection.result.value,
      selected: afterProjection.result.value,
    },
    diagnostics,
  };
  return { status: 'created', value, diagnostics };
}
