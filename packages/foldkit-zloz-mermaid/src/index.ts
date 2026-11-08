/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Built-in geometric outlines are public domain concepts. */
/**
 * Pure Mermaid projections with identity metadata and explicit conversion losses.
 * @module Mermaid
 */
// ADR 0008: Optional pure export; the headless parser spike is not a production import API.
import { validateGraph, type ZlozGraph, type ZlozNode } from '@opsydyn/foldkit-zloz';

export const mermaidProtocol = 'foldkit-flow-mermaid/v1';
/** Maximum generated source size, in UTF-16 code units. */
export const mermaidSourceLimit = 32768;
export type MermaidDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type MermaidLossPolicy = 'reject' | 'report';
export type MermaidDiagnosticCode =
  | 'invalid-graph'
  | 'invalid-options'
  | 'unsupported-subgraph'
  | 'group-presentation-omitted'
  | 'unsupported-label-encoding'
  | 'source-limit'
  | 'node-fields-omitted'
  | 'edge-fields-omitted'
  | 'port-details-omitted'
  | 'layout-omitted'
  | 'identity-map-required';
export type MermaidDiagnostic = Readonly<{
  code: MermaidDiagnosticCode;
  severity: 'loss' | 'error';
  dimension: 'syntax' | 'semantics' | 'identity' | 'layout';
  message: string;
  subject: string | null;
}>;
export type MermaidIdentity = Readonly<{
  version: 1;
  nodes: readonly Readonly<{
    mermaidId: string;
    flowId: string;
    /** Present for group entries; flat v1 entries are unchanged. */
    kind?: 'group';
    /** Original Zloz parent group ID, never a Mermaid alias. */
    parentId?: string;
    ports: readonly Readonly<{ id: string; kind: 'input' | 'output' }>[];
  }>[];
  edges: readonly Readonly<{
    mermaidId: string;
    flowId: string;
    sourceNode: string;
    sourcePort: string;
    targetNode: string;
    targetPort: string;
  }>[];
}>;
/** A projection, not a substitute for canonical Zloz JSON. No full graph is hidden in identity. */
export type MermaidBundle = Readonly<{
  protocol: typeof mermaidProtocol;
  source: string;
  direction: MermaidDirection;
  identity: MermaidIdentity;
  diagnostics: readonly MermaidDiagnostic[];
}>;
export type MermaidExportOptions = Readonly<{
  direction?: MermaidDirection;
  lossPolicy?: MermaidLossPolicy;
}>;
export type MermaidExportResult =
  | Readonly<{
      protocol: typeof mermaidProtocol;
      status: 'converted';
      value: MermaidBundle;
      diagnostics: readonly MermaidDiagnostic[];
    }>
  | Readonly<{
      protocol: typeof mermaidProtocol;
      status: 'rejected';
      diagnostics: readonly MermaidDiagnostic[];
    }>;

function diagnostic(
  code: MermaidDiagnosticCode,
  severity: MermaidDiagnostic['severity'],
  dimension: MermaidDiagnostic['dimension'],
  message: string,
  subject: string | null = null,
): MermaidDiagnostic {
  return { code, severity, dimension, message, subject };
}
function rejected(diagnostics: readonly MermaidDiagnostic[]): MermaidExportResult {
  return { protocol: mermaidProtocol, status: 'rejected', diagnostics };
}
/** Injective alias over Unicode code points; IDs never become Mermaid keywords or markup. */
function alias(prefix: 'n' | 'e', id: string): string {
  return `${prefix}_${[...id].map((char) => char.codePointAt(0)!.toString(16)).join('_')}`;
}
function unsupportedLabel(text: string): boolean {
  return (
    text.length === 0 ||
    text.includes('fa:') ||
    [...text].some((char) => {
      const point = char.codePointAt(0)!;
      return (
        (point < 32 && point !== 9 && point !== 10 && point !== 13) ||
        point === 127 ||
        (point >= 0xd800 && point <= 0xdfff)
      );
    })
  );
}
function label(text: string): string {
  return (
    '"' +
    [...text]
      .map((char) => ('"&#<>|\\`\n\r'.includes(char) ? `#${char.codePointAt(0)!};` : char))
      .join('') +
    '"'
  );
}

function isOptions(value: unknown): value is MermaidExportOptions {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    (!('direction' in value) ||
      value.direction === undefined ||
      (typeof value.direction === 'string' &&
        ['LR', 'RL', 'TB', 'BT'].includes(value.direction))) &&
    (!('lossPolicy' in value) ||
      value.lossPolicy === undefined ||
      value.lossPolicy === 'reject' ||
      value.lossPolicy === 'report')
  );
}

/**
 * Export the qualified flowchart subset without changing the graph or performing I/O.
 * Losses reject by default. `report` consents to omitted fields, never to errors.
 * Keep the bundle's identity metadata with source; source alone contains safe aliases.
 */
export function exportMermaid(
  graph: ZlozGraph,
  options: MermaidExportOptions = {},
): MermaidExportResult {
  // Core throws on invalid input. Normalize only at this public conversion boundary.
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    validateGraph(graph);
  } catch (error) {
    return rejected([
      diagnostic(
        'invalid-graph',
        'error',
        'semantics',
        error instanceof Error ? error.message : 'Invalid Zloz graph.',
      ),
    ]);
  }
  if (!isOptions(options))
    return rejected([
      diagnostic('invalid-options', 'error', 'syntax', 'Unknown direction or loss policy.'),
    ]);
  const direction = options.direction ?? 'LR';
  const policy = options.lossPolicy ?? 'reject';
  const children = new Map<string | undefined, ZlozNode[]>();
  for (const node of graph.nodes) {
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node);
    children.set(node.parentId, siblings);
  }
  if (graph.nodes.some((node) => node.kind === 'group' && !children.has(node.id)))
    return rejected([
      diagnostic(
        'unsupported-subgraph',
        'error',
        'semantics',
        'Empty groups have no reliable visible Mermaid boundary; export does not invent placeholder nodes.',
      ),
    ]);
  const diagnostics: MermaidDiagnostic[] = [];
  const identity: MermaidIdentity = {
    version: 1,
    nodes: graph.nodes.map((node): MermaidIdentity['nodes'][number] => {
      const entry = {
        mermaidId: alias('n', node.id),
        flowId: node.id,
        ports: node.ports.map(({ id, kind }) => ({ id, kind })),
      };
      const nested = node.parentId === undefined ? entry : { ...entry, parentId: node.parentId };
      return node.kind === 'group' ? { ...nested, kind: 'group' } : nested;
    }),
    edges: graph.edges.map((edge) => ({
      mermaidId: alias('e', edge.id),
      flowId: edge.id,
      sourceNode: alias('n', edge.source.node),
      sourcePort: edge.source.port,
      targetNode: alias('n', edge.target.node),
      targetPort: edge.target.port,
    })),
  };
  const declarations = new Map<string, string>();
  const nodeFields = new Set([
    'id',
    'label',
    'position',
    'size',
    'ports',
    'appearance',
    'kind',
    'parentId',
  ]);
  const edgeFields = new Set(['id', 'source', 'target', 'label']);
  for (const node of graph.nodes) {
    const omitted = Object.keys(node).filter((key) => !nodeFields.has(key));
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
          'Port IDs/kinds remain in identity metadata. Port labels, ordering, offsets and anchors are omitted from source.',
          node.id,
        ),
      );
    if (unsupportedLabel(node.label))
      diagnostics.push(
        diagnostic(
          'unsupported-label-encoding',
          'error',
          'semantics',
          'Empty, icon-like, control or invalid Unicode labels are outside the qualified literal-text subset.',
          node.id,
        ),
      );
    const text = label(node.label),
      shape = node.appearance?.shape ?? 'rectangle';
    if (node.kind === 'group') {
      declarations.set(node.id, `subgraph ${alias('n', node.id)}[${text}]`);
      if (node.appearance !== undefined)
        diagnostics.push(
          diagnostic(
            'group-presentation-omitted',
            'loss',
            'layout',
            'Subgraph boundaries do not retain authored node outline choice.',
            node.id,
          ),
        );
    } else
      declarations.set(
        node.id,
        `${alias('n', node.id)}${shape === 'cylinder' ? `[(${text})]` : shape === 'rounded-rectangle' ? `(${text})` : `[${text}]`}`,
      );
  }
  const lines = [`flowchart ${direction}`];
  let length = lines[0]!.length + 1;
  const stack: Array<{ node: ZlozNode; depth: number } | { depth: number }> = [
    ...(children.get(undefined) ?? []),
  ]
    .reverse()
    .map((node) => ({ node, depth: 1 }));
  while (stack.length) {
    const entry = stack.pop()!;
    const text = 'node' in entry ? declarations.get(entry.node.id)! : 'end';
    length += entry.depth * 2 + text.length + 1;
    if (length > mermaidSourceLimit)
      return rejected([
        ...diagnostics,
        diagnostic(
          'source-limit',
          'error',
          'syntax',
          'Generated source exceeds 32768 UTF-16 code units.',
        ),
      ]);
    lines.push('  '.repeat(entry.depth) + text);
    if ('node' in entry && entry.node.kind === 'group') {
      stack.push({ depth: entry.depth });
      for (const node of [...(children.get(entry.node.id) ?? [])].reverse())
        stack.push({ node, depth: entry.depth + 1 });
    }
  }
  for (const edge of graph.edges) {
    const omitted = Object.keys(edge).filter((key) => !edgeFields.has(key));
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
          'Empty, icon-like, control or invalid Unicode labels are outside the qualified literal-text subset.',
          edge.id,
        ),
      );
    lines.push(
      `  ${alias('n', edge.source.node)} ${alias('e', edge.id)}@-->${edge.label === undefined ? '' : `|${label(edge.label)}|`} ${alias('n', edge.target.node)}`,
    );
  }
  if (graph.nodes.length) {
    diagnostics.push(
      diagnostic(
        'layout-omitted',
        'loss',
        'layout',
        'Authored positions and dimensions are not represented; Mermaid chooses layout.',
      ),
    );
    diagnostics.push(
      diagnostic(
        'identity-map-required',
        'loss',
        'identity',
        'Source uses safe aliases. Keep the bundle identity metadata to retain original node, edge and port IDs.',
      ),
    );
  }
  const source = lines.join('\n') + '\n';
  if (source.length > mermaidSourceLimit)
    diagnostics.push(
      diagnostic(
        'source-limit',
        'error',
        'syntax',
        'Generated source exceeds 32768 UTF-16 code units.',
      ),
    );
  if (
    diagnostics.some(
      (item) => item.severity === 'error' || (policy === 'reject' && item.severity === 'loss'),
    )
  )
    return rejected(diagnostics);
  const value: MermaidBundle = {
    protocol: mermaidProtocol,
    source,
    direction,
    identity,
    diagnostics,
  };
  return { protocol: mermaidProtocol, status: 'converted', value, diagnostics };
}
