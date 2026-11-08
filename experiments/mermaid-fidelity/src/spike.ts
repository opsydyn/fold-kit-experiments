/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Shapes are authored graph outlines in this qualification prototype. */
import {
  validateGraph,
  type FlowGraph,
  type FlowNode,
  type FlowNodeShape,
  type Port,
} from '@opsydyn/foldkit-flow';
import { Schema } from 'effect';
import { parseFlowchart } from 'mermaid-ast/parser';
import type { FlowchartAST, FlowchartDirection } from 'mermaid-ast/types';

export const protocol = 'mermaid-fidelity-spike/v1';
export const sourceLimit = 32768;
export type LossPolicy = 'reject' | 'report';
export type Diagnostic = Readonly<{
  code: string;
  severity: 'info' | 'loss' | 'error';
  dimension: 'syntax' | 'identity' | 'layout' | 'presentation' | 'semantics';
  message: string;
  subject: string | null;
  location: Readonly<{ line: number; column: number }> | null;
}>;
export type Conversion<T> =
  | Readonly<{
      protocol: typeof protocol;
      status: 'converted';
      value: T;
      diagnostics: readonly Diagnostic[];
    }>
  | Readonly<{ protocol: typeof protocol; status: 'rejected'; diagnostics: readonly Diagnostic[] }>;

const Identity = Schema.Struct({
  version: Schema.Literals([1]),
  nodes: Schema.Array(
    Schema.Struct({
      mermaidId: Schema.String,
      flowId: Schema.String,
      ports: Schema.Array(
        Schema.Struct({ id: Schema.String, kind: Schema.Literals(['input', 'output']) }),
      ),
    }),
  ),
  edges: Schema.Array(
    Schema.Struct({
      mermaidId: Schema.String,
      flowId: Schema.String,
      sourceNode: Schema.String,
      sourcePort: Schema.String,
      targetNode: Schema.String,
      targetPort: Schema.String,
    }),
  ),
});
export type IdentityMap = typeof Identity.Type;
const isIdentity = Schema.is(Identity);
export type ImportOptions = Readonly<{ lossPolicy?: LossPolicy; identity?: unknown }>;
export type ExportOptions = Readonly<{ lossPolicy?: LossPolicy; direction?: FlowchartDirection }>;
export type Imported = Readonly<{ graph: FlowGraph; direction: FlowchartDirection }>;
export type Exported = Readonly<{
  source: string;
  identity: IdentityMap;
  direction: FlowchartDirection;
}>;

function diagnostic(
  code: string,
  severity: Diagnostic['severity'],
  dimension: Diagnostic['dimension'],
  message: string,
  subject: string | null = null,
  location: Diagnostic['location'] = null,
): Diagnostic {
  return { code, severity, dimension, message, subject, location };
}
function rejected(diagnostics: readonly Diagnostic[]): Conversion<never> {
  return { protocol, status: 'rejected', diagnostics };
}
function finish<T>(
  value: T,
  diagnostics: readonly Diagnostic[],
  policy: LossPolicy,
): Conversion<T> {
  return diagnostics.some(
    (d) => d.severity === 'error' || (policy === 'reject' && d.severity === 'loss'),
  )
    ? rejected(diagnostics)
    : { protocol, status: 'converted', value, diagnostics };
}
async function attempt<T>(
  run: () => T,
): Promise<Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; message: string }>> {
  return Promise.resolve()
    .then(run)
    .then(
      (value) => ({ ok: true as const, value }),
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Untrusted parser exceptions are normalized at this boundary.
      (error: unknown) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : 'Unspecified conversion failure',
      }),
    );
}

type Statement = Readonly<{ mask: string; line: number; column: number }>;
/** Conservative feature detection only: the candidate still parses the grammar. Quotes/brackets protect separators. */
type SourceScan = Readonly<{
  statements: readonly Statement[];
  comments: boolean;
  multiline: boolean;
}>;
function scan(source: string): SourceScan {
  const statements: Statement[] = [];
  let mask = '',
    line = 1,
    column = 1,
    startLine = 1,
    startColumn = 1;
  let quote: string | null = null,
    depth = 0,
    escaped = false,
    comment = false,
    comments = false,
    multiline = false;
  const flush = () => {
    if (mask.trim()) statements.push({ mask: mask.trim(), line: startLine, column: startColumn });
    mask = '';
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    if (comment) {
      if (char === '\n') {
        comment = false;
        flush();
      }
    } else if (quote !== null) {
      mask += ' ';
      if (char === '\n') multiline = true;
      if (char === quote && !escaped) quote = null;
      escaped = char === '\\' && !escaped;
    } else if (char === '%' && source[index + 1] === '%' && depth === 0) {
      comments = true;
      comment = true;
    } else if ((char === ';' || char === '\n') && depth === 0) {
      flush();
    } else {
      if (!mask.trim() && char.trim()) {
        startLine = line;
        startColumn = column;
      }
      if (char === '"' || char === '`') {
        quote = char;
        mask += ' ';
      } else {
        mask += char;
        if ('[({'.includes(char)) depth++;
        if ('])}'.includes(char)) depth = Math.max(0, depth - 1);
      }
    }
    if (char === '\n') {
      line++;
      column = 1;
    } else column++;
  }
  flush();
  return { statements, comments, multiline };
}

const entities = new Map([
  ['quot', '"'],
  ['apos', "'"],
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
]);
function decodeLabel(
  text: string,
  type: string,
  diagnostics: Diagnostic[],
  subject: string,
): string {
  if (type === 'markdown' || text.includes('<') || text.includes('>') || text.includes('fa:'))
    diagnostics.push(
      diagnostic(
        'unsupported-label-markup',
        'error',
        'semantics',
        'Markdown, raw HTML and icon syntax are outside the literal-text subset.',
        subject,
      ),
    );
  return text.replace(/#([A-Za-z][A-Za-z0-9]*|[0-9]+);/gu, (match: string, entity: string) => {
    const named = entities.get(entity);
    if (named !== undefined) return named;
    const point = /^[0-9]+$/u.test(entity) ? Number(entity) : NaN;
    if (
      Number.isInteger(point) &&
      point > 0 &&
      point <= 0x10ffff &&
      !(point >= 0xd800 && point <= 0xdfff)
    )
      return String.fromCodePoint(point);
    diagnostics.push(
      diagnostic(
        'unsupported-label-entity',
        'error',
        'semantics',
        'Only quot/apos/amp/lt/gt and decimal Unicode entities are qualified.',
        subject,
      ),
    );
    return match;
  });
}
function unsupportedLabel(text: string): boolean {
  return (
    text.includes('fa:') ||
    [...text].some((char) => {
      const point = char.codePointAt(0)!;
      return point === 0 || (point >= 0xd800 && point <= 0xdfff);
    })
  );
}
function encodeLabel(text: string): string {
  return [...text]
    .map((char) => {
      const point = char.codePointAt(0)!;
      return '"&#<>|\\`\n\r'.includes(char) ? `#${point};` : char;
    })
    .join('');
}
function alias(prefix: string, id: string): string {
  return `${prefix}_${[...id].map((char) => char.codePointAt(0)!.toString(16)).join('_')}`;
}
function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length && values.every((value) => value.length > 0);
}
function normalizeDirection(direction: FlowchartDirection): FlowchartDirection {
  return direction === 'TD' ? 'TB' : direction;
}
function side(direction: FlowchartDirection, kind: Port['kind']): Port['side'] {
  const output =
    direction === 'RL'
      ? 'left'
      : direction === 'TB' || direction === 'TD'
        ? 'bottom'
        : direction === 'BT'
          ? 'top'
          : 'right';
  if (kind === 'output') return output;
  return output === 'left'
    ? 'right'
    : output === 'right'
      ? 'left'
      : output === 'top'
        ? 'bottom'
        : 'top';
}
const outlines = new Map<string, FlowNodeShape>([
  ['square', 'rectangle'],
  ['rect', 'rectangle'],
  ['round', 'rounded-rectangle'],
  ['cylinder', 'cylinder'],
]);

/** Experimental restricted flowchart conversion; not a production parser endorsement. */
export async function importFlowchart(
  source: string,
  options: ImportOptions = {},
): Promise<Conversion<Imported>> {
  if (source.length > sourceLimit)
    return rejected([
      diagnostic(
        'source-limit',
        'error',
        'syntax',
        'Source must be a string of at most 32768 UTF-16 code units.',
      ),
    ]);
  if (
    options.lossPolicy !== undefined &&
    options.lossPolicy !== 'report' &&
    options.lossPolicy !== 'reject'
  )
    return rejected([diagnostic('invalid-options', 'error', 'syntax', 'Unknown loss policy.')]);
  const diagnostics: Diagnostic[] = [];
  const scanned = scan(source);
  if (!/^(flowchart|graph)(\s|$)/u.test(scanned.statements[0]?.mask ?? ''))
    return rejected([
      diagnostic(
        'unsupported-diagram',
        'error',
        'syntax',
        'Only flowchart/graph syntax is qualified; frontmatter and other diagram types are outside the subset.',
      ),
    ]);
  if (scanned.comments)
    diagnostics.push(
      diagnostic(
        'comments-omitted',
        'loss',
        'presentation',
        'Comments are not represented in the converted graph.',
      ),
    );
  if (scanned.multiline)
    diagnostics.push(
      diagnostic(
        'unsupported-multiline-label',
        'error',
        'syntax',
        'Physical multiline quoted labels are outside the qualified subset; numeric newline entities are supported.',
      ),
    );
  for (const statement of scanned.statements) {
    const location = { line: statement.line, column: statement.column };
    if (statement.mask.includes('<'))
      diagnostics.push(
        diagnostic(
          'unsupported-arrow',
          'error',
          'semantics',
          'Reverse/start-marker arrows are not represented by the candidate link type.',
          null,
          location,
        ),
      );
    if (statement.mask.includes('@{'))
      diagnostics.push(
        diagnostic(
          'unsupported-node-metadata',
          'error',
          'semantics',
          'Modern node/edge metadata is outside the qualified subset.',
          null,
          location,
        ),
      );
    if (/^(style|classDef|class|linkStyle)(\s|$)/u.test(statement.mask))
      diagnostics.push(
        diagnostic(
          'presentation-omitted',
          'loss',
          'presentation',
          'Style/class declarations are not transferred; the candidate drops some node styles.',
          null,
          location,
        ),
      );
    if (/^click(\s|$)/u.test(statement.mask))
      diagnostics.push(
        diagnostic(
          'interactions-omitted',
          'loss',
          'semantics',
          'Click callbacks/links are data only and are never transferred or executed.',
          null,
          location,
        ),
      );
    if (/^(accTitle|accDescr|title)(:|\s|$)/u.test(statement.mask))
      diagnostics.push(
        diagnostic(
          'diagram-metadata-omitted',
          'loss',
          'semantics',
          'Diagram-level title/accessibility metadata is outside this graph-only prototype.',
          null,
          location,
        ),
      );
  }
  const parsed = await attempt(() => parseFlowchart(source));
  if (!parsed.ok)
    return rejected([
      ...diagnostics,
      diagnostic('invalid-syntax', 'error', 'syntax', parsed.message.slice(0, 2000)),
    ]);
  const ast: FlowchartAST = parsed.value;
  if (ast.nodes.size > 256 || ast.links.length > 512)
    diagnostics.push(
      diagnostic('graph-limit', 'error', 'syntax', 'Prototype limit: 256 nodes and 512 edges.'),
    );
  if (ast.subgraphs.length)
    diagnostics.push(
      diagnostic(
        'unsupported-subgraph',
        'error',
        'semantics',
        'Subgraphs require an explicit group/membership contract and are not flattened.',
      ),
    );
  const groups = new Set(ast.subgraphs.map(({ id }) => id));
  if (ast.links.some((edge) => groups.has(edge.source) || groups.has(edge.target)))
    diagnostics.push(
      diagnostic(
        'unsupported-group-endpoint',
        'error',
        'semantics',
        'Flow groups are portless; boundary links require a separate mapping.',
      ),
    );
  if (
    (ast.classDefs.size || ast.classes.size || ast.linkStyles.length) &&
    !diagnostics.some((d) => d.code === 'presentation-omitted')
  )
    diagnostics.push(
      diagnostic(
        'presentation-omitted',
        'loss',
        'presentation',
        'Mermaid styling is outside the graph projection.',
      ),
    );
  if (ast.clicks.length && !diagnostics.some((d) => d.code === 'interactions-omitted'))
    diagnostics.push(
      diagnostic(
        'interactions-omitted',
        'loss',
        'semantics',
        'Click definitions are not executed or transferred.',
      ),
    );
  const namedIds = ast.links.flatMap((edge) =>
    edge.id === undefined ? [] : [edge.id.endsWith('@') ? edge.id.slice(0, -1) : edge.id],
  );
  if (!unique(namedIds))
    diagnostics.push(
      diagnostic(
        'duplicate-edge-id',
        'error',
        'identity',
        'Named edge IDs must be nonempty and unique.',
      ),
    );
  const reserved = new Set(namedIds),
    counts = new Map<string, number>();
  const links = ast.links.map((edge) => {
    let id = edge.id;
    if (id !== undefined) {
      if (id.endsWith('@')) {
        id = id.slice(0, -1);
        diagnostics.push(
          diagnostic(
            'edge-delimiter-normalized',
            'info',
            'identity',
            'Pinned parser includes @ in named IDs; exactly one delimiter is removed.',
            id,
          ),
        );
      }
    } else {
      const key = JSON.stringify([edge.source, edge.target]);
      const ordinal = counts.get(key) ?? 0;
      counts.set(key, ordinal + 1);
      const base = `edge:${edge.source.length}:${edge.source}:${edge.target.length}:${edge.target}:${ordinal}`;
      id = base;
      let suffix = 0;
      while (reserved.has(id)) id = `${base}~${++suffix}`;
      reserved.add(id);
      diagnostics.push(
        diagnostic(
          'edge-identity-generated',
          'info',
          'identity',
          'Implicit IDs depend on endpoint-pair occurrence order; edge reordering can change these identities.',
          id,
        ),
      );
    }
    if (edge.type !== 'arrow_point')
      diagnostics.push(
        diagnostic(
          'unsupported-arrow',
          'error',
          'semantics',
          'Only directed point arrows are qualified.',
          id,
        ),
      );
    if (edge.stroke !== 'normal')
      diagnostics.push(
        diagnostic(
          'presentation-omitted',
          'loss',
          'presentation',
          'Edge stroke styling is omitted.',
          id,
        ),
      );
    if (edge.length !== 1)
      diagnostics.push(
        diagnostic('edge-spacing-omitted', 'loss', 'layout', 'Rank-spacing hints are omitted.', id),
      );
    const label = edge.text
      ? decodeLabel(edge.text.text, edge.text.type, diagnostics, id)
      : undefined;
    return { id, source: edge.source, target: edge.target, label };
  });
  const nodeFacts = [...ast.nodes.values()].map((node) => {
    const shape = outlines.get(node.shape);
    if (shape === undefined)
      diagnostics.push(
        diagnostic(
          'unsupported-outline',
          'error',
          'semantics',
          `Outline ${node.shape} has no qualified Flow geometry/presentation mapping.`,
          node.id,
        ),
      );
    if (node.shapeData)
      diagnostics.push(
        diagnostic(
          'unsupported-node-metadata',
          'error',
          'semantics',
          'Node metadata is not interpreted as rectangle fallback.',
          node.id,
        ),
      );
    return {
      id: node.id,
      label: node.text
        ? decodeLabel(node.text.text, node.text.type, diagnostics, node.id)
        : node.id,
      shape: shape ?? 'rectangle',
    };
  });
  if (diagnostics.some((d) => d.severity === 'error')) return rejected(diagnostics);
  const identityValue = options.identity;
  if (identityValue !== undefined && !isIdentity(identityValue))
    return rejected([
      ...diagnostics,
      diagnostic('invalid-identity-map', 'error', 'identity', 'Malformed identity map.'),
    ]);
  const identity = identityValue;
  const nodeMap = new Map(identity?.nodes.map((node) => [node.mermaidId, node]));
  const edgeMap = new Map(identity?.edges.map((edge) => [edge.mermaidId, edge]));
  if (
    identity &&
    (!unique(identity.nodes.map((node) => node.mermaidId)) ||
      !unique(identity.nodes.map((node) => node.flowId)) ||
      !unique(identity.edges.map((edge) => edge.mermaidId)) ||
      !unique(identity.edges.map((edge) => edge.flowId)) ||
      identity.nodes.length !== nodeFacts.length ||
      identity.edges.length !== links.length ||
      nodeFacts.some((node) => !nodeMap.has(node.id)) ||
      links.some((edge) => {
        const mapped = edgeMap.get(edge.id);
        return !mapped || mapped.sourceNode !== edge.source || mapped.targetNode !== edge.target;
      }))
  )
    return rejected([
      ...diagnostics,
      diagnostic(
        'invalid-identity-map',
        'error',
        'identity',
        'Duplicate, stale or wrong-endpoint identity entries.',
      ),
    ]);
  const direction = normalizeDirection(ast.direction);
  const ports = new Map(
    nodeFacts.map((node) => [
      node.id,
      new Map<string, Port>(
        (nodeMap.get(node.id)?.ports ?? []).map((port) => [
          port.id,
          { ...port, side: side(direction, port.kind), offset: 0.5 },
        ]),
      ),
    ]),
  );
  const edges = links.map((link) => {
    const mapped = edgeMap.get(link.id);
    const sourcePort = mapped?.sourcePort ?? `out:${link.id}`,
      targetPort = mapped?.targetPort ?? `in:${link.id}`;
    if (!identity) {
      ports.get(link.source)?.set(sourcePort, {
        id: sourcePort,
        kind: 'output',
        side: side(direction, 'output'),
        offset: 0.5,
      });
      ports.get(link.target)?.set(targetPort, {
        id: targetPort,
        kind: 'input',
        side: side(direction, 'input'),
        offset: 0.5,
      });
    }
    const edge = {
      id: mapped?.flowId ?? link.id,
      source: { node: nodeMap.get(link.source)?.flowId ?? link.source, port: sourcePort },
      target: { node: nodeMap.get(link.target)?.flowId ?? link.target, port: targetPort },
    };
    return link.label === undefined ? edge : { ...edge, label: link.label };
  });
  const nodes: FlowNode[] = nodeFacts.map((node, index) => ({
    id: nodeMap.get(node.id)?.flowId ?? node.id,
    label: node.label,
    appearance: { shape: node.shape },
    position:
      direction === 'LR' || direction === 'RL'
        ? { x: (direction === 'RL' ? nodeFacts.length - index - 1 : index) * 260, y: 0 }
        : { x: 0, y: (direction === 'BT' ? nodeFacts.length - index - 1 : index) * 180 },
    size: { width: 200, height: 120 },
    ports: [...(ports.get(node.id)?.values() ?? [])],
  }));
  if (identity && identity.nodes.some((node) => !unique(node.ports.map((port) => port.id))))
    return rejected([
      ...diagnostics,
      diagnostic(
        'invalid-identity-map',
        'error',
        'identity',
        'Port identities must be nonempty and unique per node.',
      ),
    ]);
  const graph = { nodes, edges };
  const checked = await attempt(() => validateGraph(graph));
  if (!checked.ok)
    return rejected([
      ...diagnostics,
      diagnostic(
        identity ? 'invalid-identity-map' : 'invalid-generated-graph',
        'error',
        'identity',
        checked.message,
      ),
    ]);
  diagnostics.push(
    diagnostic(
      'layout-generated',
      'info',
      'layout',
      'Prototype dimensions/grid positions and cardinal default ports are generated; this is not Mermaid layout.',
    ),
  );
  return finish({ graph, direction }, diagnostics, options.lossPolicy ?? 'reject');
}

/** Emits only the declared subset. The returned identity map is required to retain arbitrary Flow/port IDs. */
export async function exportFlowchart(
  graph: FlowGraph,
  options: ExportOptions = {},
): Promise<Conversion<Exported>> {
  const checked = await attempt(() => validateGraph(graph));
  if (!checked.ok)
    return rejected([diagnostic('invalid-graph', 'error', 'semantics', checked.message)]);
  const direction = normalizeDirection(options.direction ?? 'LR');
  if (
    !['LR', 'RL', 'TB', 'BT'].includes(direction) ||
    (options.lossPolicy !== undefined &&
      options.lossPolicy !== 'reject' &&
      options.lossPolicy !== 'report')
  )
    return rejected([
      diagnostic('invalid-options', 'error', 'syntax', 'Unknown direction or loss policy.'),
    ]);
  const diagnostics: Diagnostic[] = [];
  if (graph.nodes.length > 256 || graph.edges.length > 512)
    return rejected([
      diagnostic('graph-limit', 'error', 'syntax', 'Prototype limit: 256 nodes and 512 edges.'),
    ]);
  if (graph.nodes.some((node) => node.kind === 'group' || node.parentId !== undefined))
    return rejected([
      diagnostic(
        'unsupported-subgraph',
        'error',
        'semantics',
        'Group/membership export needs a separate explicit contract.',
      ),
    ]);
  const identity: IdentityMap = {
    version: 1,
    nodes: graph.nodes.map((node) => ({
      mermaidId: alias('n', node.id),
      flowId: node.id,
      ports: node.ports.map(({ id, kind }) => ({ id, kind })),
    })),
    edges: graph.edges.map((edge) => ({
      mermaidId: alias('e', edge.id),
      flowId: edge.id,
      sourceNode: alias('n', edge.source.node),
      sourcePort: edge.source.port,
      targetNode: alias('n', edge.target.node),
      targetPort: edge.target.port,
    })),
  };
  const lines = [`flowchart ${direction}`];
  for (const node of graph.nodes) {
    const kept = new Set(['id', 'label', 'position', 'size', 'ports', 'appearance']);
    const omitted = Object.keys(node).filter((key) => !kept.has(key));
    if (omitted.length)
      diagnostics.push(
        diagnostic(
          'node-fields-omitted',
          'loss',
          'semantics',
          `Not represented: ${omitted.join(', ')}.`,
          node.id,
        ),
      );
    if (node.ports.length)
      diagnostics.push(
        diagnostic(
          'port-details-omitted',
          'loss',
          'layout',
          'Only port identity/kind is retained in the map; labels, ordering, offsets and authored anchors are omitted.',
          node.id,
        ),
      );
    if (unsupportedLabel(node.label))
      diagnostics.push(
        diagnostic(
          'unsupported-label-encoding',
          'error',
          'semantics',
          'Icon-like or invalid Unicode labels are outside this emitter subset.',
          node.id,
        ),
      );
    const name = alias('n', node.id),
      label = `"${encodeLabel(node.label)}"`;
    const shape = node.appearance?.shape ?? 'rectangle';
    lines.push(
      `  ${name}${shape === 'cylinder' ? `[(${label})]` : shape === 'rounded-rectangle' ? `(${label})` : `[${label}]`}`,
    );
  }
  for (const edge of graph.edges) {
    const kept = new Set(['id', 'source', 'target', 'label']);
    const omitted = Object.keys(edge).filter((key) => !kept.has(key));
    if (omitted.length)
      diagnostics.push(
        diagnostic(
          'edge-fields-omitted',
          'loss',
          'semantics',
          `Not represented: ${omitted.join(', ')}.`,
          edge.id,
        ),
      );
    if (edge.label !== undefined && unsupportedLabel(edge.label))
      diagnostics.push(
        diagnostic(
          'unsupported-label-encoding',
          'error',
          'semantics',
          'Icon-like or invalid Unicode labels are outside this emitter subset.',
          edge.id,
        ),
      );
    lines.push(
      `  ${alias('n', edge.source.node)} ${alias('e', edge.id)}@-->${edge.label === undefined ? '' : `|"${encodeLabel(edge.label)}"|`} ${alias('n', edge.target.node)}`,
    );
  }
  if (graph.nodes.length)
    diagnostics.push(
      diagnostic(
        'layout-omitted',
        'loss',
        'layout',
        'Authored positions/dimensions are not represented by this Mermaid projection.',
      ),
    );
  if (graph.nodes.length || graph.edges.length)
    diagnostics.push(
      diagnostic(
        'identity-map-required',
        'loss',
        'identity',
        'Retain the explicit identity map alongside source to preserve original node/edge/port IDs. Source alone uses safe aliases.',
      ),
    );
  const source = lines.join('\n') + '\n';
  if (source.length > sourceLimit)
    diagnostics.push(
      diagnostic(
        'source-limit',
        'error',
        'syntax',
        'Generated source exceeds the qualified input limit.',
      ),
    );
  return finish({ source, identity, direction }, diagnostics, options.lossPolicy ?? 'reject');
}
