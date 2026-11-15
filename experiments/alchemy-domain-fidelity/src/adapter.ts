import * as Domain from '@alchemy.run/domain';
import {
  parseGraph,
  serializeGraph,
  resolveDeclaredConsumption,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';
import { Result } from 'effect';

import {
  extractDeclarations,
  mapDeclarations,
  sourceId,
  SpikeError,
  type ExtractionOptions,
  type Manifest,
  type Finding,
  type Mapping,
} from './index.js';
export const supportedAlchemyDomainVersion = '2.0.0-beta.85';
export type AlchemyProjectionOptions = ExtractionOptions &
  Readonly<{
    /** Trusted caller claim, checked exactly; not an authentication/installation-discovery mechanism. */
    declaredPackageVersion: string;
  }>;
export type AlchemyProjectionFinding =
  | Finding
  | Readonly<{
      sourceId: string | null;
      severity: 'unsupported' | 'loss';
      code: string;
      reason: string;
    }>;
export type AlchemyProjection = Readonly<{ findings: readonly AlchemyProjectionFinding[] }> &
  (
    | Readonly<{ type: 'blocked'; source: Manifest | null }>
    | Readonly<{
        type: 'reviewable';
        source: Manifest;
        graph: ZlozGraph;
        coverage: Mapping['coverage'];
        nativeReadModels: readonly Readonly<{ sourceId: string; basis: 'declared-state-schema' }>[];
        nativeConsumption: readonly string[];
      }>
  );
function frozen<T>(value: T): T {
  if (value instanceof Object) {
    for (const item of Object.values(value)) frozen(item);
    Object.freeze(value);
  }
  return value;
}
function blocked(code: string, reason: string, source: Manifest | null = null): AlchemyProjection {
  return frozen({
    type: 'blocked',
    source,
    findings: [{ sourceId: source?.modelId ?? null, severity: 'unsupported', code, reason }],
  });
}
/** Trusted declarations only. Read-only review projection: no loaders, handlers, Layers, clients or Apply. */
export function projectAlchemyModel(
  model: Domain.Model.Any,
  options: AlchemyProjectionOptions,
): AlchemyProjection {
  if (options.declaredPackageVersion !== supportedAlchemyDomainVersion)
    return blocked(
      'unsupported-version',
      `Only @alchemy.run/domain ${supportedAlchemyDomainVersion} is qualified for this candidate.`,
    );
  return Result.match(
    Result.try({
      try: () => {
        const source = extractDeclarations(model, options);
        if (Domain.verify(model).length !== 0)
          return blocked(
            'invalid-model',
            'The pinned Domain static definition check rejected this model.',
            source,
          );
        const mapped = mapDeclarations(source);
        if (mapped.type === 'blocked')
          return frozen({ type: 'blocked' as const, source, findings: mapped.findings });
        const nativeReadModels: Readonly<{ sourceId: string; basis: 'declared-state-schema' }>[] =
            [],
          extra: AlchemyProjectionFinding[] = [];
        for (const view of model.definitions.views) {
          const locator = sourceId(source.namespace, model.modelName, 'view', view.viewName),
            declaration = source.declarations.find((d) => d.locator === locator);
          if (!declaration)
            return blocked(
              'missing-declaration',
              'A view has no matching source declaration.',
              source,
            );
          if (view.definition.state !== undefined)
            nativeReadModels.push({ sourceId: declaration.id, basis: 'declared-state-schema' });
          else
            extra.push({
              sourceId: declaration.id,
              severity: 'loss',
              code: 'view-without-state',
              reason:
                'A stateless view is retained without a native read-model role; event-only behaviour is not a query representation.',
            });
        }
        nativeReadModels.sort((a, b) =>
          a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0,
        );
        extra.sort((a, b) =>
          (a.sourceId ?? '') < (b.sourceId ?? '')
            ? -1
            : (a.sourceId ?? '') > (b.sourceId ?? '')
              ? 1
              : 0,
        );
        const nativeIds = new Set(nativeReadModels.map((binding) => binding.sourceId));
        const nodes = mapped.graph.nodes.map((node) =>
          nativeIds.has(node.id)
            ? {
                ...node,
                label: source.declarations.find((d) => d.id === node.id)?.name ?? node.label,
                architecture: { family: 'ddd' as const, role: 'read-model' as const },
              }
            : node,
        );
        const graph = { nodes, edges: mapped.graph.edges },
          nativeConsumption: string[] = [];
        const edges = graph.edges.map((edge) => {
          const relation = source.relations.find((r) => r.id === edge.id);
          if (relation?.kind !== 'feeds' || !nativeIds.has(relation.target)) return edge;
          const decision = resolveDeclaredConsumption(graph, {
            sourceNodeId: relation.source,
            consumerNodeId: relation.target,
          });
          if (decision.type !== 'allowed') return edge;
          nativeConsumption.push(edge.id);
          return { ...edge, architecture: decision.relationship.architecture };
        });
        const feeds = new Set(nativeConsumption);
        const retained = mapped.findings.map((f) =>
          f.code === 'behaviour-unrepresented'
            ? {
                ...f,
                reason:
                  'Declaration topology only: command inputs/replies/rejections, event/state schemas, routing, handlers, sagas, external systems, APIs and runtime effects are outside this projection.',
              }
            : f,
        );
        const findings = [
          ...retained.filter(
            (f) =>
              !(f.code === 'role-unrepresented' && nativeIds.has(f.sourceId)) &&
              !(f.code === 'relationship-untyped' && feeds.has(f.sourceId)),
          ),
          ...extra,
        ];
        return frozen({
          type: 'reviewable' as const,
          source,
          graph: parseGraph(serializeGraph({ nodes, edges })),
          findings,
          coverage: mapped.coverage,
          nativeReadModels,
          nativeConsumption,
        });
      },
      catch: (error) =>
        error instanceof SpikeError
          ? { code: error.code, reason: error.reason }
          : {
              code: 'inspection-failed',
              reason: 'Trusted declaration inspection failed; no partial graph was returned.',
            },
    }),
    {
      onSuccess: (result) => result,
      onFailure: (error) => blocked(error.code, error.reason),
    },
  );
}
