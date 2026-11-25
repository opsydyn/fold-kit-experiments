import { captureGroupDocumentV3 } from '@opsydyn/foldkit-zloz';
import { generate } from 'likec4/generators/likec4';

const kinds = {
  person: 'person',
  'software-system': 'system',
  container: 'container',
  component: 'component',
};
const specification = {
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- LikeC4's public style field selects the Person glyph.
  elements: { person: { style: { shape: 'person' } }, system: {}, container: {}, component: {} },
  tags: { internal: {}, external: {} },
};
const compareId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
async function segment(id) {
  const bytes = new DataView(new ArrayBuffer(id.length * 2));
  for (let index = 0; index < id.length; index++)
    bytes.setUint16(index * 2, id.charCodeAt(index), true);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return (
    'z_' +
    Array.from(new Uint8Array(digest, 0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('')
  );
}
const rejected = (diagnostics) => ({ status: 'rejected', diagnostics });
const error = (code, subject, message) => ({ severity: 'error', code, subject, message });
const loss = (code, subject, message) => ({ severity: 'loss', code, subject, message });

/** Project a detached, validated core v3 C4 document into a reviewable LikeC4 bundle. */
export async function exportLikeC4(input, { lossPolicy = 'reject' } = {}) {
  if (lossPolicy !== 'reject' && lossPolicy !== 'report')
    return rejected([error('invalid-options', null, 'Choose reject or report for lossPolicy.')]);

  let document;
  // oxlint-disable-next-line linteffect/no-try-catch -- The headless core validator throws on invalid portable data.
  try {
    document = captureGroupDocumentV3(input);
  } catch (cause) {
    return rejected([error('invalid-document', null, String(cause))]);
  }

  const diagnostics = [];
  const nodes = document.graph.nodes.toSorted(compareId);
  const edges = document.graph.edges.toSorted(compareId);
  if (!nodes.length) return rejected([error('empty-model', null, 'Export requires a C4 element.')]);

  function projectText(value, subject, field, multiline = false) {
    if (value === undefined) return undefined;
    // LikeC4 normalizes whitespace and interprets string escape sequences.
    const normalized = (
      multiline ? value.replace(/\r\n?/g, '\n') : value.replace(/\r\n?|[\n\t]/g, ' ')
    ).trim();
    if (normalized !== value || normalized === '')
      diagnostics.push(loss('text-normalized', subject, `${field} is normalized by LikeC4.`));
    return normalized.replaceAll('\\', '\\\\');
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const aliases = new Map(
    await Promise.all(nodes.map(async (node) => [node.id, await segment(node.id)])),
  );
  if (new Set(aliases.values()).size !== nodes.length)
    return rejected([error('identity-collision', null, 'Two elements share a generated alias.')]);

  const fqns = new Map();
  for (const node of nodes) {
    const parents = [];
    let parent = node;
    while (parent && !fqns.has(parent.id)) {
      parents.push(parent.id);
      parent = nodesById.get(parent.parentId);
    }
    let path = parent ? fqns.get(parent.id) + '.' : '';
    for (const id of parents.reverse()) {
      fqns.set(id, path + aliases.get(id));
      path = fqns.get(id) + '.';
    }
  }

  const elements = nodes.flatMap((node) => {
    const { architecture, id } = node;
    if (architecture?.family !== 'c4') {
      diagnostics.push(error('unsupported-node', id, 'Every element needs an explicit C4 role.'));
      return [];
    }
    diagnostics.push(loss('layout', id, 'Canvas geometry and group movement rules are omitted.'));
    if (node.ports.length)
      diagnostics.push(loss('ports', id, 'Port identities are omitted from LikeC4 source.'));
    if (node.data !== undefined)
      diagnostics.push(loss('host-data', id, 'Host node data is omitted.'));
    if (node.icon) diagnostics.push(loss('icon', id, 'The selected node icon is omitted.'));
    if (node.appearance)
      diagnostics.push(loss('appearance', id, 'The authored node outline is omitted.'));
    return [
      {
        id: fqns.get(id),
        kind: kinds[architecture.role],
        title: projectText(node.label, id, 'Element title'),
        description: projectText(architecture.description, id, 'Description', true),
        technology: projectText(architecture.technology, id, 'Technology'),
        tags: architecture.scope ? [architecture.scope] : [],
      },
    ];
  });

  const seen = new Set();
  const relations = edges.map((edge) => {
    const source = fqns.get(edge.source.node);
    const target = fqns.get(edge.target.node);
    const title = projectText(edge.label, edge.id, 'Relationship title') ?? '';
    const key = JSON.stringify([source, target, title]);
    if (seen.has(key))
      diagnostics.push(
        error('ambiguous-relationship', edge.id, 'Parallel relationships need distinct labels.'),
      );
    seen.add(key);
    if (edge.data !== undefined)
      diagnostics.push(loss('host-data', edge.id, 'Host relationship data is omitted.'));
    if (edge.architecture)
      diagnostics.push(
        loss('edge-architecture', edge.id, 'ZLOZ relationship semantics are omitted.'),
      );
    if (edge.pathStyle || edge.waypoints)
      diagnostics.push(loss('layout', edge.id, 'Authored edge routing is omitted.'));
    return { source, target, title };
  });

  if (document.viewport) diagnostics.push(loss('layout', null, 'The authored camera is omitted.'));
  if (
    diagnostics.some((item) => item.severity === 'error') ||
    (lossPolicy === 'reject' && diagnostics.length)
  )
    return rejected(diagnostics);

  // oxlint-disable-next-line linteffect/no-try-catch -- Normalize failures from the synchronous LikeC4 generator.
  try {
    const source =
      generate({ specification, elements, relations }) +
      '\nviews {\n  view index {\n    include *\n  }\n}\n';
    return {
      status: 'converted',
      value: {
        protocol: 'foldkit-zloz-likec4/v1',
        source,
        identity: {
          connectionMode: document.connectionMode,
          groupPorts: document.capabilities.groupPorts,
          elements: nodes.map(({ id }) => ({ id, fqn: fqns.get(id) })),
          relationships: edges.map(({ id, source, target, label }) => ({
            id,
            source,
            target,
            title: label ?? '',
          })),
        },
        diagnostics,
      },
    };
  } catch (cause) {
    return rejected([...diagnostics, error('generation-failed', null, String(cause))]);
  }
}
