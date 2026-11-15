import {
  parseGraph,
  serializeGraph,
  resolveDeclaredConsumption,
  type ZlozNodeArchitecture,
  type ZlozNode,
  type ZlozEdge,
} from '@opsydyn/foldkit-zloz';

import { decodeAlchemyDescriptor, freezeData, AlchemyAdapterError } from './descriptor';
import type {
  AlchemyDescriptor,
  AlchemyDeclarationKind,
  AlchemyFinding,
  AlchemyProjection,
} from './types';
const semantics = {
  model: { family: 'ddd', role: 'bounded-context' },
  aggregate: { family: 'ddd', role: 'aggregate-root' },
  event: { family: 'ddd', role: 'domain-event' },
  command: { family: 'event-storming', role: 'command' },
  policy: { family: 'event-storming', role: 'policy' },
  view: undefined,
  stream: undefined,
  projection: undefined,
} as const satisfies Readonly<Record<AlchemyDeclarationKind, ZlozNodeArchitecture | undefined>>;
/** Projection over freshly decoded data; never an editor permission check. */
function project(source: AlchemyDescriptor): AlchemyProjection {
  const model = source.declarations.find((d) => d.kind === 'model');
  if (!model)
    throw new AlchemyAdapterError({
      code: 'invalid-model',
      path: '/declarations',
      reason: 'Missing model declaration.',
    });
  const nativeReadModels: Readonly<{ sourceId: string; basis: 'declared-state-schema' }>[] = [];
  const nativeConsumption: string[] = [];
  const findings: AlchemyFinding[] = [
    {
      sourceId: model.id,
      code: 'behaviour-unrepresented',
      severity: 'unverified',
      reason:
        'Portable declarations are host-authored assertions: no authenticated definition verification, command inputs/replies/rejections, schemas, handlers, routing, sagas, APIs or runtime effects are established.',
    },
  ];
  const coverage: { sourceId: string; representation: 'node' | 'parent' | 'edge' }[] = [];
  let index = 0;
  const nodes: ZlozNode[] = source.declarations.map((d) => {
    const architecture =
        d.kind === 'view' && d.viewState === 'declared'
          ? { family: 'ddd' as const, role: 'read-model' as const }
          : semantics[d.kind],
      group = d.id === model.id;
    const slot = group ? 0 : index++;
    const base: ZlozNode = {
      id: d.id,
      label: architecture ? d.name : `${d.name} (${d.kind}; untyped)`,
      position: group
        ? { x: 0, y: 0 }
        : { x: 40 + (slot % 3) * 260, y: 80 + Math.floor(slot / 3) * 150 },
      size: group
        ? {
            width: 820,
            height: Math.max(260, 130 + Math.ceil((source.declarations.length - 1) / 3) * 150),
          }
        : { width: 220, height: 100 },
      ports: group
        ? []
        : [
            { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
            { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
          ],
      ...(group ? { kind: 'group' as const } : { parentId: model.id }),
      data: {
        alchemy: {
          sourceId: d.id,
          locator: d.locator,
          kind: d.kind,
          packageVersion: source.source.packageVersion,
        },
      },
    };
    const node: ZlozNode = architecture === undefined ? base : { ...base, architecture };
    if (d.kind === 'view' && d.viewState === 'declared')
      nativeReadModels.push({ sourceId: d.id, basis: 'declared-state-schema' });
    coverage.push({ sourceId: d.id, representation: 'node' });
    if (!architecture)
      findings.push({
        sourceId: d.id,
        code: d.kind === 'view' ? 'view-without-state' : 'role-unrepresented',
        severity: 'loss',
        reason: `${d.kind} has no equivalent native Zloz role; retained as an explicitly untyped declaration node.`,
      });
    return node;
  });
  const edges: ZlozEdge[] = [];
  for (const r of source.relations) {
    if (r.kind === 'contains') {
      coverage.push({ sourceId: r.id, representation: 'parent' });
      continue;
    }
    const decision =
      r.kind === 'feeds'
        ? resolveDeclaredConsumption(
            { nodes, edges: [] },
            { sourceNodeId: r.source, consumerNodeId: r.target },
          )
        : null;
    const architecture =
      decision?.type === 'allowed' ? decision.relationship.architecture : undefined;
    if (architecture) nativeConsumption.push(r.id);
    const base: ZlozEdge = {
      id: r.id,
      source: { node: r.source, port: 'out' },
      target: { node: r.target, port: 'in' },
      label: r.kind,
      data: { alchemy: { sourceId: r.id, kind: r.kind } },
    };
    edges.push(architecture === undefined ? base : { ...base, architecture });
    if (!architecture)
      findings.push({
        sourceId: r.id,
        code: 'relationship-untyped',
        severity: 'loss',
        reason:
          'The declared relation is retained as a labelled, source-linked edge without claiming a native semantic edge role or handler behaviour.',
      });
    coverage.push({ sourceId: r.id, representation: 'edge' });
  }
  const graph = parseGraph(serializeGraph({ nodes, edges }));
  return freezeData({
    type: 'reviewable',
    source,
    graph,
    findings,
    coverage,
    nativeReadModels,
    nativeConsumption,
  });
}

/** Unknown data is validated on every call. Imported graphs/findings never control the result. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Public portable boundary delegates unknown data to the strict descriptor decoder before projection.
export function projectAlchemyDescriptor(value: unknown): AlchemyProjection {
  // oxlint-disable-next-line linteffect/no-try-catch -- Portable untrusted-data boundary converts expected validation and native representation failures into a blocked result; no SDK/Effect runtime is imported.
  try {
    return project(decodeAlchemyDescriptor(value));
  } catch (error) {
    return freezeData({
      type: 'blocked',
      source: null,
      findings: [
        {
          code: error instanceof AlchemyAdapterError ? error.issue.code : 'invalid-descriptor',
          sourceId: null,
          severity: 'unsupported',
          reason:
            error instanceof AlchemyAdapterError
              ? error.issue.reason
              : 'Descriptor validation failed.',
        },
      ],
    });
  }
}
