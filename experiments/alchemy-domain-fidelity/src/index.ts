import type * as Domain from '@alchemy.run/domain';
import {
  parseGraph,
  serializeGraph,
  type ZlozGraph,
  type ZlozNode,
  type ZlozNodeArchitecture,
  type ZlozEdge,
} from '@opsydyn/foldkit-zloz';
import { Data } from 'effect';
export class SpikeError extends Data.TaggedError('AlchemyDeclarationSpikeError')<{
  readonly code: string;
  readonly reason: string;
}> {}
export type Kind =
  | 'model'
  | 'aggregate'
  | 'command'
  | 'event'
  | 'view'
  | 'policy'
  | 'stream'
  | 'projection';
type DeclarationOwner =
  | Domain.Model.Any
  | Domain.Aggregate.Any
  | Domain.Command.Any
  | Domain.Event.Any
  | Domain.View.Any
  | Domain.Policy.Any
  | Domain.Stream.Any
  | Domain.Projection.Any;
export type Declaration = Readonly<{ id: string; locator: string; kind: Kind; name: string }>;
export type Relation = Readonly<{
  id: string;
  kind:
    | 'contains'
    | 'handles'
    | 'may-emit'
    | 'feeds'
    | 'observes-source'
    | 'reacts-to'
    | 'entry-type'
    | 'writes';
  source: string;
  target: string;
}>;
export type Finding = Readonly<{
  sourceId: string;
  code:
    | 'behaviour-unrepresented'
    | 'role-unrepresented'
    | 'relationship-untyped'
    | 'missing-declaration';
  severity: 'unverified' | 'loss' | 'unsupported';
  reason: string;
}>;
export type Manifest = Readonly<{
  format: 'zloz-alchemy-declarations';
  version: 1;
  upstream: Readonly<{ package: '@alchemy.run/domain'; version: '2.0.0-beta.85' }>;
  namespace: string;
  revision: string;
  modelId: string;
  declarations: readonly Declaration[];
  relations: readonly Relation[];
  findings: readonly Finding[];
}>;
export type ExtractionOptions = Readonly<{
  namespace: string;
  revision: string;
  identityOverrides?: Readonly<Record<string, string>>;
  maxDeclarations?: number;
  maxRelations?: number;
}>;
export type Mapping = Readonly<{
  source: Manifest;
  findings: readonly Finding[];
  coverage: readonly Readonly<{ sourceId: string; representation: 'node' | 'parent' | 'edge' }>[];
}> &
  (Readonly<{ type: 'mapped'; graph: ZlozGraph }> | Readonly<{ type: 'blocked' }>);
function invalid(code: string, reason: string): never {
  throw new SpikeError({ code, reason });
}
function text(value: string): string {
  if (!value.trim() || value.length > 256)
    invalid('invalid-input', 'Identity fields must contain 1–256 characters.');
  return value;
}
export function sourceId(namespace: string, model: string, kind: Kind, name: string): string {
  return [namespace, model, kind, name].map((x) => encodeURIComponent(text(x))).join('/');
}
function limit(value: number | undefined, fallback: number, cap: number): number {
  const n = value ?? fallback;
  if (!Number.isSafeInteger(n) || n < 1 || n > cap)
    invalid('invalid-input', `Limit must be an integer from 1 to ${cap}.`);
  return n;
}
function frozen<T>(value: T): T {
  if (value instanceof Object) {
    for (const item of Object.values(value)) frozen(item);
    Object.freeze(value);
  }
  return value;
}
const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Trusted already-loaded declarations only; no source-module loading, handlers, schemas or runtime services. */
export function extractDeclarations(model: Domain.Model.Any, options: ExtractionOptions): Manifest {
  const namespace = text(options.namespace),
    revision = text(options.revision),
    maxDeclarations = limit(options.maxDeclarations, 128, 256),
    maxRelations = limit(options.maxRelations, 512, 1024);
  const declarations = new Map<string, Declaration>(),
    owners = new Map<string, DeclarationOwner>(),
    locators = new Set<string>(),
    relations = new Map<string, Relation>();
  const raw = (kind: Kind, name: string) => sourceId(namespace, model.modelName, kind, name);
  const resolved = (locator: string) => {
    const id = options.identityOverrides?.[locator] ?? locator;
    if (!id.trim() || id.length > 16384)
      invalid('invalid-input', 'Resolved identities must contain 1–16384 characters.');
    return id;
  };
  const identify = (kind: Kind, name: string) => resolved(raw(kind, name));
  const add = (kind: Kind, name: string, owner: DeclarationOwner) => {
    const locator = raw(kind, name),
      id = resolved(locator),
      prior = owners.get(id);
    if (prior && prior !== owner)
      invalid('identity-collision', `Distinct declarations resolve to ${id}.`);
    if (declarations.has(id) && declarations.get(id)?.locator !== locator)
      invalid('identity-collision', `Identity alias collides at ${id}.`);
    locators.add(locator);
    owners.set(id, owner);
    declarations.set(id, { id, locator, kind, name });
    if (declarations.size > maxDeclarations)
      invalid('declaration-limit', 'The declaration budget was exceeded.');
    return id;
  };
  const relation = (kind: Relation['kind'], source: string, target: string) => {
    const id = JSON.stringify([kind, source, target]);
    relations.set(id, { id, kind, source, target });
    if (relations.size > maxRelations)
      invalid('relation-limit', 'The relation budget was exceeded.');
  };
  const source = (value: Domain.Aggregate.Any | Domain.View.Any) =>
    value.kind === 'Aggregate'
      ? identify('aggregate', value.aggregateName)
      : identify('view', value.viewName);
  const modelId = add('model', model.modelName, model);
  // Definition containers are public in the pinned Model.Any; no Kernel/Internals import.
  for (const aggregate of model.definitions.aggregates) {
    const id = add('aggregate', aggregate.aggregateName, aggregate);
    for (const command of aggregate.definition.commands) {
      const cmd = add('command', command.tag, command);
      relation('handles', id, cmd);
      for (const event of command.events) relation('may-emit', cmd, add('event', event.tag, event));
    }
  }
  for (const view of model.definitions.views) {
    const id = add('view', view.viewName, view);
    for (const from of view.definition.from) relation('feeds', source(from), id);
    for (const event of view.definition.events ?? [])
      relation('may-emit', id, add('event', event.tag, event));
  }
  for (const policy of model.definitions.policies) {
    const id = add('policy', policy.policyName, policy),
      from = policy.definition.from;
    for (const item of Array.isArray(from) ? from : [from])
      relation('observes-source', source(item), id);
    for (const event of policy.definition.on)
      relation('reacts-to', add('event', event.tag, event), id);
  }
  for (const stream of model.definitions.streams) {
    const id = add('stream', stream.streamName, stream);
    for (const event of stream.definition.entries)
      relation('entry-type', add('event', event.tag, event), id);
  }
  for (const projection of model.definitions.projections) {
    const id = add('projection', projection.projectionName, projection);
    for (const from of projection.definition.from) relation('feeds', source(from), id);
    for (const stream of projection.definition.writes ?? [])
      relation('writes', id, identify('stream', stream.streamName));
  }
  for (const declaration of declarations.values())
    if (declaration.id !== modelId) relation('contains', modelId, declaration.id);
  for (const key of Object.keys(options.identityOverrides ?? {}))
    if (!locators.has(key))
      invalid('unknown-identity-override', `No declaration matches alias ${key}.`);
  return frozen({
    format: 'zloz-alchemy-declarations',
    version: 1,
    upstream: { package: '@alchemy.run/domain', version: '2.0.0-beta.85' },
    namespace,
    revision,
    modelId,
    declarations: [...declarations.values()].sort((a, b) => order(a.id, b.id)),
    relations: [...relations.values()].sort((a, b) => order(a.id, b.id)),
    findings: [
      {
        sourceId: modelId,
        code: 'behaviour-unrepresented',
        severity: 'unverified',
        reason:
          'Declaration types only: handlers, state schemas, key routing, sagas, external systems, APIs and runtime effects are outside this projection.',
      },
    ],
  });
}
const semantics = {
  model: { family: 'ddd', role: 'bounded-context' },
  aggregate: { family: 'ddd', role: 'aggregate-root' },
  event: { family: 'ddd', role: 'domain-event' },
  command: { family: 'event-storming', role: 'command' },
  policy: { family: 'event-storming', role: 'policy' },
  view: undefined,
  stream: undefined,
  projection: undefined,
} as const satisfies Readonly<Record<Kind, ZlozNodeArchitecture | undefined>>;
/** Experiment-only typed manifest input; not an untrusted JSON decoder or production adapter contract. */
export function mapDeclarations(source: Manifest): Mapping {
  const findings: Finding[] = [...source.findings],
    coverage: Mapping['coverage'][number][] = [];
  const ids = new Set(source.declarations.map((d) => d.id));
  for (const relation of source.relations)
    if (!ids.has(relation.source) || !ids.has(relation.target))
      findings.push({
        sourceId: relation.id,
        code: 'missing-declaration',
        severity: 'unsupported',
        reason: 'A relation references a declaration absent from this model manifest.',
      });
  if (findings.some((f) => f.severity === 'unsupported'))
    return frozen({ type: 'blocked', source, findings, coverage });
  let index = 0;
  const nodes: ZlozNode[] = source.declarations.map((d) => {
    const architecture = semantics[d.kind],
      group = d.id === source.modelId;
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
      ...(group ? { kind: 'group' as const } : { parentId: source.modelId }),
      data: {
        alchemy: {
          sourceId: d.id,
          locator: d.locator,
          kind: d.kind,
          packageVersion: source.upstream.version,
        },
      },
    };
    const node: ZlozNode = architecture === undefined ? base : { ...base, architecture };
    coverage.push({ sourceId: d.id, representation: 'node' });
    if (!architecture)
      findings.push({
        sourceId: d.id,
        code: 'role-unrepresented',
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
    edges.push({
      id: r.id,
      source: { node: r.source, port: 'out' },
      target: { node: r.target, port: 'in' },
      label: r.kind,
      data: { alchemy: { sourceId: r.id, kind: r.kind } },
    });
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
  return frozen({ type: 'mapped', source, graph, findings, coverage });
}
