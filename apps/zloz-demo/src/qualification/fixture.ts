import {
  captureGroupDocumentV3,
  type ZlozGroupDocumentV3,
  type ZlozNode,
} from '@opsydyn/foldkit-zloz';
/** Deterministic synthetic qualification only; count includes every group and ordinary node. */
export function nativeQualificationFixture(
  count: 100 | 1000,
  nested: boolean,
): ZlozGroupDocumentV3 {
  const nodes: ZlozNode[] = [];
  for (let i = 0; i < count; i++) {
    const cluster = Math.floor(i / 50),
      member = i % 50;
    const group = nested && member === 0;
    const origin = { x: (cluster % 4) * 1600, y: Math.floor(cluster / 4) * 1100 };
    const position = nested
      ? group
        ? origin
        : {
            x: origin.x + 40 + ((member - 1) % 7) * 215,
            y: origin.y + 70 + Math.floor((member - 1) / 7) * 140,
          }
      : { x: (i % 20) * 240, y: Math.floor(i / 20) * 150 };
    const common = {
      id: `n${i}`,
      label: group ? `Boundary ${cluster}` : `Node ${i}`,
      position,
      size: group ? { width: 1540, height: 1050 } : { width: 180, height: 90 },
      ports: [
        { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
        { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      ],
    };
    if (group) nodes.push({ ...common, kind: 'group' });
    else if (nested) nodes.push({ ...common, parentId: `n${cluster * 50}` });
    else nodes.push(common);
  }
  return captureGroupDocumentV3({
    version: 3,
    coordinateSpace: 'world',
    connectionMode: 'strict',
    capabilities: { groupPorts: true },
    graph: {
      nodes,
      edges: nodes.slice(1).map((node, index) => ({
        id: `e${index}`,
        source: { node: `n${index}`, port: 'out' },
        target: { node: node.id, port: 'in' },
      })),
    },
    viewport: { x: 24, y: 24, zoom: 0.75 },
  });
}
