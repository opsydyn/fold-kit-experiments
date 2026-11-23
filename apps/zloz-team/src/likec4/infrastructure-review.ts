import {
  parseGraph,
  serializeGraph,
  upgradeGroupDocumentV3,
  writeGroupSvgExportV3,
  type ZlozSvgRegion,
} from '@opsydyn/foldkit-zloz';
import { readInfrastructureSnapshot } from '@opsydyn/foldkit-zloz-alchemy';

export const infrastructureViewId = 'infrastructure';

export function reviewInfrastructure(source: string, focused: string | null = null) {
  const result = readInfrastructureSnapshot(source);
  if (result.status === 'blocked')
    return {
      status: 'rejected' as const,
      diagnostics: [
        { code: 'snapshot', severity: 'error' as const, subject: null, message: result.message },
      ],
    };
  const { graph, findings, snapshot } = result;
  const document = upgradeGroupDocumentV3({ version: 1, graph });
  const node = focused ? graph.nodes.find(({ id }) => id === `resource:${focused}`) : undefined;
  const region = node
    ? ({
        type: 'bounds',
        bounds: {
          x: node.position.x - 24,
          y: node.position.y - 24,
          width: node.size.width + 48,
          height: node.size.height + 48,
        },
      } satisfies ZlozSvgRegion)
    : ({ type: 'model', padding: 24 } satisfies ZlozSvgRegion);
  const image = writeGroupSvgExportV3(document, {
    title: node ? `Finding at ${node.label}` : 'Alchemy infrastructure snapshot',
    region,
    theme: { colorScheme: 'light' },
    background: { type: 'theme' },
    font: { family: 'sans-serif', size: 14, weight: 400 },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  });
  const blockers = [];
  if (graph.nodes.length > 250 || graph.edges.length > 500)
    blockers.push('Teams supports up to 250 nodes and 500 relationships in a diagram.');
  const graphText = blockers.length ? null : serializeGraph(parseGraph(serializeGraph(graph)));
  const { stack, stage, revision } = snapshot.source;
  return {
    status: 'ready' as const,
    graph,
    graphText,
    blockers,
    svg: image.type === 'written' ? image.svg : null,
    provenance: `${stack} · ${stage} · ${revision}`,
    diagnostics: findings.map(({ resource, message }) => ({
      code: 'unresolved-reference',
      severity: 'loss' as const,
      subject: resource,
      message,
    })),
  };
}
