import {
  selectAuditSnapshots,
  type ZlozDddRelationshipAuditComparisonDecisionV2,
  type ZlozDddRelationshipAuditComparisonV2,
  type ZlozRelationshipAuditComparisonV2,
  type ZlozRelationshipAuditComparisonDecisionV2,
} from './audit-v2';
import { compareDddRelationshipAudits } from './ddd-audit-comparison';
import {
  auditDddGraphRelationships,
  type ZlozDddRelationshipAudit,
} from './ddd-relationship-audit';
import { checkedDddRelationshipRules, type ZlozDddRelationshipOptions } from './ddd-relationships';
import {
  checkedEventStormingRelationshipRules,
  type ZlozEventStormingRelationshipOptions,
} from './event-storming-relationships';
import { captureGroupDocumentV3, type ZlozGroupDocumentV3 } from './group-document-v3';
import { captureModelDocumentV3, type ZlozModelDocumentV3 } from './model-document-v3';
import {
  auditEventStormingRelationships,
  type ZlozEventStormingRelationshipAudit,
} from './relationship-audit';
import {
  compareRelationshipAudits,
  type ZlozRelationshipAuditSelection,
} from './relationship-audit-comparison';
type NativeSides<C extends { baseline: object; selected: object }> = Omit<
  C,
  'baseline' | 'selected'
> &
  Readonly<{
    baseline: C['baseline'] &
      Readonly<{ coordinateSpace: 'world'; capabilities: ZlozGroupDocumentV3['capabilities'] }>;
    selected: C['selected'] &
      Readonly<{ coordinateSpace: 'world'; capabilities: ZlozGroupDocumentV3['capabilities'] }>;
  }>;
export type ZlozDddRelationshipAuditComparisonV3 =
  NativeSides<ZlozDddRelationshipAuditComparisonV2>;
export type ZlozRelationshipAuditComparisonV3 = NativeSides<ZlozRelationshipAuditComparisonV2>;
export type ZlozDddRelationshipAuditComparisonDecisionV3 =
  | Exclude<ZlozDddRelationshipAuditComparisonDecisionV2, { type: 'compared' }>
  | Readonly<{ type: 'compared'; comparison: ZlozDddRelationshipAuditComparisonV3 }>;
export type ZlozRelationshipAuditComparisonDecisionV3 =
  | Exclude<ZlozRelationshipAuditComparisonDecisionV2, { type: 'compared' }>
  | Readonly<{ type: 'compared'; comparison: ZlozRelationshipAuditComparisonV3 }>;
export function auditGroupDddRelationshipsV3(
  document: ZlozGroupDocumentV3,
  options: ZlozDddRelationshipOptions = {},
): ZlozDddRelationshipAudit {
  return auditDddGraphRelationships(captureGroupDocumentV3(document).graph, options);
}
export function auditGroupEventStormingRelationshipsV3(
  document: ZlozGroupDocumentV3,
  options: ZlozEventStormingRelationshipOptions = {},
): ZlozEventStormingRelationshipAudit {
  return auditEventStormingRelationships(captureGroupDocumentV3(document).graph, options);
}
export function compareModelDddRelationshipsV3(
  document: ZlozModelDocumentV3,
  selection: ZlozRelationshipAuditSelection,
  options: ZlozDddRelationshipOptions = {},
): ZlozDddRelationshipAuditComparisonDecisionV3 {
  checkedDddRelationshipRules(options);
  const model = captureModelDocumentV3(document),
    sides = selectAuditSnapshots(model, selection);
  if (sides.type === 'blocked') return sides;
  const result = compareDddRelationshipAudits(
    model.id,
    sides.baselineSource,
    sides.selectedSource,
    auditGroupDddRelationshipsV3(sides.before, options),
    auditGroupDddRelationshipsV3(sides.after, options),
  );
  return result.type === 'blocked'
    ? result
    : {
        type: 'compared',
        comparison: {
          ...result.comparison,
          baseline: {
            ...result.comparison.baseline,
            connectionMode: sides.before.connectionMode,
            coordinateSpace: sides.before.coordinateSpace,
            capabilities: sides.before.capabilities,
          },
          selected: {
            ...result.comparison.selected,
            connectionMode: sides.after.connectionMode,
            coordinateSpace: sides.after.coordinateSpace,
            capabilities: sides.after.capabilities,
          },
        },
      };
}
export function compareModelEventStormingRelationshipsV3(
  document: ZlozModelDocumentV3,
  selection: ZlozRelationshipAuditSelection,
  options: ZlozEventStormingRelationshipOptions = {},
): ZlozRelationshipAuditComparisonDecisionV3 {
  checkedEventStormingRelationshipRules(options);
  const model = captureModelDocumentV3(document),
    sides = selectAuditSnapshots(model, selection);
  if (sides.type === 'blocked') return sides;
  const result = compareRelationshipAudits(
    model.id,
    sides.baselineSource,
    sides.selectedSource,
    auditGroupEventStormingRelationshipsV3(sides.before, options),
    auditGroupEventStormingRelationshipsV3(sides.after, options),
  );
  return result.type === 'blocked'
    ? result
    : {
        type: 'compared',
        comparison: {
          ...result.comparison,
          baseline: {
            ...result.comparison.baseline,
            connectionMode: sides.before.connectionMode,
            coordinateSpace: sides.before.coordinateSpace,
            capabilities: sides.before.capabilities,
          },
          selected: {
            ...result.comparison.selected,
            connectionMode: sides.after.connectionMode,
            coordinateSpace: sides.after.coordinateSpace,
            capabilities: sides.after.capabilities,
          },
        },
      };
}
