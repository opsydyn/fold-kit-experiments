/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/no-runtime-typeof -- This SDK-free object decoder is the parsing boundary: unknown records are validated before domain construction. */
import { ZlozError } from '@opsydyn/foldkit-zloz';

import {
  supportedAlchemyDomainVersion,
  type AlchemyDeclarationKind,
  type AlchemyDescriptor,
  type AlchemyDeclaration,
  type AlchemyRelationKind,
  type AlchemyRelation,
  type AlchemyIssue,
} from './types';
export class AlchemyAdapterError extends ZlozError {
  constructor(readonly issue: AlchemyIssue) {
    super('invalid-edit', issue.reason);
  }
}
export function reject(code: string, path: string, reason: string): never {
  throw new AlchemyAdapterError({ code, path, reason });
}
export function freezeData<T>(value: T): T {
  if (value instanceof Object) {
    for (const item of Object.values(value)) freezeData(item);
    Object.freeze(value);
  }
  return value;
}
const kinds = [
  'model',
  'aggregate',
  'command',
  'event',
  'view',
  'policy',
  'stream',
  'projection',
] as const;
const relationKinds = [
  'contains',
  'handles',
  'may-emit',
  'feeds',
  'observes-source',
  'reacts-to',
  'entry-type',
  'writes',
] as const;
function declarationKind(value: unknown): value is AlchemyDeclarationKind {
  return kinds.some((kind) => kind === value);
}
function relationKind(value: unknown): value is AlchemyRelationKind {
  return relationKinds.some((kind) => kind === value);
}
function dataRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === 'string' &&
        Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, 'value'),
    )
  );
}
function record(
  value: unknown,
  allowed: readonly string[],
  path: string,
): Readonly<Record<string, unknown>> {
  if (!dataRecord(value) || Object.getOwnPropertyNames(value).some((key) => !allowed.includes(key)))
    reject(
      'invalid-descriptor',
      path,
      'Expected a plain own-data record with only recognised fields.',
    );
  return value;
}
function text(value: unknown, path: string, max = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    reject('invalid-descriptor', path, `Expected a nonblank string of at most ${max} characters.`);
  for (const char of value) {
    const point = char.codePointAt(0);
    if (point !== undefined && point >= 0xd800 && point <= 0xdfff)
      reject('invalid-descriptor', path, 'Identity strings must contain well-formed Unicode.');
  }
  return value;
}
function rows(value: unknown, path: string, max: number): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    reject('resource-limit', path, `Expected a plain array with at most ${max} entries.`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).length !== value.length + 1 ||
    Object.values(descriptors).some((descriptor) => !('value' in descriptor))
  )
    reject('invalid-descriptor', path, 'Expected a dense own-data array without extra fields.');
  for (let i = 0; i < value.length; i++)
    if (!Object.hasOwn(value, String(i)))
      reject('invalid-descriptor', path, 'Sparse arrays are not portable descriptor data.');
  return value;
}
export function alchemySourceId(
  namespace: string,
  modelName: string,
  kind: AlchemyDeclarationKind,
  name: string,
): string {
  return [namespace, modelName, kind, name]
    .map((value) => encodeURIComponent(text(value, '/identity')))
    .join('/');
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Decode data objects, not raw text. No SDK, Schema AST, imported graph or authorisation fields. */
export function decodeAlchemyDescriptor(value: unknown): AlchemyDescriptor {
  const root = record(value, ['format', 'version', 'source', 'declarations', 'relations'], '');
  if (root.format !== 'foldkit-zloz-alchemy' || root.version !== 1)
    reject('unsupported-format', '/version', 'Expected foldkit-zloz-alchemy version 1.');
  const raw = record(
    root.source,
    ['packageVersion', 'namespace', 'modelName', 'revision'],
    '/source',
  );
  if (raw.packageVersion !== supportedAlchemyDomainVersion)
    reject(
      'unsupported-version',
      '/source/packageVersion',
      'Only the pinned beta.85 declaration format is qualified.',
    );
  const source: AlchemyDescriptor['source'] = {
    packageVersion: supportedAlchemyDomainVersion,
    namespace: text(raw.namespace, '/source/namespace'),
    modelName: text(raw.modelName, '/source/modelName'),
    revision: text(raw.revision, '/source/revision'),
  };
  const declarations: AlchemyDeclaration[] = [],
    ids = new Map<string, AlchemyDeclaration>(),
    locators = new Set<string>();
  for (const [i, item] of rows(root.declarations, '/declarations', 256).entries()) {
    const path = `/declarations/${i}`,
      d = record(item, ['id', 'locator', 'kind', 'name', 'viewState'], path);
    if (!declarationKind(d.kind))
      reject('invalid-descriptor', `${path}/kind`, 'Unknown declaration kind.');
    const id = text(d.id, `${path}/id`, 16384),
      locator = text(d.locator, `${path}/locator`, 16384),
      name = text(d.name, `${path}/name`);
    if (locator !== alchemySourceId(source.namespace, source.modelName, d.kind, name))
      reject(
        'invalid-identity',
        `${path}/locator`,
        'Locator does not match the declared namespace/model/kind/name.',
      );
    if (ids.has(id) || locators.has(locator))
      reject('identity-collision', path, 'Declaration IDs and locators must be unique.');
    let declaration: AlchemyDeclaration;
    if (d.kind === 'view') {
      if (d.viewState !== 'declared' && d.viewState !== 'absent')
        reject(
          'invalid-descriptor',
          `${path}/viewState`,
          'Views require an explicit declared/absent state-Schema claim.',
        );
      declaration = { id, locator, kind: d.kind, name, viewState: d.viewState };
    } else {
      if ('viewState' in d)
        reject('invalid-descriptor', `${path}/viewState`, 'Only views carry state-Schema claims.');
      declaration = { id, locator, kind: d.kind, name };
    }
    declarations.push(declaration);
    ids.set(id, declaration);
    locators.add(locator);
  }
  const models = declarations.filter((d) => d.kind === 'model');
  const model = models[0];
  if (models.length !== 1 || !model || model.name !== source.modelName)
    reject('invalid-model', '/declarations', 'Exactly one matching model declaration is required.');
  const relations: AlchemyRelation[] = [],
    edgeIds = new Set<string>(),
    members = new Set<string>();
  type RelationEndpoints = Readonly<
    Record<
      AlchemyRelationKind,
      readonly [readonly AlchemyDeclarationKind[], readonly AlchemyDeclarationKind[]]
    >
  >;
  const allowed: RelationEndpoints = {
    contains: [['model'], kinds.filter((k) => k !== 'model')],
    handles: [['aggregate'], ['command']],
    'may-emit': [['command', 'view'], ['event']],
    feeds: [
      ['aggregate', 'view'],
      ['view', 'projection'],
    ],
    'observes-source': [['aggregate', 'view'], ['policy']],
    'reacts-to': [['event'], ['policy']],
    'entry-type': [['event'], ['stream']],
    writes: [['projection'], ['stream']],
  };
  for (const [i, item] of rows(root.relations, '/relations', 1024).entries()) {
    const path = `/relations/${i}`,
      r = record(item, ['id', 'kind', 'source', 'target'], path);
    if (!relationKind(r.kind)) reject('invalid-relation', `${path}/kind`, 'Unknown relation kind.');
    const from = text(r.source, `${path}/source`, 16384),
      to = text(r.target, `${path}/target`, 16384),
      id = text(r.id, `${path}/id`, 65536);
    if (id !== JSON.stringify([r.kind, from, to]) || edgeIds.has(id))
      reject('invalid-identity', path, 'Relation identity must be canonical and unique.');
    const a = ids.get(from),
      b = ids.get(to);
    if (!a || !b) reject('missing-declaration', path, 'Both relation endpoints must exist.');
    if (!allowed[r.kind][0].includes(a.kind) || !allowed[r.kind][1].includes(b.kind))
      reject(
        'invalid-relation',
        path,
        'Relation endpoint kinds are incompatible with the declared topology.',
      );
    if (r.kind === 'contains') {
      if (from !== model.id || to === model.id || members.has(to))
        reject(
          'invalid-membership',
          path,
          'Only the model may own each non-model declaration once.',
        );
      members.add(to);
    }
    relations.push({ id, kind: r.kind, source: from, target: to });
    edgeIds.add(id);
  }
  if (members.size !== declarations.length - 1)
    reject(
      'invalid-membership',
      '/relations',
      'Every non-model declaration needs exactly one model membership.',
    );
  return freezeData({
    format: 'foldkit-zloz-alchemy',
    version: 1,
    source,
    declarations: declarations.sort((a, b) => compare(a.id, b.id)),
    relations: relations.sort((a, b) => compare(a.id, b.id)),
  });
}
export function serializeAlchemyDescriptor(value: AlchemyDescriptor): string {
  return JSON.stringify(decodeAlchemyDescriptor(value));
}
