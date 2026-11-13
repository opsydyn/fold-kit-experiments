/** Trusted declaration inspection; optional SDK/Effect runtime entry. @module AlchemyDomain */
import * as Domain from '@alchemy.run/domain';
import { Result } from 'effect';

import { decodeAlchemyDescriptor, AlchemyAdapterError, freezeData, reject } from './descriptor';
import { projectAlchemyDescriptor } from './projection';
import {
  supportedAlchemyDomainVersion,
  type AlchemyDescriptor,
  type AlchemyDeclarationKind,
  type AlchemyDeclaration,
  type AlchemyRelation,
  type AlchemyFinding,
  type AlchemyProjection,
} from './types';
export type AlchemyInspectionOptions = Readonly<{
  namespace: string;
  revision: string;
  declaredPackageVersion: string;
  identityOverrides?: Readonly<Record<string, string>>;
  maxDeclarations?: number;
  maxRelations?: number;
}>;
export type AlchemyInspection =
  | Readonly<{ type: 'inspected'; descriptor: AlchemyDescriptor }>
  | Readonly<{ type: 'blocked'; findings: readonly AlchemyFinding[] }>;
function invalid(code: string, reason: string): never {
  return reject(code, '/inspection', reason);
}
type DeclarationOwner =
  | Domain.Model.Any
  | Domain.Aggregate.Any
  | Domain.Command.Any
  | Domain.Event.Any
  | Domain.View.Any
  | Domain.Policy.Any
  | Domain.Stream.Any
  | Domain.Projection.Any;
function text(value: string): string {
  if (!value.trim() || value.length > 256)
    invalid('invalid-input', 'Identity fields must contain 1–256 characters.');
  return value;
}
function sourceId(
  namespace: string,
  model: string,
  kind: AlchemyDeclarationKind,
  name: string,
): string {
  return [namespace, model, kind, name].map((x) => encodeURIComponent(text(x))).join('/');
}
function limit(value: number | undefined, fallback: number, cap: number): number {
  const n = value ?? fallback;
  if (!Number.isSafeInteger(n) || n < 1 || n > cap)
    invalid('invalid-input', `Limit must be an integer from 1 to ${cap}.`);
  return n;
}
function extract(model: Domain.Model.Any, options: AlchemyInspectionOptions): AlchemyDescriptor {
  const namespace = text(options.namespace),
    revision = text(options.revision),
    maxDeclarations = limit(options.maxDeclarations, 128, 256),
    maxRelations = limit(options.maxRelations, 512, 1024);
  const declarations = new Map<string, AlchemyDeclaration>(),
    owners = new Map<string, DeclarationOwner>(),
    locators = new Set<string>(),
    relations = new Map<string, AlchemyRelation>();
  const raw = (kind: AlchemyDeclarationKind, name: string) =>
    sourceId(namespace, model.modelName, kind, name);
  const resolved = (locator: string) => {
    const id = options.identityOverrides?.[locator] ?? locator;
    if (!id.trim() || id.length > 16384)
      invalid('invalid-input', 'Resolved identities must contain 1–16384 characters.');
    return id;
  };
  const identify = (kind: AlchemyDeclarationKind, name: string) => resolved(raw(kind, name));
  const add = (kind: AlchemyDeclarationKind, name: string, owner: DeclarationOwner) => {
    const locator = raw(kind, name),
      id = resolved(locator),
      prior = owners.get(id);
    if (prior && prior !== owner)
      invalid('identity-collision', `Distinct declarations resolve to ${id}.`);
    if (declarations.has(id) && declarations.get(id)?.locator !== locator)
      invalid('identity-collision', `Identity alias collides at ${id}.`);
    locators.add(locator);
    owners.set(id, owner);
    if (kind === 'view') declarations.set(id, { id, locator, kind, name, viewState: 'absent' });
    else declarations.set(id, { id, locator, kind, name });
    if (declarations.size > maxDeclarations)
      invalid('declaration-limit', 'The declaration budget was exceeded.');
    return id;
  };
  const relation = (kind: AlchemyRelation['kind'], source: string, target: string) => {
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
    const declaration = declarations.get(id);
    if (declaration?.kind === 'view')
      declarations.set(id, {
        ...declaration,
        viewState: view.definition.state === undefined ? 'absent' : 'declared',
      });
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
  return decodeAlchemyDescriptor({
    format: 'foldkit-zloz-alchemy',
    version: 1,
    source: {
      packageVersion: supportedAlchemyDomainVersion,
      namespace,
      modelName: model.modelName,
      revision,
    },
    declarations: [...declarations.values()],
    relations: [...relations.values()],
  });
}

function blocked(code: string, reason: string): AlchemyInspection {
  return freezeData({
    type: 'blocked',
    findings: [{ code, sourceId: null, severity: 'unsupported', reason }],
  });
}
/** No module loader, handlers, Layers, clients or provider calls. Version claim is caller supplied. */
export function inspectAlchemyModel(
  model: Domain.Model.Any,
  options: AlchemyInspectionOptions,
): AlchemyInspection {
  if (options.declaredPackageVersion !== supportedAlchemyDomainVersion)
    return blocked('unsupported-version', 'Only @alchemy.run/domain beta.85 is qualified.');
  return Result.match(
    Result.try({
      try: () => {
        const descriptor = extract(model, options);
        if (Domain.verify(model).length)
          return blocked('invalid-model', 'Pinned Domain static definition verification failed.');
        return freezeData({ type: 'inspected' as const, descriptor });
      },
      catch: (error) =>
        error instanceof AlchemyAdapterError
          ? { code: error.issue.code, reason: error.issue.reason }
          : {
              code: 'inspection-failed',
              reason: 'Trusted model inspection failed; no partial descriptor was returned.',
            },
    }),
    { onSuccess: (result) => result, onFailure: (error) => blocked(error.code, error.reason) },
  );
}
export function projectAlchemyModel(
  model: Domain.Model.Any,
  options: AlchemyInspectionOptions,
): AlchemyProjection {
  const inspected = inspectAlchemyModel(model, options);
  return inspected.type === 'blocked'
    ? freezeData({ ...inspected, source: null })
    : projectAlchemyDescriptor(inspected.descriptor);
}
