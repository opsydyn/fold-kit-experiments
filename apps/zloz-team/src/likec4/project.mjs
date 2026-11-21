import { groupDocumentV3Limits, parseGroupDocumentV3 } from '@opsydyn/foldkit-zloz';

const roles = new Map([
  ['person', 'person'],
  ['system', 'software-system'],
  ['container', 'container'],
  ['component', 'component'],
]);
// oxlint-disable-next-line anti-slop/no-runtime-typeof -- Narrow parsed JSON before inspecting keyed model fields.
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
// oxlint-disable-next-line anti-slop/no-runtime-typeof -- LikeC4 JSON fields need a string guard at the import boundary.
const string = (value) => typeof value === 'string';
const id = (value) => string(value) && value.trim().length > 0;
const own = (value, key) => (Object.hasOwn(value, key) ? value[key] : undefined);
const byId = (a, b) => (a.id < b.id ? -1 : Number(a.id > b.id));

class InvalidImport extends Error {
  constructor(code, subject, message) {
    super(message);
    this.code = code;
    this.subject = subject;
  }
}

function requireInput(condition, code, subject, message) {
  if (!condition) throw new InvalidImport(code, subject, message);
}

function indexViewNodes(view) {
  const index = new Map();
  for (const node of view.nodes) {
    requireInput(
      record(node) &&
        id(node.id) &&
        !index.has(node.id) &&
        (node.parent === null || id(node.parent)) &&
        (node.modelRef == null || id(node.modelRef)),
      'invalid-view',
      view.id,
      'Expected unique node IDs and valid parent and model references.',
    );
    index.set(node.id, node);
  }
  return index;
}

function resolveParent(node, index, note) {
  const seen = new Set([node.id]);
  let parentId = node.parent;
  let nearestModel;
  while (parentId !== null) {
    const parent = index.get(parentId);
    requireInput(parent && !seen.has(parentId), 'invalid-view', node.id, 'Invalid view hierarchy.');
    seen.add(parentId);
    nearestModel ??= parent.modelRef ?? undefined;
    parentId = parent.parent;
  }
  const authoredParent = node.modelRef.slice(0, node.modelRef.lastIndexOf('.')) || undefined;
  if (nearestModel !== authoredParent)
    note('containment', node.modelRef, 'Containment follows the selected view.');
  return nearestModel;
}

function importView(model, view) {
  const diagnostics = [];
  const note = (code, subject, message, severity = 'loss') =>
    diagnostics.push({ code, subject, message, severity });
  note(
    'view-presentation',
    view.id,
    'View rules, styles, edge routing and view overrides are omitted.',
  );
  const viewNodes = indexViewNodes(view);
  const nodes = new Map();
  const parents = new Set();

  for (const node of [...viewNodes.values()].sort(byId)) {
    if (!node.modelRef) {
      note('synthetic-node', node.id, 'View-only group is omitted.');
      continue;
    }
    const element = own(model.elements, node.modelRef);
    requireInput(
      record(element) &&
        element.id === node.modelRef &&
        id(element.kind) &&
        !nodes.has(element.id) &&
        (element.title === undefined || string(element.title)) &&
        (element.tags === undefined || (Array.isArray(element.tags) && element.tags.every(id))) &&
        (element.technology === undefined || string(element.technology)) &&
        [node.x, node.y, node.width, node.height].every(Number.isFinite) &&
        node.width > 0 &&
        node.height > 0,
      'invalid-element',
      node.id,
      'Expected one authored element with a finite positive view box.',
    );
    const parentId = resolveParent(node, viewNodes, note);
    if (parentId) parents.add(parentId);

    const role = roles.get(element.kind);
    const tags = element.tags ?? [];
    const scopeTags = tags.filter((tag) => tag === 'external' || tag === 'internal');
    const description = element.description?.txt ?? element.description?.md;
    const technology =
      role === 'container' || role === 'component' ? element.technology : undefined;
    const architecture = role
      ? {
          family: 'c4',
          role,
          scope: scopeTags.length === 1 ? scopeTags[0] : undefined,
          description: string(description) ? description : undefined,
          technology,
        }
      : undefined;
    if (!role)
      note('unmapped-kind', element.id, 'Custom LikeC4 kind is imported as an untyped node.');
    const omitted = [
      (scopeTags.length > 1 || tags.length !== scopeTags.length) && 'tags',
      element.description &&
        (!string(description) || element.description.md !== undefined || !role) &&
        'description formatting or content',
      element.technology !== technology && 'technology',
      element.icon && 'icon',
      element.links?.length && 'links',
      element.metadata && 'metadata',
    ].filter(Boolean);
    if (omitted.length)
      note('element-properties', element.id, `Element properties omitted: ${omitted.join(', ')}.`);

    nodes.set(element.id, {
      id: element.id,
      label: element.title ?? element.id,
      position: { x: node.x, y: node.y },
      size: { width: node.width, height: node.height },
      ports: [],
      parentId,
      architecture,
    });
  }

  const referenced = new Set();
  for (const edge of view.edges) {
    requireInput(
      record(edge) && id(edge.id) && Array.isArray(edge.relations) && edge.relations.every(id),
      'invalid-view',
      view.id,
      'Expected rendered edges with authored relationship references.',
    );
    if (edge.relations.length === 0) note('synthetic-edge', edge.id, 'View-only edge is omitted.');
    for (const relationId of edge.relations) referenced.add(relationId);
  }

  function endpoint(node, kind, side) {
    const port = 'likec4-' + kind;
    if (!node.ports.some((entry) => entry.id === port)) {
      node.ports.push({ id: port, kind, side, offset: 0.5 });
      note('generated-port', node.id, `Generated ${port} at the ${side} midpoint.`, 'info');
    }
    return { node: node.id, port };
  }

  const edges = [];
  for (const relationId of [...referenced].sort()) {
    const relation = own(model.relations, relationId);
    requireInput(
      record(relation) &&
        relation.id === relationId &&
        id(relation.source?.model) &&
        id(relation.target?.model) &&
        own(model.elements, relation.source.model) &&
        own(model.elements, relation.target.model) &&
        (relation.title == null || string(relation.title)),
      'invalid-relationship',
      relationId,
      'View references an invalid authored relationship.',
    );
    const source = nodes.get(relation.source.model);
    const target = nodes.get(relation.target.model);
    if (!source || !target) {
      note(
        'hidden-endpoint',
        relationId,
        'Authored relationship is omitted because an endpoint is outside the view.',
      );
      continue;
    }
    if (relation.isBidirectional)
      note(
        'bidirectional',
        relationId,
        'LikeC4 reverse arrow is omitted from the directed Zloz edge.',
      );
    const keptFields = ['id', 'source', 'target', 'title', 'isBidirectional'];
    const omitted = Object.keys(relation)
      .filter((key) => !keptFields.includes(key))
      .sort();
    if (omitted.length)
      note(
        'relationship-properties',
        relationId,
        `Relationship properties omitted: ${omitted.join(', ')}.`,
      );

    edges.push({
      id: relationId,
      source: endpoint(source, 'output', 'right'),
      target: endpoint(target, 'input', 'left'),
      label: relation.title ?? undefined,
    });
  }
  const projected = [...nodes.values()].map((node) =>
    parents.has(node.id) ? { ...node, kind: 'group' } : node,
  );
  return {
    diagnostics,
    document: {
      version: 3,
      coordinateSpace: 'world',
      connectionMode: 'strict',
      capabilities: {
        groupPorts: projected.some((node) => node.kind === 'group' && node.ports.length),
      },
      graph: { nodes: projected, edges },
    },
  };
}

/** Import one laid-out static view from a LikeC4 1.61 single-project JSON export. */
export function importLikeC4(text, viewId) {
  // oxlint-disable-next-line linteffect/no-try-catch -- Convert JSON syntax and selected view validation failures to import findings.
  try {
    requireInput(
      string(text) && text.length <= groupDocumentV3Limits.maxCharacters,
      'invalid-json',
      null,
      'Expected JSON text within the core character budget.',
    );
    const model = JSON.parse(text);
    requireInput(
      record(model) &&
        model._stage === 'layouted' &&
        record(model.views) &&
        record(model.elements) &&
        record(model.relations),
      'unsupported-model',
      null,
      'Expected one LikeC4 project exported with layout.',
    );
    const view = id(viewId) && own(model.views, viewId);
    requireInput(
      record(view) &&
        view.id === viewId &&
        view._type === 'element' &&
        view._stage === 'layouted' &&
        Array.isArray(view.nodes) &&
        Array.isArray(view.edges),
      'unsupported-view',
      viewId,
      'Choose one laid-out static element view.',
    );
    const { document, diagnostics } = importView(model, view);
    const parsed = parseGroupDocumentV3(JSON.stringify(document));
    requireInput(parsed.status === 'parsed', 'invalid-document', viewId, parsed.reason);
    return {
      status: 'converted',
      value: {
        protocol: 'foldkit-zloz-likec4-import/v1',
        viewId,
        document: parsed.value,
        diagnostics,
      },
    };
  } catch (error) {
    if (error instanceof SyntaxError)
      return {
        status: 'rejected',
        diagnostics: [
          { severity: 'error', code: 'invalid-json', subject: null, message: 'Invalid JSON.' },
        ],
      };
    if (error instanceof InvalidImport)
      return {
        status: 'rejected',
        diagnostics: [
          { severity: 'error', code: error.code, subject: error.subject, message: error.message },
        ],
      };
    throw error;
  }
}

/** List the supported views without inferring a selection. */
export function listLikeC4Views(text) {
  // oxlint-disable-next-line linteffect/no-try-catch -- Malformed local files yield an empty list at the JSON boundary.
  try {
    if (!string(text) || text.length > groupDocumentV3Limits.maxCharacters) return [];
    const model = JSON.parse(text);
    if (!record(model) || model._stage !== 'layouted' || !record(model.views)) return [];
    return Object.entries(model.views)
      .filter(
        ([key, view]) =>
          record(view) && key === view.id && view._type === 'element' && view._stage === 'layouted',
      )
      .map(([key]) => key)
      .sort();
  } catch {
    return [];
  }
}
