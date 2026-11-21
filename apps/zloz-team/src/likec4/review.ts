import {
  parseGraph,
  planGroupDocumentDowngradeV3,
  serializeGraph,
  serializeGroupDocumentV3,
  writeGroupSvgExportV3,
  type ZlozGraph,
} from '@opsydyn/foldkit-zloz';

import { importLikeC4 } from './project.mjs';

export const requestLimit = 1_048_576;

export function creationBody(creationId: string, name: string, graphText: string) {
  return JSON.stringify({
    operationId: creationId,
    name: name.trim(),
    graph: JSON.parse(graphText),
  });
}

export function reviewLikeC4(source: string, viewId: string) {
  const result = importLikeC4(source, viewId);
  if (result.status === 'rejected') return result;

  const { document, diagnostics } = result.value;
  const compatibility = planGroupDocumentDowngradeV3(document);
  const svg = writeGroupSvgExportV3(document, {
    title: viewId,
    region: { type: 'model', padding: 24 },
    theme: { colorScheme: 'light' },
    background: { type: 'theme' },
    font: { family: 'sans-serif', size: 14, weight: 400 },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  });
  const { graph } = document;
  const blockers = compatibility.findings.map(
    ({ nodeId }) =>
      `Group ${nodeId} has a port. Download the v3 document to preserve the boundary relationship.`,
  );
  if (graph.nodes.length > 250 || graph.edges.length > 500)
    blockers.push('Teams supports up to 250 nodes and 500 relationships in a diagram.');
  const toGraph = (candidate: ZlozGraph) => serializeGraph(parseGraph(serializeGraph(candidate)));
  const graphText =
    compatibility.type === 'reviewable' && blockers.length === 0
      ? toGraph(compatibility.document.graph)
      : null;
  return {
    status: 'ready' as const,
    graph,
    graphText,
    blockers,
    diagnostics: [
      ...diagnostics,
      ...(compatibility.type === 'reviewable' ? compatibility.losses : []).map((loss) => ({
        code: loss.code,
        severity: 'loss' as const,
        subject: null,
        message: loss.reason,
      })),
    ],
    svg: svg.type === 'written' ? svg.svg : null,
    v3: serializeGroupDocumentV3(document),
  };
}
