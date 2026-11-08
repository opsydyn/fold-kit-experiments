import {
  revealableEdges,
  revealableNodes,
  type EditorEvent,
  type EditorState,
} from '@opsydyn/foldkit-zloz';

import type { SearchScope } from './model';

type SearchResult = Readonly<{
  label: string;
  event: Extract<EditorEvent, { type: 'NodeRevealRequested' | 'EdgeRevealRequested' }>;
}>;

export function searchDiagram(
  editor: EditorState,
  query: string,
  scope: SearchScope,
): readonly SearchResult[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const nodes = revealableNodes(editor);
  if (scope === 'nodes')
    return nodes
      .filter(
        (node) => node.label.toLowerCase().includes(term) || node.id.toLowerCase().includes(term),
      )
      .map((node) => ({
        label: `Reveal ${node.label} (${node.id})`,
        event: { type: 'NodeRevealRequested', id: node.id },
      }));

  const byId = new Map(nodes.map((node) => [node.id, node]));
  return revealableEdges(editor).flatMap((edge): readonly SearchResult[] => {
    const describe = ({ node, port }: typeof edge.source) => {
      const frame = byId.get(node);
      return `${frame?.label ?? node}: ${frame?.ports.find(({ id }) => id === port)?.label ?? port}`;
    };
    const endpoints = `${describe(edge.source)} → ${describe(edge.target)}`;
    const label = edge.label ? `${edge.label} (${endpoints})` : endpoints;
    const searchable = `${label} ${edge.id} ${edge.source.node}:${edge.source.port} ${edge.target.node}:${edge.target.port}`;
    return searchable.toLowerCase().includes(term)
      ? [
          {
            label: `Reveal connection ${label}`,
            event: { type: 'EdgeRevealRequested', id: edge.id },
          },
        ]
      : [];
  });
}
