import type { ZlozGraph } from '@opsydyn/foldkit-zloz';

const columns = 16;
const rows = 20;
const stepId = (row: number, column: number) => `load-${row + 1}-${column + 1}`;

/** Deterministic lanes with cross-lane dependencies for the camera benchmark. */
export function createLargeWorkflowGraph(): ZlozGraph {
  const nodes: ZlozGraph['nodes'][number][] = [];
  const edges: ZlozGraph['edges'][number][] = [];
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

/** Real guards on 80 inputs and 60 outputs; existing connections remain authored. */
export function createProtectedWorkflowGraph(): ZlozGraph {
  const graph = createLargeWorkflowGraph();
  return {
    ...graph,
    nodes: graph.nodes.map((node, index) => {
      const column = index % columns;
      const socketPolicies: Array<{ port: string; reason: string }> = [];
      if (column % 4 === 1)
        socketPolicies.push({ port: 'in', reason: 'Approval required for this input.' });
      if (column % 5 === 3)
        socketPolicies.push({ port: 'out', reason: 'Output reserved for automation.' });
      const positioned = {
        ...node,
        position: { x: 80 + column * 320, y: 60 + Math.floor(index / columns) * 260 },
      };
      return socketPolicies.length ? { ...positioned, data: { socketPolicies } } : positioned;
    }),
  };
}
