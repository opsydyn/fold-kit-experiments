import {
  auditDddRelationships,
  type ZlozDddRelationshipAudit,
  type ZlozDddRelationshipAuditEntry,
} from './ddd-relationship-audit';
import { checkedDddRelationshipRules, type ZlozDddRelationshipOptions } from './ddd-relationships';
import { captureModelDocument, type ZlozModelDocument } from './model-document';

export type ZlozDddRelationshipAuditFinding = Extract<
  ZlozDddRelationshipAuditEntry,
  { status: 'blocked' }
>;
export type ZlozDddRelationshipAuditSource =
  | Readonly<{ kind: 'current' }>
  | Readonly<{ kind: 'edition'; id: string; name: string }>;
export type ZlozDddRelationshipAuditSelection = Readonly<{
  baselineId: string;
  /** Omit to compare against the current graph. IDs select only this model's owned editions. */
  selectedId?: string;
}>;
export type ZlozDddRelationshipAuditComparison = Readonly<{
  modelId: string;
  status: 'regressed' | 'no-new-findings';
  baseline: Readonly<{
    source: ZlozDddRelationshipAuditSource;
    audit: ZlozDddRelationshipAudit;
  }>;
  selected: Readonly<{
    source: ZlozDddRelationshipAuditSource;
    audit: ZlozDddRelationshipAudit;
  }>;
  summary: Readonly<{ introduced: number; resolved: number; persisting: number }>;
  introduced: readonly ZlozDddRelationshipAuditFinding[];
  resolved: readonly ZlozDddRelationshipAuditFinding[];
  persisting: readonly Readonly<{
    before: ZlozDddRelationshipAuditFinding;
    after: ZlozDddRelationshipAuditFinding;
  }>[];
}>;
export type ZlozDddRelationshipAuditComparisonDecision =
  | Readonly<{ type: 'compared'; comparison: ZlozDddRelationshipAuditComparison }>
  | Readonly<{
      type: 'blocked';
      code: 'unknown-baseline' | 'unknown-edition';
      editionId: string;
      reason: string;
    }>;

const findings = (audit: ZlozDddRelationshipAudit) =>
  audit.entries.filter(
    (entry): entry is ZlozDddRelationshipAuditFinding => entry.status === 'blocked',
  );
const sameFinding = (
  before: ZlozDddRelationshipAuditFinding | undefined,
  after: ZlozDddRelationshipAuditFinding,
): boolean => before?.code === after.code;

/** ADR 0080: Compare blocked findings by edge ID and code under one convention, without editing history.
 * A changed code resolves the old finding and introduces the new one. Presentation/message changes
 * preserve identity; persisting findings retain both projections. No-new-findings is not compatibility. */
export function compareModelDddRelationships(
  document: ZlozModelDocument,
  selection: ZlozDddRelationshipAuditSelection,
  options: ZlozDddRelationshipOptions = {},
): ZlozDddRelationshipAuditComparisonDecision {
  checkedDddRelationshipRules(options);
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
  const before = auditDddRelationships(baseline.snapshot.graph, options);
  const after = auditDddRelationships((selected?.snapshot ?? model.snapshot).graph, options);
  return compareDddRelationshipAudits(
    model.id,
    { kind: 'edition', id: baseline.id, name: baseline.name },
    selected ? { kind: 'edition', id: selected.id, name: selected.name } : { kind: 'current' },
    before,
    after,
  );
}
/** Internal domain delta over already validated checkpoints; contains no wire/mode inference. */
export function compareDddRelationshipAudits(
  modelId: string,
  baselineSource: ZlozDddRelationshipAuditSource,
  selectedSource: ZlozDddRelationshipAuditSource,
  before: ZlozDddRelationshipAudit,
  after: ZlozDddRelationshipAudit,
): ZlozDddRelationshipAuditComparisonDecision {
  const previous = new Map(findings(before).map((entry) => [entry.edgeId, entry]));
  const current = new Map(findings(after).map((entry) => [entry.edgeId, entry]));
  const introduced = [...current.values()].filter(
    (entry) => !sameFinding(previous.get(entry.edgeId), entry),
  );
  const resolved = [...previous.values()].filter(
    (entry) => !sameFinding(current.get(entry.edgeId), entry),
  );
  function persisted(after: ZlozDddRelationshipAuditFinding) {
    const before = previous.get(after.edgeId);
    return before && sameFinding(before, after) ? [{ before, after }] : [];
  }
  const persisting = [...current.values()].flatMap(persisted);
  return {
    type: 'compared',
    comparison: {
      modelId,
      status: introduced.length ? 'regressed' : 'no-new-findings',
      baseline: {
        source: baselineSource,
        audit: before,
      },
      selected: {
        source: selectedSource,
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
