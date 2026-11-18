import type { ZlozEdge } from '@opsydyn/foldkit-zloz';
import type { AssessmentRecord } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import type { DiagramFrame, DiagramTarget } from '@opsydyn/foldkit-zloz-alchemy/session';
import {
  evaluateCouplingAssessment,
  type ZlozCouplingIntegration,
  type ZlozCouplingResult,
} from '@opsydyn/foldkit-zloz/coupling';

export type CouplingCohort = Readonly<{
  key: string;
  modelVersion: string;
  abstraction: string;
  horizon: string;
}>;
type Relationship = Readonly<{
  relationshipId: string;
  relationship: ZlozEdge;
  sourceLabel: string;
  targetLabel: string;
}>;
type Recorded = Readonly<{
  record: AssessmentRecord;
  cohort: CouplingCohort;
  integrationType: ZlozCouplingIntegration | null;
}>;
type AssessedResult = Extract<ZlozCouplingResult, { status: 'balanced' | 'imbalanced' }>;
type RejectedResult = Extract<ZlozCouplingResult, { status: 'rejected' }>;
export type RecordedCouplingRow = Relationship &
  Recorded &
  (
    | Readonly<{
        state: 'complementary-balance';
        result: Extract<AssessedResult, { basis: 'complementary-dimensions' }>;
      }>
    | Readonly<{
        state: 'low-volatility-balance';
        result: Extract<AssessedResult, { basis: 'low-volatility' }>;
      }>
    | Readonly<{ state: 'imbalance'; result: Extract<AssessedResult, { status: 'imbalanced' }> }>
    | Readonly<{ state: 'unknown'; result: Extract<ZlozCouplingResult, { status: 'unassessed' }> }>
    | Readonly<{ state: 'stale' | 'invalid-binding'; result: RejectedResult }>
  );
export type CouplingRow = RecordedCouplingRow | (Relationship & Readonly<{ state: 'not-started' }>);
export type RemovedCouplingRow = Recorded & Readonly<{ state: 'removed'; relationshipId: string }>;
export type CouplingReadiness = Readonly<{
  total: number;
  'complementary-balance': number;
  'low-volatility-balance': number;
  imbalance: number;
  unknown: number;
  stale: number;
  'invalid-binding': number;
  'not-started': number;
}>;
export type CouplingProjection =
  | Readonly<{ status: 'waiting' }>
  | Readonly<{
      status: 'ready';
      stamp: Readonly<{ target: DiagramTarget; sourceVersion: number; graphVersion: number }>;
      rows: readonly CouplingRow[];
      readiness: CouplingReadiness;
      cohorts: readonly Readonly<{
        cohort: CouplingCohort;
        rows: readonly RecordedCouplingRow[];
        readiness: CouplingReadiness;
      }>[];
      removed: readonly RemovedCouplingRow[];
    }>;

// Taxonomy order is presentation, never a numeric strength/risk mapping.
const integrations = ['intrusive', 'functional', 'model', 'contract'] as const;
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
function recorded(record: AssessmentRecord): Recorded {
  const { modelVersion, scope, inputs } = record.assessment;
  return {
    record,
    cohort: {
      // A tuple encoding avoids collisions between free-text scope/horizon labels.
      key: JSON.stringify([modelVersion, scope.abstraction, scope.horizon]),
      modelVersion,
      abstraction: scope.abstraction,
      horizon: scope.horizon,
    },
    integrationType:
      inputs.integrationType.status === 'known' ? inputs.integrationType.value : null,
  };
}
function classify(
  relationship: Relationship,
  evidence: Recorded,
  result: ZlozCouplingResult,
): RecordedCouplingRow {
  const common = { ...relationship, ...evidence };
  switch (result.status) {
    case 'balanced':
      if (result.basis === 'complementary-dimensions')
        return { ...common, state: 'complementary-balance', result };
      return { ...common, state: 'low-volatility-balance', result };
    case 'imbalanced':
      return { ...common, state: 'imbalance', result };
    case 'unassessed':
      return { ...common, state: 'unknown', result };
    case 'rejected':
      return {
        ...common,
        state: result.code === 'graph-version-mismatch' ? 'stale' : 'invalid-binding',
        result,
      };
  }
}
function readiness(rows: readonly CouplingRow[]): CouplingReadiness {
  const counts = {
    total: rows.length,
    'complementary-balance': 0,
    'low-volatility-balance': 0,
    imbalance: 0,
    unknown: 0,
    stale: 0,
    'invalid-binding': 0,
    'not-started': 0,
  };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}
function taxonomy(row: CouplingRow | RemovedCouplingRow): number {
  if (row.state === 'not-started') return 5;
  if (row.integrationType === null) return 4;
  return integrations.indexOf(row.integrationType);
}
const compareRows = (a: CouplingRow | RemovedCouplingRow, b: CouplingRow | RemovedCouplingRow) =>
  taxonomy(a) - taxonomy(b) || compareText(a.relationshipId, b.relationshipId);
const compareCohorts = (a: CouplingCohort, b: CouplingCohort) =>
  compareText(a.modelVersion, b.modelVersion) ||
  compareText(a.abstraction, b.abstraction) ||
  compareText(a.horizon, b.horizon);

/** Read only the authorized, validated session.confirmed frame, never previews or drafts.
 * Existing editor/wire guards own frame validation. Null is not an empty/healthy graph.
 * No cache, IO, writes or scoring policy: the core evaluator remains authoritative.
 * Output references retain readonly evidence/edges; callers must not mutate input or output.
 */
export function projectCoupling(frame: DiagramFrame | null): CouplingProjection {
  if (frame === null) return { status: 'waiting' };
  const { graph, version } = frame.document;
  const context = { documentId: frame.target.diagramId, graphVersion: version, graph };
  const records = new Map(
    (frame.assessments ?? []).map((record) => [record.assessment.target.relationshipId, record]),
  );
  const labels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const rows: CouplingRow[] = graph.edges.map((edge) => {
    const relationship: Relationship = {
      relationshipId: edge.id,
      relationship: edge,
      sourceLabel: labels.get(edge.source.node) ?? edge.source.node,
      targetLabel: labels.get(edge.target.node) ?? edge.target.node,
    };
    const record = records.get(edge.id);
    if (!record) return { ...relationship, state: 'not-started' };
    return classify(
      relationship,
      recorded(record),
      evaluateCouplingAssessment(record.assessment, context),
    );
  });
  rows.sort(compareRows);
  const currentIds = new Set(graph.edges.map((edge) => edge.id));
  const removed: RemovedCouplingRow[] = (frame.assessments ?? [])
    .filter((record) => !currentIds.has(record.assessment.target.relationshipId))
    .map((record) => ({
      ...recorded(record),
      state: 'removed',
      relationshipId: record.assessment.target.relationshipId,
    }));
  removed.sort(compareRows);
  const groups = new Map<string, { cohort: CouplingCohort; rows: RecordedCouplingRow[] }>();
  for (const row of rows) {
    if (row.state === 'not-started') continue;
    const group = groups.get(row.cohort.key);
    if (group) group.rows.push(row);
    else groups.set(row.cohort.key, { cohort: row.cohort, rows: [row] });
  }
  return {
    status: 'ready',
    stamp: {
      target: { teamId: frame.target.teamId, diagramId: frame.target.diagramId },
      sourceVersion: frame.sourceVersion,
      graphVersion: version,
    },
    rows,
    readiness: readiness(rows),
    cohorts: [...groups.values()]
      .sort((a, b) => compareCohorts(a.cohort, b.cohort))
      .map((group) => ({ ...group, readiness: readiness(group.rows) })),
    removed,
  };
}
