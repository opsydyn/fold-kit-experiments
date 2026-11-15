import {
  parseConnectionDocument,
  serializeConnectionDocument,
  type ZlozConnectionDocument,
} from './connection-document';
import type { ZlozConnectionMode } from './connection-mode';
import {
  compareDddRelationshipAudits,
  type ZlozDddRelationshipAuditComparisonDecision,
  type ZlozDddRelationshipAuditComparison,
} from './ddd-audit-comparison';
import {
  auditDddGraphRelationships,
  type ZlozDddRelationshipAudit,
} from './ddd-relationship-audit';
import { checkedDddRelationshipRules } from './ddd-relationships';
import type { ZlozDddRelationshipOptions } from './ddd-relationships';
import { checkedEventStormingRelationshipRules } from './event-storming-relationships';
import type { ZlozEventStormingRelationshipOptions } from './event-storming-relationships';
import { captureModelDocumentV2, type ZlozModelDocumentV2 } from './model-document-v2';
import {
  auditEventStormingRelationships,
  type ZlozEventStormingRelationshipAudit,
} from './relationship-audit';
import {
  compareRelationshipAudits,
  type ZlozRelationshipAuditComparisonDecision,
  type ZlozRelationshipAuditComparison,
  type ZlozRelationshipAuditSelection,
} from './relationship-audit-comparison';
type WithModes<C extends { baseline: object; selected: object }> = Omit<
  C,
  'baseline' | 'selected'
> &
  Readonly<{
    baseline: C['baseline'] & Readonly<{ connectionMode: ZlozConnectionMode }>;
    selected: C['selected'] & Readonly<{ connectionMode: ZlozConnectionMode }>;
  }>;
export type ZlozDddRelationshipAuditComparisonV2 = WithModes<ZlozDddRelationshipAuditComparison>;
export type ZlozRelationshipAuditComparisonV2 = WithModes<ZlozRelationshipAuditComparison>;
export type ZlozDddRelationshipAuditComparisonDecisionV2 =
  | Exclude<ZlozDddRelationshipAuditComparisonDecision, { type: 'compared' }>
  | Readonly<{ type: 'compared'; comparison: ZlozDddRelationshipAuditComparisonV2 }>;
export type ZlozRelationshipAuditComparisonDecisionV2 =
  | Exclude<ZlozRelationshipAuditComparisonDecision, { type: 'compared' }>
  | Readonly<{ type: 'compared'; comparison: ZlozRelationshipAuditComparisonV2 }>;
export function auditConnectionDddRelationships(
  document: ZlozConnectionDocument,
  options: ZlozDddRelationshipOptions = {},
): ZlozDddRelationshipAudit {
  const checked = parseConnectionDocument(serializeConnectionDocument(document));
  return auditDddGraphRelationships(checked.graph, options);
}
export function auditConnectionEventStormingRelationships(
  document: ZlozConnectionDocument,
  options: ZlozEventStormingRelationshipOptions = {},
): ZlozEventStormingRelationshipAudit {
  const checked = parseConnectionDocument(serializeConnectionDocument(document));
  return auditEventStormingRelationships(checked.graph, options);
}
function select(model: ZlozModelDocumentV2, selection: ZlozRelationshipAuditSelection) {
  const baseline = model.editions.find((e) => e.id === selection.baselineId);
  if (!baseline)
    return {
      type: 'blocked' as const,
      code: 'unknown-baseline' as const,
      editionId: selection.baselineId,
      reason: 'The baseline edition is unavailable in this model.',
    };
  const selected =
    selection.selectedId === undefined
      ? null
      : model.editions.find((e) => e.id === selection.selectedId);
  if (selected === undefined)
    return {
      type: 'blocked' as const,
      code: 'unknown-edition' as const,
      editionId: selection.selectedId ?? '',
      reason: 'The selected edition is unavailable in this model.',
    };
  return {
    type: 'selected' as const,
    baseline,
    selected,
    before: baseline.snapshot,
    after: selected?.snapshot ?? model.snapshot,
    baselineSource: { kind: 'edition' as const, id: baseline.id, name: baseline.name },
    selectedSource: selected
      ? { kind: 'edition' as const, id: selected.id, name: selected.name }
      : { kind: 'current' as const },
  };
}
export function compareModelDddRelationshipsV2(
  document: ZlozModelDocumentV2,
  selection: ZlozRelationshipAuditSelection,
  options: ZlozDddRelationshipOptions = {},
): ZlozDddRelationshipAuditComparisonDecisionV2 {
  checkedDddRelationshipRules(options);
  const model = captureModelDocumentV2(document),
    sides = select(model, selection);
  if (sides.type === 'blocked') return sides;
  const result = compareDddRelationshipAudits(
    model.id,
    sides.baselineSource,
    sides.selectedSource,
    auditConnectionDddRelationships(sides.before, options),
    auditConnectionDddRelationships(sides.after, options),
  );
  return result.type === 'blocked'
    ? result
    : {
        type: 'compared',
        comparison: {
          ...result.comparison,
          baseline: { ...result.comparison.baseline, connectionMode: sides.before.connectionMode },
          selected: { ...result.comparison.selected, connectionMode: sides.after.connectionMode },
        },
      };
}
export function compareModelEventStormingRelationshipsV2(
  document: ZlozModelDocumentV2,
  selection: ZlozRelationshipAuditSelection,
  options: ZlozEventStormingRelationshipOptions = {},
): ZlozRelationshipAuditComparisonDecisionV2 {
  checkedEventStormingRelationshipRules(options);
  const model = captureModelDocumentV2(document),
    sides = select(model, selection);
  if (sides.type === 'blocked') return sides;
  const result = compareRelationshipAudits(
    model.id,
    sides.baselineSource,
    sides.selectedSource,
    auditConnectionEventStormingRelationships(sides.before, options),
    auditConnectionEventStormingRelationships(sides.after, options),
  );
  return result.type === 'blocked'
    ? result
    : {
        type: 'compared',
        comparison: {
          ...result.comparison,
          baseline: { ...result.comparison.baseline, connectionMode: sides.before.connectionMode },
          selected: { ...result.comparison.selected, connectionMode: sides.after.connectionMode },
        },
      };
}
