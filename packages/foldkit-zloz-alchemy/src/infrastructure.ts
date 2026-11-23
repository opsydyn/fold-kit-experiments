import {
  type JsonObject,
  type JsonValue,
  type ZlozGraph,
  type ZlozNode,
} from '@opsydyn/foldkit-zloz';

import { AlchemyTextError, parseAlchemyJson } from './json-text';

const actions = {
  create: 'Create',
  update: 'Update',
  adopted: 'Adopt',
  replace: 'Replace',
  delete: 'Delete',
  orphaned: 'Orphaned',
  noop: 'No change',
} as const;
type Resource = Readonly<{ id: string; type: string; action: keyof typeof actions }>;
type Link = Readonly<{ from: string; to: string }> &
  (Readonly<{ kind: 'dependency' }> | Readonly<{ kind: 'binding'; name: string }>);
type Omission = Readonly<{ resource: string; name: string; kind: 'binding' | 'dependency' }>;
export type InfrastructureSnapshot = Readonly<{
  format: 'foldkit-zloz-alchemy-infrastructure';
  version: 1;
  source: Readonly<{
    packageVersion: '2.0.0-beta.85';
    stack: string;
    stage: string;
    revision: string;
  }>;
  resources: readonly Resource[];
  links: readonly Link[];
  omissions: readonly Omission[];
}>;

const text = (value: JsonValue | undefined, max = 256): value is string =>
  typeof value === 'string' &&
  value.length <= max &&
  value.trim().length > 0 &&
  !/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value);
const fields = (value: JsonValue | undefined, keys: readonly string[]): value is JsonObject =>
  typeof value === 'object' &&
  value !== null &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const isSource = (value: JsonValue | undefined): value is InfrastructureSnapshot['source'] =>
  fields(value, ['stack', 'stage', 'revision', 'packageVersion']) &&
  value.packageVersion === '2.0.0-beta.85' &&
  text(value.stack, 120) &&
  text(value.stage, 60) &&
  text(value.revision, 80);
const isResource = (value: JsonValue | undefined): value is Resource =>
  fields(value, ['id', 'type', 'action']) &&
  text(value.id) &&
  text(value.type, 100) &&
  typeof value.action === 'string' &&
  Object.hasOwn(actions, value.action);
const isLink = (value: JsonValue | undefined): value is Link =>
  (fields(value, ['from', 'to', 'kind']) || fields(value, ['from', 'to', 'kind', 'name'])) &&
  text(value.from) &&
  text(value.to) &&
  (value.kind === 'binding'
    ? text(value.name)
    : value.kind === 'dependency' && !Object.hasOwn(value, 'name'));
const isOmission = (value: JsonValue | undefined): value is Omission =>
  fields(value, ['resource', 'name', 'kind']) &&
  text(value.resource) &&
  text(value.name) &&
  (value.kind === 'binding' || value.kind === 'dependency');
const linkId = (link: Link) =>
  JSON.stringify([link.from, link.to, link.kind, link.kind === 'binding' ? link.name : null]);

function snapshotOf(value: JsonValue): InfrastructureSnapshot | null {
  if (
    !fields(value, ['format', 'version', 'source', 'resources', 'links', 'omissions']) ||
    value.format !== 'foldkit-zloz-alchemy-infrastructure' ||
    value.version !== 1 ||
    !isSource(value.source) ||
    !Array.isArray(value.resources) ||
    value.resources.length < 1 ||
    value.resources.length > 256 ||
    !value.resources.every(isResource) ||
    !Array.isArray(value.links) ||
    value.links.length > 1024 ||
    !value.links.every(isLink) ||
    !Array.isArray(value.omissions) ||
    value.omissions.length > 512 ||
    !value.omissions.every(isOmission)
  )
    return null;
  const ids = new Set(value.resources.map(({ id }) => id));
  if (
    ids.size !== value.resources.length ||
    value.links.some(({ from, to }) => !ids.has(from) || !ids.has(to)) ||
    new Set(value.links.map(linkId)).size !== value.links.length ||
    value.omissions.some(({ resource }) => !ids.has(resource))
  )
    return null;
  return {
    format: value.format,
    version: value.version,
    source: value.source,
    resources: value.resources,
    links: value.links,
    omissions: value.omissions,
  };
}

function project(snapshot: InfrastructureSnapshot): ZlozGraph {
  const resources = [...snapshot.resources].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  const root = 'infrastructure';
  const source = snapshot.source;
  const nodes: ZlozNode[] = [
    {
      id: root,
      kind: 'group',
      label: `${source.stack} · ${source.stage} · ${source.revision}`,
      position: { x: 0, y: 0 },
      size: {
        width: Math.min(3, resources.length) * 340 + 32,
        height: Math.ceil(resources.length / 3) * 150 + 54,
      },
      ports: [],
      data: {
        alchemyInfrastructure: {
          ...source,
          omissions: snapshot.omissions.map(
            ({ resource, name, kind }) => `${resource} · unresolved ${kind} · ${name}`,
          ),
        },
      },
    },
  ];
  resources.forEach((resource, index) =>
    nodes.push({
      id: `resource:${resource.id}`,
      parentId: root,
      label: `${resource.id} · ${actions[resource.action]}`,
      position: { x: 32 + (index % 3) * 340, y: 52 + Math.floor(index / 3) * 150 },
      size: { width: 300, height: 84 },
      ports: [
        { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
        { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
      ],
      data: {
        alchemyInfrastructure: {
          ...source,
          ...resource,
          action: actions[resource.action],
          omissions: snapshot.omissions
            .filter(({ resource: id }) => id === resource.id)
            .map(({ name, kind }) => `Unresolved ${kind} · ${name}`),
        },
      },
    }),
  );
  return {
    nodes,
    edges: snapshot.links.map((link) => ({
      id: linkId(link),
      source: { node: `resource:${link.from}`, port: 'out' },
      target: { node: `resource:${link.to}`, port: 'in' },
      label: link.kind === 'binding' ? `Binds to · ${link.name}` : 'Depends on',
    })),
  };
}

export function readInfrastructureSnapshot(source: string) {
  // oxlint-disable-next-line linteffect/no-try-catch -- Turn malformed portable JSON into a detached import result.
  try {
    const snapshot = snapshotOf(parseAlchemyJson(source));
    if (!snapshot)
      return {
        status: 'blocked' as const,
        message:
          'Invalid Alchemy infrastructure snapshot v1. Check the source, resource IDs and relationship endpoints.',
      };
    return {
      status: 'reviewable' as const,
      snapshot,
      graph: project(snapshot),
      findings: snapshot.omissions.map(({ resource, name, kind }) => ({
        resource,
        message:
          kind === 'binding'
            ? `Binding ${name} has no resolved target in the snapshot.`
            : `Dependency ${name} is outside the snapshot.`,
      })),
    };
  } catch (error) {
    return {
      status: 'blocked' as const,
      message: error instanceof AlchemyTextError ? error.message : 'Invalid snapshot JSON.',
    };
  }
}
