import type { FlowGraph } from '@opsydyn/foldkit-flow';

const columns = 16;
const rows = 20;
const stepId = (row: number, column: number) => `load-${row + 1}-${column + 1}`;

/** Deterministic lanes with cross-lane dependencies for the camera benchmark. */
export function createLargeWorkflowGraph(): FlowGraph {
  const nodes: FlowGraph['nodes'][number][] = [];
  const edges: FlowGraph['edges'][number][] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const id = stepId(row, column);
      nodes.push({
        id,
        label: `Lane ${row + 1} · Step ${column + 1}`,
        position: { x: 40 + column * 250, y: 40 + row * 152 },
        size: { width: 180, height: 100 },
        ports: [
          { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
          { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
        ],
      });
      if (column === columns - 1) continue;
      edges.push({
        id: `${id}:next`,
        source: { node: id, port: 'out' },
        target: { node: stepId(row, column + 1), port: 'in' },
      });
      if (row < rows - 1 && column % 2 === 0)
        edges.push({
          id: `${id}:handoff`,
          source: { node: id, port: 'out' },
          target: { node: stepId(row + 1, column + 1), port: 'in' },
        });
    }
  }
  return { nodes, edges };
}
