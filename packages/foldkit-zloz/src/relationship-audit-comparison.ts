import {
  checkedEventStormingRelationshipRules,
  type ZlozEventStormingRelationshipOptions,
} from './event-storming-relationships';
import { captureModelDocument, type ZlozModelDocument } from './model-document';
import {
  auditEventStormingRelationships,
  type ZlozEventStormingRelationshipAudit,
  type ZlozEventStormingRelationshipAuditEntry,
} from './relationship-audit';

export type ZlozRelationshipAuditFinding = Extract<
  ZlozEventStormingRelationshipAuditEntry,
  { status: 'blocked' }
>;
export type ZlozRelationshipAuditSource =
  | Readonly<{ kind: 'current' }>
  | Readonly<{ kind: 'edition'; id: string; name: string }>;
export type ZlozRelationshipAuditSelection = Readonly<{
  baselineId: string;
  /** Omit to compare against the current graph. IDs select only this model's owned editions. */
  selectedId?: string;
}>;
export type ZlozRelationshipAuditComparison = Readonly<{
  modelId: string;
  status: 'regressed' | 'no-new-findings';
  baseline: Readonly<{
    source: ZlozRelationshipAuditSource;
    audit: ZlozEventStormingRelationshipAudit;
  }>;
  selected: Readonly<{
    source: ZlozRelationshipAuditSource;
    audit: ZlozEventStormingRelationshipAudit;
  }>;
  summary: Readonly<{ introduced: number; resolved: number; persisting: number }>;
  introduced: readonly ZlozRelationshipAuditFinding[];
  resolved: readonly ZlozRelationshipAuditFinding[];
  persisting: readonly Readonly<{
    before: ZlozRelationshipAuditFinding;
    after: ZlozRelationshipAuditFinding;
  }>[];
}>;
export type ZlozRelationshipAuditComparisonDecision =
  | Readonly<{ type: 'compared'; comparison: ZlozRelationshipAuditComparison }>
  | Readonly<{
      type: 'blocked';
      code: 'unknown-baseline' | 'unknown-edition';
      editionId: string;
      reason: string;
    }>;

const findings = (audit: ZlozEventStormingRelationshipAudit) =>
  audit.entries.filter(
    (entry): entry is ZlozRelationshipAuditFinding => entry.status === 'blocked',
  );
const sameFinding = (
  before: ZlozRelationshipAuditFinding | undefined,
  after: ZlozRelationshipAuditFinding,
): boolean => before?.code === after.code;

/** ADR-0033: Compare blocked findings by edge ID and code under one convention, without editing history.
 * A changed code resolves the old finding and introduces the new one. Presentation/message changes
 * preserve identity; persisting findings retain both projections. No-new-findings is not compatibility. */
export function compareModelEventStormingRelationships(
  document: ZlozModelDocument,
  selection: ZlozRelationshipAuditSelection,
  options: ZlozEventStormingRelationshipOptions = {},
): ZlozRelationshipAuditComparisonDecision {
  checkedEventStormingRelationshipRules(options);
  const model = captureModelDocument(document);
  const baseline = model.editions.find((edition) => edition.id === selection.baselineId);
  if (!baseline)
    return {
      type: 'blocked',
      code: 'unknown-baseline',
      editionId: selection.baselineId,
      reason: 'The baseline edition is unavailable in this model.',
    };
  const selected =
    selection.selectedId === undefined
      ? null
      : model.editions.find((edition) => edition.id === selection.selectedId);
  if (selection.selectedId !== undefined && !selected)
    return {
      type: 'blocked',
      code: 'unknown-edition',
      editionId: selection.selectedId,
      reason: 'The selected edition is unavailable in this model.',
    };
  const before = auditEventStormingRelationships(baseline.snapshot.graph, options);
  const after = auditEventStormingRelationships(
    (selected?.snapshot ?? model.snapshot).graph,
    options,
  );
  const previous = new Map(findings(before).map((entry) => [entry.edgeId, entry]));
  const current = new Map(findings(after).map((entry) => [entry.edgeId, entry]));
  const introduced = [...current.values()].filter(
    (entry) => !sameFinding(previous.get(entry.edgeId), entry),
  );
  const resolved = [...previous.values()].filter(
    (entry) => !sameFinding(current.get(entry.edgeId), entry),
  );
  function persisted(after: ZlozRelationshipAuditFinding) {
    const before = previous.get(after.edgeId);
    return before && sameFinding(before, after) ? [{ before, after }] : [];
  }
  const persisting = [...current.values()].flatMap(persisted);
  return {
    type: 'compared',
    comparison: {
      modelId: model.id,
      status: introduced.length ? 'regressed' : 'no-new-findings',
      baseline: {
        source: { kind: 'edition', id: baseline.id, name: baseline.name },
        audit: before,
      },
      selected: {
        source: selected
          ? { kind: 'edition', id: selected.id, name: selected.name }
          : { kind: 'current' },
        audit: after,
      },
      summary: {
        introduced: introduced.length,
        resolved: resolved.length,
        persisting: persisting.length,
      },
      introduced,
      resolved,
      persisting,
    },
  };
}
