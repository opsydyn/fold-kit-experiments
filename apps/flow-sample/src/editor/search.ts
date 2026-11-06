import { revealableNodes, type EditorState } from '@opsydyn/foldkit-flow';

export function searchNodes(editor: EditorState, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  return revealableNodes(editor).filter(
    (node) => node.label.toLowerCase().includes(term) || node.id.toLowerCase().includes(term),
  );
}
