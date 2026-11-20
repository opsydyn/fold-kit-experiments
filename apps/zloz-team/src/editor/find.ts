import { revealableEdges, revealableNodes, type EditorState } from '@opsydyn/foldkit-zloz';

export const FindTarget = ['node', 'relationship'] as const;

export function findMatches(editor: EditorState, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const matches = (text: string) => text.toLowerCase().includes(term);
  const nodes = revealableNodes(editor);
  const labels = new Map(nodes.map(({ id, label }) => [id, label]));
  return [
    ...nodes
      .filter(({ id, label }) => matches(label) || matches(id))
      .map(({ id, label }) => ({ target: 'node' as const, id, label })),
    ...revealableEdges(editor).flatMap(({ id, label, source, target }) => {
      const endpoints = `${labels.get(source.node) ?? source.node} → ${labels.get(target.node) ?? target.node}`;
      const description = label ? `${label} — ${endpoints}` : endpoints;
      return matches(description) || matches(id)
        ? [{ target: 'relationship' as const, id, label: description }]
        : [];
    }),
  ];
}
